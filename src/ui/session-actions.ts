import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";
import { createBaseLayout, clearLayout } from "./renderer";
import type { Session } from "../types";
import { formatRepoList } from "./common/repo-formatter";

export type SessionAction = "continue" | "add-repos" | "exit";

export function showSessionActions(
  renderer: CliRenderer,
  session: Session,
): Promise<SessionAction> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Session paused");

    // Session info
    const sessionInfo = new TextRenderable(renderer, {
      id: "session-info",
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    // Show repos
    const reposText = formatRepoList(session.repos, { showMarkers: true, prefix: "  " });
    const reposInfo = new TextRenderable(renderer, {
      id: "repos-info",
      content: `Repositories:\n${reposText}`,
      fg: "#94a3b8",
      marginBottom: 1,
    });
    content.add(reposInfo);

    // Question
    const question = new TextRenderable(renderer, {
      id: "question",
      content: "What would you like to do?",
      fg: "#e2e8f0",
    });
    content.add(question);

    // Options
    const select = new SelectRenderable(renderer, {
      id: "action-select",
      width: 40,
      height: 3,
      options: [
        { name: "Continue session", description: "Re-launch claude", value: "continue" },
        {
          name: "Add repositories",
          description: "Clone more repos to this session",
          value: "add-repos",
        },
        { name: "Exit session", description: "Choose to keep or delete session", value: "exit" },
      ],
      showDescription: true,
      backgroundColor: "transparent",
      focusedBackgroundColor: "transparent",
      selectedBackgroundColor: "#334155",
      textColor: "#e2e8f0",
      selectedTextColor: "#38bdf8",
      descriptionColor: "#64748b",
      selectedDescriptionColor: "#94a3b8",
      marginTop: 1,
    });
    content.add(select);

    // Instructions
    const instructions = new TextRenderable(renderer, {
      id: "instructions",
      content: "\n[Enter] Select   [Esc] Exit session",
      fg: "#64748b",
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
