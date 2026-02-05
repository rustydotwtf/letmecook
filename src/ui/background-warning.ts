import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
  type BoxRenderable,
} from "@opentui/core";

import type { BackgroundProcess } from "../process-registry";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

function addProcessList(
  renderer: CliRenderer,
  content: BoxRenderable,
  processes: BackgroundProcess[]
): void {
  for (const [i, proc] of processes.entries()) {
    const processInfo = new TextRenderable(renderer, {
      content: `  • ${proc.description}`,
      fg: "#94a3b8",
      id: `process-${i}`,
    });
    content.add(processInfo);
  }
}

function addInfoText(
  renderer: CliRenderer,
  content: BoxRenderable,
  text: string,
  id: string,
  color: string
): void {
  const info = new TextRenderable(renderer, {
    content: text,
    fg: color,
    id,
    marginTop: 1,
  });
  content.add(info);
}

function addQuestionText(
  renderer: CliRenderer,
  content: BoxRenderable,
  text: string
): void {
  addInfoText(renderer, content, text, "question", "#e2e8f0");
}

function addNoteText(
  renderer: CliRenderer,
  content: BoxRenderable,
  text: string
): void {
  addInfoText(renderer, content, text, "note", "#94a3b8");
}

function addProcessWarning(
  renderer: CliRenderer,
  content: BoxRenderable,
  text: string
): void {
  const warning = new TextRenderable(renderer, {
    content: text,
    fg: "#f59e0b",
    id: "warning",
    marginBottom: 1,
  });
  content.add(warning);
}

function createQuitSelect(renderer: CliRenderer): SelectRenderable {
  return new SelectRenderable(renderer, {
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
}

function createSessionStartSelect(renderer: CliRenderer): SelectRenderable {
  return new SelectRenderable(renderer, {
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
}

/* eslint-disable promise/avoid-new */
function selectChoice<T>(
  renderer: CliRenderer,
  select: SelectRenderable,
  content: BoxRenderable
): Promise<T> {
  return new Promise((resolve) => {
    const handleSelect = (_index: number, option: { value: string }) => {
      cleanup();
      resolve(option.value as T);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        cleanup();
        resolve("cancel" as T);
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
/* eslint-enable promise/avoid-new */

export type QuitWarningChoice = "continue" | "kill" | "cancel";

export function showQuitWarning(
  renderer: CliRenderer,
  processes: BackgroundProcess[]
): Promise<QuitWarningChoice> {
  clearLayout(renderer);

  const { content } = createBaseLayout(
    renderer,
    "Background processes running"
  );
  addProcessWarning(
    renderer,
    content,
    `${processes.length} background process${processes.length > 1 ? "es" : ""} still running:`
  );

  addProcessList(renderer, content, processes);
  addQuestionText(renderer, content, "What would you like to do?");

  const select = createQuitSelect(renderer);
  content.add(select);
  select.focus();

  return selectChoice<QuitWarningChoice>(renderer, select, content);
}

export type SessionStartWarningChoice = "continue" | "cancel";

export function showSessionStartWarning(
  renderer: CliRenderer,
  processes: BackgroundProcess[]
): Promise<SessionStartWarningChoice> {
  clearLayout(renderer);

  const { content } = createBaseLayout(
    renderer,
    "Background processes detected"
  );
  addProcessWarning(
    renderer,
    content,
    `${processes.length} background process${processes.length > 1 ? "es" : ""} still running for this session:`
  );

  addProcessList(renderer, content, processes);
  addNoteText(
    renderer,
    content,
    "Some repositories may not be fully cloned yet."
  );
  addQuestionText(renderer, content, "Continue with session?");

  const select = createSessionStartSelect(renderer);
  content.add(select);
  select.focus();

  return selectChoice<SessionStartWarningChoice>(renderer, select, content);
}
