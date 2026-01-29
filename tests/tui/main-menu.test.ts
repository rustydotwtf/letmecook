import { test, expect, describe, mock, beforeEach } from "bun:test";
import { EventEmitter } from "events";

import type { Session } from "../../src/types";

// Mock @opentui/core before importing the module
const mockTextRenderable = mock(() => ({
  id: "mock-text",
}));

const mockSelectRenderable = mock(() => ({
  id: "mock-select",
  focus: mock(() => {}),
  blur: mock(() => {}),
  on: mock(() => {}),
  off: mock(() => {}),
}));

const mockBoxRenderable = mock(() => ({
  id: "mock-box",
  add: mock(() => {}),
  remove: mock(() => {}),
}));

const mockASCIIFontRenderable = mock(() => ({
  id: "mock-ascii",
}));

// Create mock functions that we can access in tests
let keyEmitter: EventEmitter;
let mockRoot: { add: ReturnType<typeof mock>; remove: ReturnType<typeof mock> };

function createMockRenderer() {
  keyEmitter = new EventEmitter();
  mockRoot = {
    add: mock(() => {}),
    remove: mock(() => {}),
  };

  return {
    root: mockRoot,
    keyInput: {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        keyEmitter.on(event, handler);
      },
      off: (event: string, handler: (...args: unknown[]) => void) => {
        keyEmitter.off(event, handler);
      },
    },
    terminalWidth: 80,
    terminalHeight: 24,
    setBackgroundColor: mock(() => {}),
    destroy: mock(() => {}),
  };
}

// Mock module system
mock.module("@opentui/core", () => ({
  TextRenderable: function () {
    return mockTextRenderable();
  },
  SelectRenderable: function () {
    return mockSelectRenderable();
  },
  SelectRenderableEvents: {
    ITEM_SELECTED: "item-selected",
  },
  BoxRenderable: function () {
    return mockBoxRenderable();
  },
  ASCIIFontRenderable: function () {
    return mockASCIIFontRenderable();
  },
  RGBA: {
    fromHex: mock(() => ({})),
  },
  measureText: mock(() => ({ width: 50 })),
}));

// Now import after mocking
import { showMainMenu } from "../../src/ui/main-menu";

function createTestSession(name: string): Session {
  return {
    name,
    repos: [{ spec: "owner/repo", owner: "owner", name: "repo", dir: "repo" }],
    goal: "Test goal",
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    path: `/tmp/${name}`,
  };
}

describe("showMainMenu", () => {
  let renderer: ReturnType<typeof createMockRenderer>;

  beforeEach(() => {
    renderer = createMockRenderer();
  });

  test("'q' key resolves with quit action when no sessions", async () => {
    const resultPromise = showMainMenu(renderer as any, []);

    // Give the promise time to set up listeners
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate pressing 'q'
    keyEmitter.emit("keypress", {
      name: "q",
      ctrl: false,
      meta: false,
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("quit");
  });

  test("escape key resolves with quit action", async () => {
    const resultPromise = showMainMenu(renderer as any, []);

    await new Promise((resolve) => setTimeout(resolve, 10));

    keyEmitter.emit("keypress", {
      name: "escape",
      ctrl: false,
      meta: false,
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("quit");
  });

  test("'n' key resolves with new-session action", async () => {
    const resultPromise = showMainMenu(renderer as any, []);

    await new Promise((resolve) => setTimeout(resolve, 10));

    keyEmitter.emit("keypress", {
      name: "n",
      ctrl: false,
      meta: false,
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("new-session");
  });

  test("'d' key resolves with delete action when sessions exist", async () => {
    const sessions = [createTestSession("test-session")];
    const resultPromise = showMainMenu(renderer as any, sessions);

    await new Promise((resolve) => setTimeout(resolve, 10));

    keyEmitter.emit("keypress", {
      name: "d",
      ctrl: false,
      meta: false,
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("delete");
    if (result.type === "delete") {
      expect(result.session.name).toBe("test-session");
    }
  });

  test("'a' key resolves with nuke action when sessions exist", async () => {
    const sessions = [createTestSession("test-session")];
    const resultPromise = showMainMenu(renderer as any, sessions);

    await new Promise((resolve) => setTimeout(resolve, 10));

    keyEmitter.emit("keypress", {
      name: "a",
      ctrl: false,
      meta: false,
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("nuke");
  });

  test("'a' key does nothing when no sessions", async () => {
    const resultPromise = showMainMenu(renderer as any, []);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Press 'a' - should be ignored
    keyEmitter.emit("keypress", {
      name: "a",
      ctrl: false,
      meta: false,
      shift: false,
    });

    // Then press 'q' to resolve
    keyEmitter.emit("keypress", {
      name: "q",
      ctrl: false,
      meta: false,
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("quit"); // Not nuke
  });

  test("'d' key does nothing when no sessions", async () => {
    const resultPromise = showMainMenu(renderer as any, []);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Press 'd' - should be ignored
    keyEmitter.emit("keypress", {
      name: "d",
      ctrl: false,
      meta: false,
      shift: false,
    });

    // Then press 'n' to resolve
    keyEmitter.emit("keypress", {
      name: "n",
      ctrl: false,
      meta: false,
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("new-session"); // Not delete
  });
});
