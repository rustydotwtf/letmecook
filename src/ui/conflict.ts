import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";
import { createBaseLayout, clearLayout } from "./renderer";
import type { Session, ConflictChoice } from "../types";
import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return then.toLocaleDateString();
}

export function showConflictPrompt(
  renderer: CliRenderer,
  existingSession: Session,
): Promise<ConflictChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Existing session found");

    // Session info
    const sessionInfo = new TextRenderable(renderer, {
      id: "session-info",
      content: `Session: ${existingSession.name}`,
      fg: "#38bdf8",
    });
    content.add(sessionInfo);

    const timeInfo = new TextRenderable(renderer, {
      id: "time-info",
      content: `Created: ${formatTimeAgo(existingSession.created)}`,
      fg: "#94a3b8",
    });
    content.add(timeInfo);

    const reposInfo = new TextRenderable(renderer, {
      id: "repos-info",
      content: `Repos: ${existingSession.repos.map((r) => `${r.owner}/${r.name}`).join(", ")}`,
      fg: "#94a3b8",
    });
    content.add(reposInfo);

    if (existingSession.goal) {
      const goalInfo = new TextRenderable(renderer, {
        id: "goal-info",
        content: `Goal: ${existingSession.goal}`,
        fg: "#94a3b8",
        marginBottom: 1,
      });
      content.add(goalInfo);
    }

    // Question
    const question = new TextRenderable(renderer, {
      id: "question",
      content: "\nWhat would you like to do?",
      fg: "#e2e8f0",
      marginTop: 1,
    });
    content.add(question);

    // Options
    const select = new SelectRenderable(renderer, {
      id: "conflict-select",
      width: 40,
      height: 4,
      options: [
        { name: "Resume existing session", description: "", value: "resume" },
        { name: "Nuke it and start fresh", description: "", value: "nuke" },
        { name: "Create new session (keep old)", description: "", value: "new" },
        { name: "Cancel", description: "", value: "cancel" },
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
      resolve(option.value as ConflictChoice);
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
