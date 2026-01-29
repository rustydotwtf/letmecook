import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";
import { createBaseLayout, clearLayout } from "./renderer";
import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";

export type NukeConfirmChoice = "confirm" | "cancel";

export function showNukeConfirm(
  renderer: CliRenderer,
  sessionCount: number,
): Promise<NukeConfirmChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Delete all sessions");

    const countInfo = new TextRenderable(renderer, {
      id: "count-info",
      content: `${sessionCount} session${sessionCount === 1 ? "" : "s"} will be deleted`,
      fg: "#38bdf8",
      marginBottom: 1,
    });
    content.add(countInfo);

    const warning = new TextRenderable(renderer, {
      id: "warning",
      content: "This permanently deletes all sessions, history, and data.",
      fg: "#f59e0b",
      marginBottom: 1,
    });
    content.add(warning);

    const question = new TextRenderable(renderer, {
      id: "question",
      content: "Are you sure you want to delete all sessions?",
      fg: "#e2e8f0",
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      id: "nuke-confirm-select",
      width: 38,
      height: 2,
      options: [
        { name: "Cancel", description: "", value: "cancel" },
        { name: "Delete all sessions", description: "", value: "confirm" },
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
      navigate: true,
      select: true,
      back: true,
    });

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
