import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export type NukeConfirmChoice = "confirm" | "cancel";

export function showNukeConfirm(
  renderer: CliRenderer,
  sessionCount: number
): Promise<NukeConfirmChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Delete all sessions");

    const countInfo = new TextRenderable(renderer, {
      content: `${sessionCount} session${sessionCount === 1 ? "" : "s"} will be deleted`,
      fg: "#38bdf8",
      id: "count-info",
      marginBottom: 1,
    });
    content.add(countInfo);

    const warning = new TextRenderable(renderer, {
      content: "This permanently deletes all sessions, history, and data.",
      fg: "#f59e0b",
      id: "warning",
      marginBottom: 1,
    });
    content.add(warning);

    const question = new TextRenderable(renderer, {
      content: "Are you sure you want to delete all sessions?",
      fg: "#e2e8f0",
      id: "question",
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      backgroundColor: "transparent",
      focusedBackgroundColor: "transparent",
      height: 2,
      id: "nuke-confirm-select",
      marginTop: 1,
      options: [
        { description: "", name: "Cancel", value: "cancel" },
        { description: "", name: "Delete all sessions", value: "confirm" },
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
      resolve(option.value as NukeConfirmChoice);
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
