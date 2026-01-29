import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import type { BackgroundProcess } from "../process-registry";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export type QuitWarningChoice = "continue" | "kill" | "cancel";

export function showQuitWarning(
  renderer: CliRenderer,
  processes: BackgroundProcess[]
): Promise<QuitWarningChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(
      renderer,
      "Background processes running"
    );

    const warning = new TextRenderable(renderer, {
      content: `${processes.length} background process${processes.length > 1 ? "es" : ""} still running:`,
      fg: "#f59e0b",
      id: "warning",
      marginBottom: 1,
    });
    content.add(warning);

    // List the running processes
    for (const [i, proc] of processes.entries()) {
      const processInfo = new TextRenderable(renderer, {
        content: `  • ${proc.description}`,
        fg: "#94a3b8",
        id: `process-${i}`,
      });
      content.add(processInfo);
    }

    const question = new TextRenderable(renderer, {
      content: "What would you like to do?",
      fg: "#e2e8f0",
      id: "question",
      marginTop: 1,
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      backgroundColor: "transparent",
      focusedBackgroundColor: "transparent",
      height: 3,
      id: "quit-warning-select",
      marginTop: 1,
      options: [
        { description: "", name: "Keep running & quit", value: "continue" },
        { description: "", name: "Kill all & quit", value: "kill" },
        { description: "", name: "Cancel", value: "cancel" },
      ],
      selectedBackgroundColor: "#334155",
      selectedTextColor: "#38bdf8",
      showDescription: false,
      textColor: "#e2e8f0",
      width: 38,
    });
    content.add(select);

    select.focus();

    const handleSelect = (_index: number, option: { value: string }) => {
      cleanup();
      resolve(option.value as QuitWarningChoice);
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

export type SessionStartWarningChoice = "continue" | "cancel";

export function showSessionStartWarning(
  renderer: CliRenderer,
  processes: BackgroundProcess[]
): Promise<SessionStartWarningChoice> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(
      renderer,
      "Background processes detected"
    );

    const warning = new TextRenderable(renderer, {
      content: `${processes.length} background process${processes.length > 1 ? "es" : ""} still running for this session:`,
      fg: "#f59e0b",
      id: "warning",
      marginBottom: 1,
    });
    content.add(warning);

    // List the running processes
    for (const [i, proc] of processes.entries()) {
      const processInfo = new TextRenderable(renderer, {
        content: `  • ${proc.description}`,
        fg: "#94a3b8",
        id: `process-${i}`,
      });
      content.add(processInfo);
    }

    const note = new TextRenderable(renderer, {
      content: "Some repositories may not be fully cloned yet.",
      fg: "#94a3b8",
      id: "note",
      marginTop: 1,
    });
    content.add(note);

    const question = new TextRenderable(renderer, {
      content: "Continue with session?",
      fg: "#e2e8f0",
      id: "question",
      marginTop: 1,
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      backgroundColor: "transparent",
      focusedBackgroundColor: "transparent",
      height: 2,
      id: "session-warning-select",
      marginTop: 1,
      options: [
        { description: "", name: "Continue anyway", value: "continue" },
        { description: "", name: "Cancel", value: "cancel" },
      ],
      selectedBackgroundColor: "#334155",
      selectedTextColor: "#38bdf8",
      showDescription: false,
      textColor: "#e2e8f0",
      width: 38,
    });
    content.add(select);

    select.focus();

    const handleSelect = (_index: number, option: { value: string }) => {
      cleanup();
      resolve(option.value as SessionStartWarningChoice);
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
