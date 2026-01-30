import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
  type BoxRenderable,
} from "@opentui/core";

import type { Session, ConflictChoice } from "../types";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

function formatTimeAgo(date: string): string {
  const { dateObj, diffMins, diffHours, diffDays } = calculateTimeDiff(date);

  if (diffMins < 1) {
    return "just now";
  }
  if (diffMins < 60) {
    return formatTimeValue(diffMins, "minute");
  }
  if (diffHours < 24) {
    return formatTimeValue(diffHours, "hour");
  }
  if (diffDays < 7) {
    return formatTimeValue(diffDays, "day");
  }
  return dateObj.toLocaleDateString();
}

function calculateTimeDiff(date: string) {
  const now = new Date();
  const dateObj = new Date(date);
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  return { dateObj, diffDays, diffHours, diffMins };
}

function formatTimeValue(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

function buildSessionInfo(
  renderer: CliRenderer,
  content: BoxRenderable,
  session: Session
) {
  const sessionInfo = new TextRenderable(renderer, {
    content: `Session: ${session.name}`,
    fg: "#38bdf8",
    id: "session-info",
  });
  content.add(sessionInfo);

  const timeInfo = new TextRenderable(renderer, {
    content: `Created: ${formatTimeAgo(session.created)}`,
    fg: "#94a3b8",
    id: "time-info",
  });
  content.add(timeInfo);

  const reposInfo = new TextRenderable(renderer, {
    content: `Repos: ${session.repos.map((r) => `${r.owner}/${r.name}`).join(", ")}`,
    fg: "#94a3b8",
    id: "repos-info",
  });
  content.add(reposInfo);

  if (session.goal) {
    const goalInfo = new TextRenderable(renderer, {
      content: `Goal: ${session.goal}`,
      fg: "#94a3b8",
      id: "goal-info",
      marginBottom: 1,
    });
    content.add(goalInfo);
  }
}

function buildQuestionAndSelect(
  renderer: CliRenderer,
  content: BoxRenderable
): SelectRenderable {
  const question = new TextRenderable(renderer, {
    content: "\nWhat would you like to do?",
    fg: "#e2e8f0",
    id: "question",
    marginTop: 1,
  });
  content.add(question);

  const select = new SelectRenderable(renderer, {
    backgroundColor: "transparent",
    focusedBackgroundColor: "transparent",
    height: 4,
    id: "conflict-select",
    marginTop: 1,
    options: [
      { description: "", name: "Resume existing session", value: "resume" },
      { description: "", name: "Nuke it and start fresh", value: "nuke" },
      {
        description: "",
        name: "Create new session (keep old)",
        value: "new",
      },
      { description: "", name: "Cancel", value: "cancel" },
    ],
    selectedBackgroundColor: "#334155",
    selectedTextColor: "#38bdf8",
    showDescription: false,
    textColor: "#e2e8f0",
    width: 40,
  });
  content.add(select);
  return select;
}

export function showConflictPrompt(
  renderer: CliRenderer,
  existingSession: Session
): Promise<ConflictChoice> {
  clearLayout(renderer);

  const { content } = createBaseLayout(renderer, "Existing session found");

  buildSessionInfo(renderer, content, existingSession);
  const select = buildQuestionAndSelect(renderer, content);

  // oxlint-disable-next-line promise/avoid-new
  return new Promise<ConflictChoice>((resolve) => {
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
      back: true,
      navigate: true,
      select: true,
    });

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
