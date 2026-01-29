import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import type { Session } from "../types";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";
import { formatRepoList } from "./common/repo-formatter";
import { createBaseLayout, clearLayout } from "./renderer";

export type SessionDetailsAction = "resume" | "edit" | "add-repos" | "back";

export function showSessionDetails(
  renderer: CliRenderer,
  session: Session
): Promise<SessionDetailsAction> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Session details");

    const sessionInfo = new TextRenderable(renderer, {
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      id: "session-info",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    const goalText = session.goal ? session.goal : "(none)";
    const goalInfo = new TextRenderable(renderer, {
      content: `Goal: ${goalText}`,
      fg: "#94a3b8",
      id: "goal-info",
      marginBottom: 1,
    });
    content.add(goalInfo);

    const reposText = formatRepoList(session.repos, { prefix: "  " });

    const reposInfo = new TextRenderable(renderer, {
      content: `Repositories:\n${reposText || "  (none)"}`,
      fg: "#94a3b8",
      id: "repos-info",
      marginBottom: 1,
    });
    content.add(reposInfo);

    const select = new SelectRenderable(renderer, {
      backgroundColor: "transparent",
      focusedBackgroundColor: "transparent",
      height: 3,
      id: "session-details-select",
      marginTop: 1,
      options: [
        { description: "", name: "Resume session", value: "resume" },
        { description: "", name: "Edit settings", value: "edit" },
        { description: "", name: "Back", value: "back" },
      ],
      selectedBackgroundColor: "#334155",
      selectedTextColor: "#38bdf8",
      showDescription: false,
      textColor: "#e2e8f0",
      width: 40,
    });
    content.add(select);

    select.focus();

    const handleSelect = (_index: number, option: { value: string }) => {
      cleanup();
      resolve(option.value as SessionDetailsAction);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        cleanup();
        resolve("back");
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
