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
      id: "warning",
      content: `${processes.length} background process${processes.length > 1 ? "es" : ""} still running:`,
      fg: "#f59e0b",
      marginBottom: 1,
    });
    content.add(warning);

    // List the running processes
    processes.forEach((proc, i) => {
      const processInfo = new TextRenderable(renderer, {
        id: `process-${i}`,
        content: `  • ${proc.description}`,
        fg: "#94a3b8",
      });
      content.add(processInfo);
    });

    const question = new TextRenderable(renderer, {
      id: "question",
      content: "What would you like to do?",
      fg: "#e2e8f0",
      marginTop: 1,
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      id: "quit-warning-select",
      width: 38,
      height: 3,
      options: [
        { name: "Keep running & quit", description: "", value: "continue" },
        { name: "Kill all & quit", description: "", value: "kill" },
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
      navigate: true,
      select: true,
      back: true,
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
      id: "warning",
      content: `${processes.length} background process${processes.length > 1 ? "es" : ""} still running for this session:`,
      fg: "#f59e0b",
      marginBottom: 1,
    });
    content.add(warning);

    // List the running processes
    processes.forEach((proc, i) => {
      const processInfo = new TextRenderable(renderer, {
        id: `process-${i}`,
        content: `  • ${proc.description}`,
        fg: "#94a3b8",
      });
      content.add(processInfo);
    });

    const note = new TextRenderable(renderer, {
      id: "note",
      content: "Some repositories may not be fully cloned yet.",
      fg: "#94a3b8",
      marginTop: 1,
    });
    content.add(note);

    const question = new TextRenderable(renderer, {
      id: "question",
      content: "Continue with session?",
      fg: "#e2e8f0",
      marginTop: 1,
    });
    content.add(question);

    const select = new SelectRenderable(renderer, {
      id: "session-warning-select",
      width: 38,
      height: 2,
      options: [
        { name: "Continue anyway", description: "", value: "continue" },
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
      navigate: true,
      select: true,
      back: true,
    });

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
