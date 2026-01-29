import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import type { Session, ExitChoice, RepoSpec } from "../types";

import { sessionHasUncommittedChanges } from "../git";
import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export function showExitPrompt(
  renderer: CliRenderer,
  session: Session
): Promise<ExitChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Session complete");

    // Session info
    const sessionInfo = new TextRenderable(renderer, {
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      id: "session-info",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    // Question
    const question = new TextRenderable(renderer, {
      content: "What would you like to do?",
      fg: "#e2e8f0",
      id: "question",
      marginBottom: 1,
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      backgroundColor: "transparent",
      focusedBackgroundColor: "transparent",
      height: 4,
      id: "exit-select",
      marginTop: 1,
      options: [
        { description: "", name: "Resume session", value: "resume" },
        { description: "", name: "Edit session", value: "edit" },
        { description: "", name: "Delete session", value: "delete" },
        { description: "", name: "Back to home", value: "home" },
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
      resolve(option.value as ExitChoice);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        cleanup();
        resolve("home");
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

export function showExitPromptWithChanges(
  renderer: CliRenderer,
  session: Session,
  reposWithChanges: RepoSpec[]
): Promise<ExitChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Session complete");

    // Session info
    const sessionInfo = new TextRenderable(renderer, {
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      id: "session-info",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    // Warning about uncommitted changes
    const warning = new TextRenderable(renderer, {
      content: "⚠️  Uncommitted changes detected:",
      fg: "#f59e0b",
      id: "warning",
      marginBottom: 0,
    });
    content.add(warning);

    const changedReposList = new TextRenderable(renderer, {
      content: reposWithChanges.map((r) => `   - ${r.dir}/`).join("\n"),
      fg: "#fbbf24",
      id: "changed-repos",
      marginBottom: 1,
    });
    content.add(changedReposList);

    // Question
    const question = new TextRenderable(renderer, {
      content: "What would you like to do?",
      fg: "#e2e8f0",
      id: "question",
      marginBottom: 1,
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      backgroundColor: "transparent",
      focusedBackgroundColor: "transparent",
      height: 4,
      id: "exit-select",
      marginTop: 1,
      options: [
        { description: "", name: "Resume session", value: "resume" },
        { description: "", name: "Edit session", value: "edit" },
        { description: "", name: "Delete session", value: "delete" },
        { description: "", name: "Back to home", value: "home" },
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
      resolve(option.value as ExitChoice);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        cleanup();
        resolve("home");
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

export async function handleSmartExit(
  renderer: CliRenderer,
  session: Session
): Promise<{ action: ExitChoice }> {
  const { hasChanges, reposWithChanges } = await sessionHasUncommittedChanges(
    session.repos,
    session.path
  );

  // Always prompt - if there are uncommitted changes, show warning
  if (hasChanges) {
    const choice = await showExitPromptWithChanges(
      renderer,
      session,
      reposWithChanges
    );
    return { action: choice };
  }

  // No uncommitted changes - show simple exit prompt
  const choice = await showExitPrompt(renderer, session);
  return { action: choice };
}
