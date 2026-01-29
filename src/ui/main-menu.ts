import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import type { Session } from "../types";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape, isArrowUp, isArrowDown } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";
import { buildSessionOptions } from "./session-options";

export type MainMenuAction =
  | { type: "chat" }
  | { type: "new-session" }
  | { type: "resume"; session: Session }
  | { type: "delete"; session: Session }
  | { type: "nuke" }
  | { type: "quit" };

export function showMainMenu(
  renderer: CliRenderer,
  sessions: Session[]
): Promise<MainMenuAction> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer);

    // Sessions section with count
    const sessionsHeader = new TextRenderable(renderer, {
      id: "sessions-header",
      content: `Sessions (${sessions.length})`,
      fg: "#e2e8f0",
      marginBottom: 1,
    });
    content.add(sessionsHeader);

    const options = buildSessionOptions(sessions);
    const select =
      options.length > 0
        ? new SelectRenderable(renderer, {
            id: "session-list",
            width: 65,
            height: Math.min(sessions.length * 2, 10),
            options,
            showDescription: true,
            backgroundColor: "transparent",
            focusedBackgroundColor: "transparent",
            selectedBackgroundColor: "#334155",
            textColor: "#e2e8f0",
            selectedTextColor: "#38bdf8",
            descriptionColor: "#64748b",
            selectedDescriptionColor: "#94a3b8",
          })
        : null;

    if (select) {
      content.add(select);
    } else {
      const emptyText = new TextRenderable(renderer, {
        id: "empty-sessions",
        content: "No sessions yet. Start one with [n].",
        fg: "#94a3b8",
        marginBottom: 1,
      });
      content.add(emptyText);
    }

    if (select) {
      select.focus();
    }

    let selectedIndex = 0;

    const handleSelect = (_index: number, option: { value: Session }) => {
      cleanup();
      resolve({ type: "resume", session: option.value });
    };

    const handleKeypress = (key: KeyEvent) => {
      if (sessions.length > 0 && isArrowUp(key)) {
        selectedIndex = Math.max(0, selectedIndex - 1);
      } else if (sessions.length > 0 && isArrowDown(key)) {
        selectedIndex = Math.min(sessions.length - 1, selectedIndex + 1);
      } else if (key.name === "d" && sessions.length > 0) {
        const session = sessions[selectedIndex];
        if (session) {
          cleanup();
          resolve({ type: "delete", session });
        }
        return;
      }

      if (key.name === "c") {
        cleanup();
        resolve({ type: "chat" });
        return;
      }

      if (key.name === "n") {
        cleanup();
        resolve({ type: "new-session" });
        return;
      }

      if (key.name === "a" && sessions.length > 0) {
        cleanup();
        resolve({ type: "nuke" });
        return;
      }

      if (key.name === "q" || isEscape(key)) {
        cleanup();
        resolve({ type: "quit" });
      }
    };

    const cleanup = () => {
      if (select) {
        select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
        select.blur();
      }
      renderer.keyInput.off("keypress", handleKeypress);
      hideFooter(renderer);
      clearLayout(renderer);
    };

    // Show footer with context-aware actions
    const footerActions: string[] = [];
    footerActions.push("c Chat");
    if (sessions.length > 0) {
      footerActions.push("Enter Open", "n New", "d Delete", "a Nuke");
    } else {
      footerActions.push("n New");
    }
    footerActions.push("q Quit");

    showFooter(renderer, content, {
      navigate: sessions.length > 0,
      select: false,
      back: false,
      custom: footerActions,
    });

    if (select) {
      select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    }
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
