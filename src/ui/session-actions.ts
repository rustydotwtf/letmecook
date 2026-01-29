import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import type { Session } from "../types";

import { formatRepoList } from "./common/repo-formatter";
import { createBaseLayout, clearLayout } from "./renderer";

export type SessionAction = "continue" | "add-repos" | "exit";

interface ActionResolver {
  cleanup: () => void;
  promise: Promise<SessionAction>;
}

function setupActionResolver(
  renderer: CliRenderer,
  select: SelectRenderable
): ActionResolver {
  let resolveFn: ((value: SessionAction) => void) | null = null;

  const cleanup = () => {
    if (resolveFn) {
      select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
      renderer.keyInput.off("keypress", handleKeypress);
      select.blur();
      clearLayout(renderer);
      resolveFn = null;
    }
  };

  const handleSelect = (_index: number, option: { value: string }) => {
    if (resolveFn) {
      const fn = resolveFn;
      cleanup();
      fn(option.value as SessionAction);
    }
  };

  const handleKeypress = (key: KeyEvent) => {
    if (key.name === "escape" && resolveFn) {
      const fn = resolveFn;
      cleanup();
      fn("exit");
    }
  };

  select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
  renderer.keyInput.on("keypress", handleKeypress);

  const promise = Promise.resolve().then(
    () =>
      new Promise<SessionAction>((resolve) => {
        resolveFn = resolve;
      })
  );

  return { cleanup, promise };
}

function createSessionInfo(renderer: CliRenderer, session: Session) {
  return new TextRenderable(renderer, {
    content: `Session: ${session.name}`,
    fg: "#38bdf8",
    id: "session-info",
    marginBottom: 1,
  });
}

function createReposInfo(renderer: CliRenderer, session: Session) {
  const reposText = formatRepoList(session.repos, {
    prefix: "  ",
    showMarkers: true,
  });
  return new TextRenderable(renderer, {
    content: `Repositories:\n${reposText}`,
    fg: "#94a3b8",
    id: "repos-info",
    marginBottom: 1,
  });
}

function createQuestion(renderer: CliRenderer) {
  return new TextRenderable(renderer, {
    content: "What would you like to do?",
    fg: "#e2e8f0",
    id: "question",
  });
}

function createActionSelect(renderer: CliRenderer) {
  return new SelectRenderable(renderer, {
    backgroundColor: "transparent",
    descriptionColor: "#64748b",
    focusedBackgroundColor: "transparent",
    height: 3,
    id: "action-select",
    marginTop: 1,
    options: [
      {
        description: "Re-launch claude",
        name: "Continue session",
        value: "continue",
      },
      {
        description: "Clone more repos to this session",
        name: "Add repositories",
        value: "add-repos",
      },
      {
        description: "Choose to keep or delete session",
        name: "Exit session",
        value: "exit",
      },
    ],
    selectedBackgroundColor: "#334155",
    selectedDescriptionColor: "#94a3b8",
    selectedTextColor: "#38bdf8",
    showDescription: true,
    textColor: "#e2e8f0",
    width: 40,
  });
}

function createInstructions(renderer: CliRenderer) {
  return new TextRenderable(renderer, {
    content: "\n[Enter] Select   [Esc] Exit session",
    fg: "#64748b",
    id: "instructions",
    marginTop: 1,
  });
}

function setupUI(
  renderer: CliRenderer,
  session: Session
): { promise: Promise<SessionAction>; select: SelectRenderable } {
  clearLayout(renderer);
  const { content } = createBaseLayout(renderer, "Session paused");

  content.add(createSessionInfo(renderer, session));
  content.add(createReposInfo(renderer, session));
  content.add(createQuestion(renderer));

  const select = createActionSelect(renderer);
  content.add(select);
  content.add(createInstructions(renderer));

  select.focus();

  const resolver = setupActionResolver(renderer, select);

  return { promise: resolver.promise, select };
}

export function showSessionActions(
  renderer: CliRenderer,
  session: Session
): Promise<SessionAction> {
  const { promise } = setupUI(renderer, session);
  return promise;
}
