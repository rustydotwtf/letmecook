import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import  { type Session } from "../types";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape, isArrowUp, isArrowDown } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";
import { buildSessionOptions } from "./session-options";

export type ListAction =
  | { type: "resume"; session: Session }
  | { type: "delete"; session: Session }
  | { type: "nuke" }
  | { type: "quit" };

export function showSessionList(
  renderer: CliRenderer,
  sessions: Session[]
): Promise<ListAction> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(
      renderer,
      `Sessions (${sessions.length})`
    );

    if (sessions.length === 0) {
      const emptyText = new TextRenderable(renderer, {
        content: "No sessions found.\n\nCreate one with: letmecook owner/repo",
        fg: "#94a3b8",
        id: "empty",
      });
      content.add(emptyText);

      const handleKeypress = (key: KeyEvent) => {
        if (key.name === "q" || isEscape(key)) {
          renderer.keyInput.off("keypress", handleKeypress);
          hideFooter(renderer);
          clearLayout(renderer);
          resolve({ type: "quit" });
        }
      };

      showFooter(renderer, content, {
        back: false,
        navigate: false,
        quit: true,
        select: false,
      });

      renderer.keyInput.on("keypress", handleKeypress);
      return;
    }

    // Build options from sessions
    const options = buildSessionOptions(sessions);

    const select = new SelectRenderable(renderer, {
      backgroundColor: "transparent",
      descriptionColor: "#64748b",
      focusedBackgroundColor: "transparent",
      height: Math.min(sessions.length * 2, 12),
      id: "session-list",
      options,
      selectedBackgroundColor: "#334155",
      selectedDescriptionColor: "#94a3b8",
      selectedTextColor: "#38bdf8",
      showDescription: true,
      textColor: "#e2e8f0",
      width: 65,
    });
    content.add(select);

    select.focus();

    let selectedIndex = 0;

    const handleSelect = (_index: number, option: { value: Session }) => {
      cleanup();
      resolve({ session: option.value, type: "resume" });
    };

    const handleKeypress = (key: KeyEvent) => {
      // Track selection for delete
      if (isArrowUp(key)) {
        selectedIndex = Math.max(0, selectedIndex - 1);
      } else if (isArrowDown(key)) {
        selectedIndex = Math.min(sessions.length - 1, selectedIndex + 1);
      } else if (key.name === "d") {
        const session = sessions[selectedIndex];
        if (session) {
          cleanup();
          resolve({ session, type: "delete" });
        }
      } else if (key.name === "a") {
        cleanup();
        resolve({ type: "nuke" });
      } else if (key.name === "q" || isEscape(key)) {
        cleanup();
        resolve({ type: "quit" });
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
      back: false,
      custom: ["Enter Resume", "d Delete", "a Nuke", "q Quit"],
      navigate: true,
      select: false,
    });

    select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
