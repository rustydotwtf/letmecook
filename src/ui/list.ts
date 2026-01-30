import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import type { Session } from "../types";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape, isArrowUp, isArrowDown } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";
import { buildSessionOptions } from "./session-options";

export type ListAction =
  | { type: "resume"; session: Session }
  | { type: "delete"; session: Session }
  | { type: "nuke" }
  | { type: "quit" };

function handleEmptySessions(
  renderer: CliRenderer,
  resolve: (action: ListAction) => void
) {
  const { content } = createBaseLayout(renderer, "Sessions (0)");

  const emptyText = new TextRenderable(renderer, {
    content: "No sessions found.\n\nCreate one with: letmecook owner/repo",
    fg: "#94a3b8",
    id: "empty",
  });
  content.add(emptyText);

  const handleKeypress = (key: KeyEvent) => {
    if (key.name === "q" || isEscape(key)) {
      renderer.keyInput.off("keypress", handleKeypress);
      hideFooter(renderer);
      clearLayout(renderer);
      resolve({ type: "quit" });
    }
  };

  showFooter(renderer, content, {
    back: false,
    navigate: false,
    quit: true,
    select: false,
  });

  renderer.keyInput.on("keypress", handleKeypress);
}

function createCleanup(
  renderer: CliRenderer,
  select: SelectRenderable,
  handleSelect: (index: number, option: { value: Session }) => void,
  handleKeypress: (key: KeyEvent) => void
): () => void {
  return () => {
    select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.off("keypress", handleKeypress);
    select.blur();
    hideFooter(renderer);
    clearLayout(renderer);
  };
}

function updateNavigation(
  key: KeyEvent,
  sessions: Session[],
  current: number
): number {
  if (isArrowUp(key)) {
    return Math.max(0, current - 1);
  }
  if (isArrowDown(key)) {
    return Math.min(sessions.length - 1, current + 1);
  }
  return current;
}

function handleDeleteKey(
  sessions: Session[],
  index: number,
  cleanup: () => void,
  resolve: (action: ListAction) => void
): boolean {
  const session = sessions[index];
  if (!session) {
    return false;
  }
  cleanup();
  resolve({ session, type: "delete" });
  return true;
}

function handleQuitKey(
  cleanup: () => void,
  resolve: (action: ListAction) => void
): boolean {
  cleanup();
  resolve({ type: "quit" });
  return true;
}

function handleNukeKey(
  cleanup: () => void,
  resolve: (action: ListAction) => void
): boolean {
  cleanup();
  resolve({ type: "nuke" });
  return true;
}

function handleActionKeys(
  key: KeyEvent,
  sessions: Session[],
  index: number,
  cleanup: () => void,
  resolve: (action: ListAction) => void
): boolean {
  if (key.name === "d") {
    return handleDeleteKey(sessions, index, cleanup, resolve);
  }
  if (key.name === "a") {
    return handleNukeKey(cleanup, resolve);
  }
  if (key.name === "q" || isEscape(key)) {
    return handleQuitKey(cleanup, resolve);
  }
  return false;
}

function createSelect(
  renderer: CliRenderer,
  sessions: Session[]
): SelectRenderable {
  const { content } = createBaseLayout(
    renderer,
    `Sessions (${sessions.length})`
  );

  const select = new SelectRenderable(renderer, {
    backgroundColor: "transparent",
    descriptionColor: "#64748b",
    focusedBackgroundColor: "transparent",
    height: Math.min(sessions.length * 2, 12),
    id: "session-list",
    options: buildSessionOptions(sessions),
    selectedBackgroundColor: "#334155",
    selectedDescriptionColor: "#94a3b8",
    selectedTextColor: "#38bdf8",
    showDescription: true,
    textColor: "#e2e8f0",
    width: 65,
  });
  content.add(select);

  showFooter(renderer, content, {
    back: false,
    custom: ["Enter Resume", "d Delete", "a Nuke", "q Quit"],
    navigate: true,
    select: false,
  });

  return select;
}

function handlePopulatedSessions(
  renderer: CliRenderer,
  sessions: Session[],
  resolve: (action: ListAction) => void
) {
  const select = createSelect(renderer, sessions);
  select.focus();

  let selectedIndex = 0;
  let cleanup: () => void;

  const handleSelect = (_index: number, option: { value: Session }) => {
    cleanup();
    resolve({ session: option.value, type: "resume" });
  };

  const handleKeypress = (key: KeyEvent) => {
    const updated = updateNavigation(key, sessions, selectedIndex);
    if (updated !== selectedIndex) {
      selectedIndex = updated;
      return;
    }
    handleActionKeys(key, sessions, selectedIndex, cleanup, resolve);
  };

  cleanup = createCleanup(renderer, select, handleSelect, handleKeypress);

  select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
  renderer.keyInput.on("keypress", handleKeypress);
}

export function showSessionList(
  renderer: CliRenderer,
  sessions: Session[]
): Promise<ListAction> {
  clearLayout(renderer);

  if (sessions.length === 0) {
    // oxlint-disable-next-line promise/avoid-new
    return new Promise((resolve) => {
      handleEmptySessions(renderer, resolve);
    });
  }

  // oxlint-disable-next-line promise/avoid-new
  return new Promise((resolve) => {
    handlePopulatedSessions(renderer, sessions, resolve);
  });
}
