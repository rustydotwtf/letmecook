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
import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";

export type SessionDetailsAction = "resume" | "edit" | "add-repos" | "back";

export function showSessionDetails(
  renderer: CliRenderer,
  session: Session,
): Promise<SessionDetailsAction> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Session details");

    const sessionInfo = new TextRenderable(renderer, {
      id: "session-info",
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    const goalText = session.goal ? session.goal : "(none)";
    const goalInfo = new TextRenderable(renderer, {
      id: "goal-info",
      content: `Goal: ${goalText}`,
      fg: "#94a3b8",
      marginBottom: 1,
    });
    content.add(goalInfo);

    const reposText = formatRepoList(session.repos, { prefix: "  " });

    const reposInfo = new TextRenderable(renderer, {
      id: "repos-info",
      content: `Repositories:\n${reposText || "  (none)"}`,
      fg: "#94a3b8",
      marginBottom: 1,
    });
    content.add(reposInfo);

    const select = new SelectRenderable(renderer, {
      id: "session-details-select",
      width: 40,
      height: 3,
      options: [
        { name: "Resume session", description: "", value: "resume" },
        { name: "Edit settings", description: "", value: "edit" },
        { name: "Back", description: "", value: "back" },
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
      navigate: true,
      select: true,
      back: true,
    });

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
