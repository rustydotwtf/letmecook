import  { type CliRenderer, type KeyEvent } from "@opentui/core";

import { EventEmitter } from "node:events";

interface MockElement {
  id?: string;
  type: string;
  props: Record<string, unknown>;
}

interface MockRendererExtras {
  simulateKey: (key: Partial<KeyEvent>) => void;
  getAddedElements: () => MockElement[];
  clearElements: () => void;
}

export type MockCliRenderer = CliRenderer & MockRendererExtras;

export function createMockRenderer(): MockCliRenderer {
  const keyEmitter = new EventEmitter();
  const elements: MockElement[] = [];

  const mockRoot = {
    add: (el: unknown) => {
      const element = el as { id?: string; constructor?: { name?: string } };
      elements.push({
        id: element.id,
        props: element as Record<string, unknown>,
        type: element.constructor?.name || "unknown",
      });
    },
    remove: () => {},
  };

  const mock = {
    root: mockRoot,
    keyInput: {
      off: (event: string, handler: (...args: unknown[]) => void) => {
        keyEmitter.off(event, handler);
      },
      on: (event: string, handler: (...args: unknown[]) => void) => {
        keyEmitter.on(event, handler);
      },
    },
    terminalWidth: 80,
    terminalHeight: 24,
    setBackgroundColor: () => {},
    destroy: () => {},

    // Test helpers
    simulateKey: (key: Partial<KeyEvent>) => {
      keyEmitter.emit("keypress", {
        name: "",
        ctrl: false,
        meta: false,
        shift: false,
        ...key,
      });
    },
    getAddedElements: () => elements,
    clearElements: () => {
      elements.length = 0;
    },
  };

  return mock as unknown as MockCliRenderer;
}
