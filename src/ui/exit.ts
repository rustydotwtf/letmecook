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
      id: "session-info",
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    // Question
    const question = new TextRenderable(renderer, {
      id: "question",
      content: "What would you like to do?",
      fg: "#e2e8f0",
      marginBottom: 1,
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      id: "exit-select",
      width: 40,
      height: 4,
      options: [
        { name: "Resume session", description: "", value: "resume" },
        { name: "Edit session", description: "", value: "edit" },
        { name: "Delete session", description: "", value: "delete" },
        { name: "Back to home", description: "", value: "home" },
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
      navigate: true,
      select: true,
      back: true,
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
      id: "session-info",
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    // Warning about uncommitted changes
    const warning = new TextRenderable(renderer, {
      id: "warning",
      content: "⚠️  Uncommitted changes detected:",
      fg: "#f59e0b",
      marginBottom: 0,
    });
    content.add(warning);

    const changedReposList = new TextRenderable(renderer, {
      id: "changed-repos",
      content: reposWithChanges.map((r) => `   - ${r.dir}/`).join("\n"),
      fg: "#fbbf24",
      marginBottom: 1,
    });
    content.add(changedReposList);

    // Question
    const question = new TextRenderable(renderer, {
      id: "question",
      content: "What would you like to do?",
      fg: "#e2e8f0",
      marginBottom: 1,
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      id: "exit-select",
      width: 40,
      height: 4,
      options: [
        { name: "Resume session", description: "", value: "resume" },
        { name: "Edit session", description: "", value: "edit" },
        { name: "Delete session", description: "", value: "delete" },
        { name: "Back to home", description: "", value: "home" },
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
      navigate: true,
      select: true,
      back: true,
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
