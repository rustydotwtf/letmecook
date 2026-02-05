import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
  type Renderable,
} from "@opentui/core";

import type { Session } from "../types";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape, isArrowUp, isArrowDown } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";
import { buildSessionOptions, type SessionOption } from "./session-options";

export type MainMenuAction =
  | { type: "chat" }
  | { type: "new-session" }
  | { type: "resume"; session: Session }
  | { type: "delete"; session: Session }
  | { type: "nuke" }
  | { type: "quit" };

function buildLayout(renderer: CliRenderer, sessions: Session[]) {
  clearLayout(renderer);
  return buildLayoutContent(renderer, sessions);
}

function buildLayoutContent(renderer: CliRenderer, sessions: Session[]) {
  const { content } = createBaseLayout(renderer);
  content.add(createSessionsHeader(renderer, sessions));

  const options = buildSessionOptions(sessions);
  const select = createSelectRenderer(renderer, sessions, options);

  if (select) {
    content.add(select);
    select.focus();
  } else {
    content.add(createEmptySessionText(renderer));
  }

  showMainMenuFooter(renderer, content, sessions);

  return { select };
}

function createSessionsHeader(renderer: CliRenderer, sessions: Session[]) {
  return new TextRenderable(renderer, {
    content: `Sessions (${sessions.length})`,
    fg: "#e2e8f0",
    id: "sessions-header",
    marginBottom: 1,
  });
}

function createSelectRenderer(
  renderer: CliRenderer,
  sessions: Session[],
  options: SessionOption[]
): SelectRenderable | null {
  if (options.length === 0) {
    return null;
  }

  return new SelectRenderable(renderer, {
    backgroundColor: "transparent",
    descriptionColor: "#64748b",
    focusedBackgroundColor: "transparent",
    height: Math.min(sessions.length * 2, 10),
    id: "session-list",
    options,
    selectedBackgroundColor: "#334155",
    selectedDescriptionColor: "#94a3b8",
    selectedTextColor: "#38bdf8",
    showDescription: true,
    textColor: "#e2e8f0",
    width: 65,
  });
}

function createEmptySessionText(renderer: CliRenderer): TextRenderable {
  return new TextRenderable(renderer, {
    content: "No sessions yet. Start one with [n].",
    fg: "#94a3b8",
    id: "empty-sessions",
    marginBottom: 1,
  });
}

function showMainMenuFooter(
  renderer: CliRenderer,
  content: Renderable,
  sessions: Session[]
): void {
  const footerActions = [
    "c Chat",
    ...(sessions.length > 0
      ? ["Enter Open", "n New", "d Delete", "a Nuke"]
      : ["n New"]),
    "q Quit",
  ];

  showFooter(renderer, content, {
    back: false,
    custom: footerActions,
    navigate: sessions.length > 0,
    select: false,
  });
}

function handleArrowNavigation(
  key: KeyEvent,
  sessions: Session[],
  selectedIndex: number
): number {
  if (sessions.length === 0) {
    return selectedIndex;
  }

  if (isArrowUp(key)) {
    return Math.max(0, selectedIndex - 1);
  }

  if (isArrowDown(key)) {
    return Math.min(sessions.length - 1, selectedIndex + 1);
  }

  return selectedIndex;
}

function handleDeleteKey(
  sessions: Session[],
  selectedIndex: number
): MainMenuAction | null {
  if (sessions.length === 0) {
    return null;
  }

  const session = sessions[selectedIndex];
  if (!session) {
    return null;
  }

  return { session, type: "delete" as const };
}

function handleChatKey(): MainMenuAction {
  return { type: "chat" as const };
}

function handleNewSessionKey(): MainMenuAction {
  return { type: "new-session" as const };
}

function handleNukeKey(sessions: Session[]): MainMenuAction | null {
  if (sessions.length === 0) {
    return null;
  }
  return { type: "nuke" as const };
}

function handleQuitKey(): MainMenuAction {
  return { type: "quit" as const };
}

function getKeyPressHandler(
  keyName: string,
  sessions: Session[],
  selectedIndex: number
): MainMenuAction | null {
  switch (keyName) {
    case "d": {
      return handleDeleteKey(sessions, selectedIndex);
    }
    case "c": {
      return handleChatKey();
    }
    case "n": {
      return handleNewSessionKey();
    }
    case "a": {
      return handleNukeKey(sessions);
    }
    case "q": {
      return handleQuitKey();
    }
    default: {
      return null;
    }
  }
}

function processKeyPress(
  key: KeyEvent,
  sessions: Session[],
  selectedIndex: number
): MainMenuAction | null {
  if (handleArrowNavigation(key, sessions, selectedIndex) !== selectedIndex) {
    return null;
  }
  const action = getKeyPressHandler(key.name, sessions, selectedIndex);
  if (action !== null) {
    return action;
  }
  return isEscape(key) ? handleQuitKey() : null;
}

export function showMainMenu(
  renderer: CliRenderer,
  sessions: Session[]
): Promise<MainMenuAction> {
  // Event-driven pattern requires Promise, cannot use async/await
  // eslint-disable-next-line promise/avoid-new
  return new Promise((resolve) => {
    const { select } = buildLayout(renderer, sessions);
    let selectedIndex = 0;

    const cleanup = () => {
      if (select) {
        select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
        select.blur();
      }
      renderer.keyInput.off("keypress", handleKeypress);
      hideFooter(renderer);
      clearLayout(renderer);
    };

    const handleSelect = (_index: unknown, option: { value: Session }) => {
      cleanup();
      resolve({ session: option.value, type: "resume" as const });
    };

    const handleKeypress = (key: KeyEvent) => {
      const action = processKeyPress(key, sessions, selectedIndex);
      if (action) {
        cleanup();
        resolve(action);
      } else {
        const arrowIndex = handleArrowNavigation(key, sessions, selectedIndex);
        selectedIndex = arrowIndex;
      }
    };

    if (select) {
      select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    }

    renderer.keyInput.on("keypress", handleKeypress);
  });
}
