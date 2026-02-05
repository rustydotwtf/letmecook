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
import { isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export type DeleteConfirmChoice = "confirm" | "cancel";

type CleanupFn = () => void;

interface ConfirmSetup {
  cleanup: CleanupFn;
  select: SelectRenderable;
}

function createDeleteConfirmUI(
  renderer: CliRenderer,
  session: Session,
  content: Renderable
): ConfirmSetup {
  const sessionInfo = new TextRenderable(renderer, {
    content: `Session: ${session.name}`,
    fg: "#38bdf8",
    id: "session-info",
    marginBottom: 1,
  });
  content.add(sessionInfo);

  const warning = new TextRenderable(renderer, {
    content: "This permanently deletes the session and its files.",
    fg: "#f59e0b",
    id: "warning",
    marginBottom: 1,
  });
  content.add(warning);

  const question = new TextRenderable(renderer, {
    content: "Are you sure you want to delete this session?",
    fg: "#e2e8f0",
    id: "question",
  });
  content.add(question);

  const select = new SelectRenderable(renderer, {
    backgroundColor: "transparent",
    focusedBackgroundColor: "transparent",
    height: 2,
    id: "delete-confirm-select",
    marginTop: 1,
    options: [
      { description: "", name: "Cancel", value: "cancel" },
      { description: "", name: "Delete session", value: "confirm" },
    ],
    selectedBackgroundColor: "#334155",
    selectedTextColor: "#38bdf8",
    showDescription: false,
    textColor: "#e2e8f0",
    width: 38,
  });
  content.add(select);

  const cleanup = (): void => {
    select.blur();
    hideFooter(renderer);
    clearLayout(renderer);
  };

  return { cleanup, select };
}

function waitForSelection(
  select: SelectRenderable,
  renderer: CliRenderer,
  cleanup: CleanupFn
): Promise<DeleteConfirmChoice> {
  // eslint-disable-next-line github/no-then, promise/avoid-new
  return new Promise<DeleteConfirmChoice>((resolve) => {
    const handleSelect = (_index: number, option: { value: string }): void => {
      select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
      renderer.keyInput.off("keypress", handleKeypress);
      cleanup();
      resolve(option.value as DeleteConfirmChoice);
    };

    const handleKeypress = (key: KeyEvent): void => {
      if (isEscape(key)) {
        select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
        renderer.keyInput.off("keypress", handleKeypress);
        cleanup();
        resolve("cancel");
      }
    };

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}

export function showDeleteConfirm(
  renderer: CliRenderer,
  session: Session
): Promise<DeleteConfirmChoice> {
  clearLayout(renderer);

  const { content } = createBaseLayout(renderer, "Delete session");
  const { cleanup, select } = createDeleteConfirmUI(renderer, session, content);

  select.focus();

  showFooter(renderer, content, {
    back: true,
    navigate: true,
    select: true,
  });

  return waitForSelection(select, renderer, cleanup);
}
