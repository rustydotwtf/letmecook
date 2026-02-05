import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import type { Session, ExitChoice, RepoSpec } from "../types";

import { sessionHasUncommittedChanges } from "../git";
import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

const getSessionInfo = (
  renderer: CliRenderer,
  session: Session
): TextRenderable =>
  new TextRenderable(renderer, {
    content: `Session: ${session.name}`,
    fg: "#38bdf8",
    id: "session-info",
    marginBottom: 1,
  });

const addChangesWarning = (
  content: unknown,
  renderer: CliRenderer,
  reposWithChanges: RepoSpec[]
): void => {
  const warning = new TextRenderable(renderer, {
    content: "⚠️  Uncommitted changes detected:",
    fg: "#f59e0b",
    id: "warning",
    marginBottom: 0,
  });

  const list = new TextRenderable(renderer, {
    content: reposWithChanges.map((r) => `   - ${r.dir}/`).join("\n"),
    fg: "#fbbf24",
    id: "changed-repos",
    marginBottom: 1,
  });

  (content as { add: (item: unknown) => void }).add(warning);
  (content as { add: (item: unknown) => void }).add(list);
};

const getQuestion = (renderer: CliRenderer): TextRenderable =>
  new TextRenderable(renderer, {
    content: "What would you like to do?",
    fg: "#e2e8f0",
    id: "question",
    marginBottom: 1,
  });

const getSelect = (renderer: CliRenderer): SelectRenderable =>
  new SelectRenderable(renderer, {
    backgroundColor: "transparent",
    focusedBackgroundColor: "transparent",
    height: 4,
    id: "exit-select",
    marginTop: 1,
    options: [
      { description: "", name: "Resume session", value: "resume" },
      { description: "", name: "Edit session", value: "edit" },
      { description: "", name: "Delete session", value: "delete" },
      { description: "", name: "Back to home", value: "home" },
    ],
    selectedBackgroundColor: "#334155",
    selectedTextColor: "#38bdf8",
    showDescription: false,
    textColor: "#e2e8f0",
    width: 40,
  });

const createEventPromise = (
  select: SelectRenderable,
  renderer: CliRenderer
): Promise<ExitChoice> => {
  const promiseBody = (resolve: (value: ExitChoice) => void) => {
    const handleSelect = (_index: number, option: { value: string }) => {
      select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
      renderer.keyInput.off("keypress", handleKeypress);
      select.blur();
      hideFooter(renderer);
      clearLayout(renderer);
      resolve(option.value as ExitChoice);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
        renderer.keyInput.off("keypress", handleKeypress);
        select.blur();
        hideFooter(renderer);
        clearLayout(renderer);
        resolve("home");
      }
    };

    select.focus();
    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  };

  // eslint-disable-next-line promise/avoid-new -- Needed for event-driven UI pattern
  return new Promise(promiseBody);
};

const setupExitUI = (
  renderer: CliRenderer,
  session: Session,
  hasChanges: boolean,
  reposWithChanges: RepoSpec[]
): Promise<ExitChoice> => {
  clearLayout(renderer);
  const { content } = createBaseLayout(renderer, "Session complete");

  (content as { add: (item: unknown) => void }).add(
    getSessionInfo(renderer, session)
  );

  if (hasChanges && reposWithChanges.length > 0) {
    addChangesWarning(content, renderer, reposWithChanges);
  }

  (content as { add: (item: unknown) => void }).add(getQuestion(renderer));
  const select = getSelect(renderer);
  (content as { add: (item: unknown) => void }).add(select);

  showFooter(renderer, content, {
    back: true,
    navigate: true,
    select: true,
  });

  return createEventPromise(select, renderer);
};

export function showExitPrompt(
  renderer: CliRenderer,
  session: Session
): Promise<ExitChoice> {
  return setupExitUI(renderer, session, false, []);
}

export function showExitPromptWithChanges(
  renderer: CliRenderer,
  session: Session,
  reposWithChanges: RepoSpec[]
): Promise<ExitChoice> {
  return setupExitUI(renderer, session, true, reposWithChanges);
}

export async function handleSmartExit(
  renderer: CliRenderer,
  session: Session
): Promise<{ action: ExitChoice }> {
  const { hasChanges, reposWithChanges } = await sessionHasUncommittedChanges(
    session.repos,
    session.path
  );

  if (hasChanges) {
    const choice = await showExitPromptWithChanges(
      renderer,
      session,
      reposWithChanges
    );
    return { action: choice };
  }

  const choice = await showExitPrompt(renderer, session);
  return { action: choice };
}
