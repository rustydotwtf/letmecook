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

export function showSessionActions(
  renderer: CliRenderer,
  session: Session
): Promise<SessionAction> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Session paused");

    // Session info
    const sessionInfo = new TextRenderable(renderer, {
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      id: "session-info",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    // Show repos
    const reposText = formatRepoList(session.repos, {
      prefix: "  ",
      showMarkers: true,
    });
    const reposInfo = new TextRenderable(renderer, {
      content: `Repositories:\n${reposText}`,
      fg: "#94a3b8",
      id: "repos-info",
      marginBottom: 1,
    });
    content.add(reposInfo);

    // Question
    const question = new TextRenderable(renderer, {
      content: "What would you like to do?",
      fg: "#e2e8f0",
      id: "question",
    });
    content.add(question);

    // Options
    const select = new SelectRenderable(renderer, {
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
    content.add(select);

    // Instructions
    const instructions = new TextRenderable(renderer, {
      content: "\n[Enter] Select   [Esc] Exit session",
      fg: "#64748b",
      id: "instructions",
      marginTop: 1,
    });
    content.add(instructions);

    select.focus();

    const handleSelect = (_index: number, option: { value: string }) => {
      cleanup();
      resolve(option.value as SessionAction);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (key.name === "escape") {
        cleanup();
        resolve("exit");
      }
    };

    const cleanup = () => {
      select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
      renderer.keyInput.off("keypress", handleKeypress);
      select.blur();
      clearLayout(renderer);
    };

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
