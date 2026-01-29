import type { KeyEvent } from "@opentui/core";

/**
 * Unified keyboard mapping constants for consistent navigation across the TUI.
 *
 * Design principles:
 * - Arrow keys everywhere for navigation
 * - Enter always confirms/selects
 * - Esc always goes back/cancels
 * - Tab moves between fields/sections
 */

export const KEYBOARD = {
  // Navigation
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
  TAB: "tab",

  // Actions
  ENTER: "enter",
  RETURN: "return",
  ESCAPE: "escape",

  // Global shortcuts (only on list screens)
  NEW: "n",
  DELETE: "d",
  QUIT: "q",

  // Text input shortcuts
  BACKSPACE: "backspace",
  CTRL_D: "d", // Ctrl+D (handled via ctrl modifier)

  // Command control shortcuts
  ABORT: "a",
  SKIP: "s",
  BACKGROUND: "b",
} as const;

/**
 * Check if a key event matches a specific key name
 */
export function isKey(key: KeyEvent, name: string): boolean {
  return key.name === name;
}

/**
 * Check if a key event matches Enter/Return
 */
export function isEnter(key: KeyEvent): boolean {
  return key.name === KEYBOARD.ENTER || key.name === KEYBOARD.RETURN;
}

/**
 * Check if a key event matches Escape
 */
export function isEscape(key: KeyEvent): boolean {
  return key.name === KEYBOARD.ESCAPE;
}

/**
 * Check if a key event matches Tab
 */
export function isTab(key: KeyEvent): boolean {
  return key.name === KEYBOARD.TAB;
}

/**
 * Check if a key event matches arrow up
 */
export function isArrowUp(key: KeyEvent): boolean {
  return key.name === KEYBOARD.UP;
}

/**
 * Check if a key event matches arrow down
 */
export function isArrowDown(key: KeyEvent): boolean {
  return key.name === KEYBOARD.DOWN;
}

/**
 * Check if a key event is Ctrl+D
 */
export function isCtrlD(key: KeyEvent): boolean {
  return key.name === KEYBOARD.CTRL_D && key.ctrl === true;
}

/**
 * Check if a key event is Ctrl+C
 */
export function isCtrlC(key: KeyEvent): boolean {
  return key.name === "c" && key.ctrl === true;
}

/**
 * Check if a key event is a navigation key (arrows)
 */
export function isNavigation(key: KeyEvent): boolean {
  return (
    key.name === KEYBOARD.UP ||
    key.name === KEYBOARD.DOWN ||
    key.name === KEYBOARD.LEFT ||
    key.name === KEYBOARD.RIGHT
  );
}

/**
 * Check if a key event is Abort (a)
 */
export function isAbort(key: Pick<KeyEvent, "name">): boolean {
  return key.name === KEYBOARD.ABORT;
}

/**
 * Check if a key event is Skip (s)
 */
export function isSkip(key: Pick<KeyEvent, "name">): boolean {
  return key.name === KEYBOARD.SKIP;
}

/**
 * Check if a key event is Background (b)
 */
export function isBackground(key: Pick<KeyEvent, "name">): boolean {
  return key.name === KEYBOARD.BACKGROUND;
}
