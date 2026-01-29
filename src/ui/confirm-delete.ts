import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import  { type Session } from "../types";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export type DeleteConfirmChoice = "confirm" | "cancel";

export function showDeleteConfirm(
  renderer: CliRenderer,
  session: Session
): Promise<DeleteConfirmChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Delete session");

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
        { name: "Cancel", description: "", value: "cancel" },
        { name: "Delete session", description: "", value: "confirm" },
      ],
      selectedBackgroundColor: "#334155",
      selectedTextColor: "#38bdf8",
      showDescription: false,
      textColor: "#e2e8f0",
      width: 38,
    });
    content.add(select);

    select.focus();

    const handleSelect = (_index: number, option: { value: string }) => {
      cleanup();
      resolve(option.value as DeleteConfirmChoice);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        cleanup();
        resolve("cancel");
      }
    };

    const cleanup = () => {
      select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
      renderer.keyInput.off("keypress", handleKeypress);
      select.blur();
      hideFooter(renderer);
      clearLayout(renderer);
    };

    showFooter(renderer, content, {
      back: true,
      navigate: true,
      select: true,
    });

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
