import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";
import { createBaseLayout, clearLayout } from "./renderer";
import type { RepoSpec } from "../types";
import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";

export type RecloneChoice = "reclone" | "skip";

export function showReclonePrompt(renderer: CliRenderer, repo: RepoSpec): Promise<RecloneChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Update issue");

    const repoInfo = new TextRenderable(renderer, {
      id: "repo-info",
      content: `${repo.owner}/${repo.name}`,
      fg: "#38bdf8",
      marginBottom: 1,
    });
    content.add(repoInfo);

    const warning = new TextRenderable(renderer, {
      id: "warning",
      content: "We had issues updating this repo.",
      fg: "#f59e0b",
      marginBottom: 0,
    });
    content.add(warning);

    const question = new TextRenderable(renderer, {
      id: "question",
      content: "Wipe and reclone it?",
      fg: "#e2e8f0",
      marginBottom: 1,
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      id: "reclone-select",
      width: 24,
      height: 2,
      options: [
        { name: "Reclone", description: "", value: "reclone" },
        { name: "Skip", description: "", value: "skip" },
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
      resolve(option.value as RecloneChoice);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        cleanup();
        resolve("skip");
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
      custom: ["Esc Skip"],
    });

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
