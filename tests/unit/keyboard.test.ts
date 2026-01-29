import type { KeyEvent } from "@opentui/core";

import { test, expect, describe } from "bun:test";

import {
  KEYBOARD,
  isKey,
  isEnter,
  isEscape,
  isTab,
  isArrowUp,
  isArrowDown,
  isCtrlD,
  isNavigation,
  isAbort,
  isSkip,
  isBackground,
} from "../../src/ui/common/keyboard";

function createKeyEvent(overrides: Partial<KeyEvent>): KeyEvent {
  return {
    name: "",
    ctrl: false,
    meta: false,
    shift: false,
    sequence: "",
    ...overrides,
  } as KeyEvent;
}

describe("KEYBOARD constants", () => {
  test("has correct navigation keys", () => {
    expect(KEYBOARD.UP).toBe("up");
    expect(KEYBOARD.DOWN).toBe("down");
    expect(KEYBOARD.LEFT).toBe("left");
    expect(KEYBOARD.RIGHT).toBe("right");
    expect(KEYBOARD.TAB).toBe("tab");
  });

  test("has correct action keys", () => {
    expect(KEYBOARD.ENTER).toBe("enter");
    expect(KEYBOARD.RETURN).toBe("return");
    expect(KEYBOARD.ESCAPE).toBe("escape");
  });

  test("has correct shortcut keys", () => {
    expect(KEYBOARD.NEW).toBe("n");
    expect(KEYBOARD.DELETE).toBe("d");
    expect(KEYBOARD.QUIT).toBe("q");
    expect(KEYBOARD.ABORT).toBe("a");
    expect(KEYBOARD.SKIP).toBe("s");
    expect(KEYBOARD.BACKGROUND).toBe("b");
  });
});

describe("isKey", () => {
  test("returns true for matching key", () => {
    const key = createKeyEvent({ name: "enter" });
    expect(isKey(key, "enter")).toBe(true);
  });

  test("returns false for non-matching key", () => {
    const key = createKeyEvent({ name: "enter" });
    expect(isKey(key, "escape")).toBe(false);
  });
});

describe("isEnter", () => {
  test("returns true for enter key", () => {
    const key = createKeyEvent({ name: "enter" });
    expect(isEnter(key)).toBe(true);
  });

  test("returns true for return key", () => {
    const key = createKeyEvent({ name: "return" });
    expect(isEnter(key)).toBe(true);
  });

  test("returns false for other keys", () => {
    const key = createKeyEvent({ name: "space" });
    expect(isEnter(key)).toBe(false);
  });
});

describe("isEscape", () => {
  test("returns true for escape key", () => {
    const key = createKeyEvent({ name: "escape" });
    expect(isEscape(key)).toBe(true);
  });

  test("returns false for other keys", () => {
    const key = createKeyEvent({ name: "enter" });
    expect(isEscape(key)).toBe(false);
  });
});

describe("isTab", () => {
  test("returns true for tab key", () => {
    const key = createKeyEvent({ name: "tab" });
    expect(isTab(key)).toBe(true);
  });

  test("returns false for other keys", () => {
    const key = createKeyEvent({ name: "space" });
    expect(isTab(key)).toBe(false);
  });
});

describe("isArrowUp", () => {
  test("returns true for up arrow", () => {
    const key = createKeyEvent({ name: "up" });
    expect(isArrowUp(key)).toBe(true);
  });

  test("returns false for other keys", () => {
    const key = createKeyEvent({ name: "down" });
    expect(isArrowUp(key)).toBe(false);
  });
});

describe("isArrowDown", () => {
  test("returns true for down arrow", () => {
    const key = createKeyEvent({ name: "down" });
    expect(isArrowDown(key)).toBe(true);
  });

  test("returns false for other keys", () => {
    const key = createKeyEvent({ name: "up" });
    expect(isArrowDown(key)).toBe(false);
  });
});

describe("isCtrlD", () => {
  test("returns true for Ctrl+D", () => {
    const key = createKeyEvent({ ctrl: true, name: "d" });
    expect(isCtrlD(key)).toBe(true);
  });

  test("returns false for just D", () => {
    const key = createKeyEvent({ ctrl: false, name: "d" });
    expect(isCtrlD(key)).toBe(false);
  });

  test("returns false for Ctrl+other", () => {
    const key = createKeyEvent({ ctrl: true, name: "c" });
    expect(isCtrlD(key)).toBe(false);
  });
});

describe("isNavigation", () => {
  test("returns true for up arrow", () => {
    const key = createKeyEvent({ name: "up" });
    expect(isNavigation(key)).toBe(true);
  });

  test("returns true for down arrow", () => {
    const key = createKeyEvent({ name: "down" });
    expect(isNavigation(key)).toBe(true);
  });

  test("returns true for left arrow", () => {
    const key = createKeyEvent({ name: "left" });
    expect(isNavigation(key)).toBe(true);
  });

  test("returns true for right arrow", () => {
    const key = createKeyEvent({ name: "right" });
    expect(isNavigation(key)).toBe(true);
  });

  test("returns false for non-navigation keys", () => {
    expect(isNavigation(createKeyEvent({ name: "enter" }))).toBe(false);
    expect(isNavigation(createKeyEvent({ name: "space" }))).toBe(false);
    expect(isNavigation(createKeyEvent({ name: "tab" }))).toBe(false);
  });
});

describe("isAbort", () => {
  test("returns true for 'a' key", () => {
    const key = { name: "a" };
    expect(isAbort(key)).toBe(true);
  });

  test("returns false for other keys", () => {
    const key = { name: "b" };
    expect(isAbort(key)).toBe(false);
  });
});

describe("isSkip", () => {
  test("returns true for 's' key", () => {
    const key = { name: "s" };
    expect(isSkip(key)).toBe(true);
  });

  test("returns false for other keys", () => {
    const key = { name: "a" };
    expect(isSkip(key)).toBe(false);
  });
});

describe("isBackground", () => {
  test("returns true for 'b' key", () => {
    const key = { name: "b" };
    expect(isBackground(key)).toBe(true);
  });

  test("returns false for other keys", () => {
    const key = { name: "a" };
    expect(isBackground(key)).toBe(false);
  });
});
