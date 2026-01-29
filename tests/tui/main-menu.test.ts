import { test, expect, describe, mock, beforeEach } from "bun:test";
import { EventEmitter } from "node:events";

import  { type Session } from "../../src/types";

// Mock @opentui/core before importing the module
const mockTextRenderable = mock(() => ({
  id: "mock-text",
}));

const mockSelectRenderable = mock(() => ({
  blur: mock(() => {}),
  focus: mock(() => {}),
  id: "mock-select",
  off: mock(() => {}),
  on: mock(() => {}),
}));

const mockBoxRenderable = mock(() => ({
  add: mock(() => {}),
  id: "mock-box",
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
    destroy: mock(() => {}),
    keyInput: {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        keyEmitter.on(event, handler);
      },
      off: (event: string, handler: (...args: unknown[]) => void) => {
        keyEmitter.off(event, handler);
      },
    },
    root: mockRoot,
    setBackgroundColor: mock(() => {}),
    terminalHeight: 24,
    terminalWidth: 80,
  };
}

// Mock module system
mock.module("@opentui/core", () => ({
  ASCIIFontRenderable: function () {
    return mockASCIIFontRenderable();
  },
  BoxRenderable: function () {
    return mockBoxRenderable();
  },
  RGBA: {
    fromHex: mock(() => ({})),
  },
  SelectRenderable: function () {
    return mockSelectRenderable();
  },
  SelectRenderableEvents: {
    ITEM_SELECTED: "item-selected",
  },
  TextRenderable: function () {
    return mockTextRenderable();
  },
  measureText: mock(() => ({ width: 50 })),
}));

// Now import after mocking
import { showMainMenu } from "../../src/ui/main-menu";

function createTestSession(name: string): Session {
  return {
    created: new Date().toISOString(),
    goal: "Test goal",
    lastAccessed: new Date().toISOString(),
    name,
    path: `/tmp/${name}`,
    repos: [{ spec: "owner/repo", owner: "owner", name: "repo", dir: "repo" }],
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
      ctrl: false,
      meta: false,
      name: "q",
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("quit");
  });

  test("escape key resolves with quit action", async () => {
    const resultPromise = showMainMenu(renderer as any, []);

    await new Promise((resolve) => setTimeout(resolve, 10));

    keyEmitter.emit("keypress", {
      ctrl: false,
      meta: false,
      name: "escape",
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("quit");
  });

  test("'n' key resolves with new-session action", async () => {
    const resultPromise = showMainMenu(renderer as any, []);

    await new Promise((resolve) => setTimeout(resolve, 10));

    keyEmitter.emit("keypress", {
      ctrl: false,
      meta: false,
      name: "n",
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
      ctrl: false,
      meta: false,
      name: "d",
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
      ctrl: false,
      meta: false,
      name: "a",
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
      ctrl: false,
      meta: false,
      name: "a",
      shift: false,
    });

    // Then press 'q' to resolve
    keyEmitter.emit("keypress", {
      ctrl: false,
      meta: false,
      name: "q",
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
      ctrl: false,
      meta: false,
      name: "d",
      shift: false,
    });

    // Then press 'n' to resolve
    keyEmitter.emit("keypress", {
      ctrl: false,
      meta: false,
      name: "n",
      shift: false,
    });

    const result = await resultPromise;
    expect(result.type).toBe("new-session"); // Not delete
  });
});
