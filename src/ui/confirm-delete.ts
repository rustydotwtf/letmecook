import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";
import { createBaseLayout, clearLayout } from "./renderer";
import type { Session } from "../types";
import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";

export type DeleteConfirmChoice = "confirm" | "cancel";

export function showDeleteConfirm(
  renderer: CliRenderer,
  session: Session,
): Promise<DeleteConfirmChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Delete session");

    const sessionInfo = new TextRenderable(renderer, {
      id: "session-info",
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    const warning = new TextRenderable(renderer, {
      id: "warning",
      content: "This permanently deletes the session and its files.",
      fg: "#f59e0b",
      marginBottom: 1,
    });
    content.add(warning);

    const question = new TextRenderable(renderer, {
      id: "question",
      content: "Are you sure you want to delete this session?",
      fg: "#e2e8f0",
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      id: "delete-confirm-select",
      width: 38,
      height: 2,
      options: [
        { name: "Cancel", description: "", value: "cancel" },
        { name: "Delete session", description: "", value: "confirm" },
      ],
      showDescription: false,
      backgroundColor: "transparent",
      focusedBackgroundColor: "transparent",
      selectedBackgroundColor: "#334155",
      textColor: "#e2e8f0",
      selectedTextColor: "#38bdf8",
      marginTop: 1,
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
      navigate: true,
      select: true,
      back: true,
    });

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
