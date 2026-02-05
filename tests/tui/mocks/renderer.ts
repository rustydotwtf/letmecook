import type { CliRenderer, KeyEvent } from "@opentui/core";

class KeyPressEvent extends Event {
  static readonly eventName = "keypress" as const;

  keyData: Partial<KeyEvent>;

  constructor(keyData: Partial<KeyEvent>) {
    super(KeyPressEvent.eventName);
    this.keyData = keyData;
  }
}

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
  const keyEmitter = new EventTarget();
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
    remove: () => {
      /* noop */
    },
  };

  const mock = {
    clearElements: () => {
      elements.length = 0;
    },

    // Test helpers
    destroy: () => {
      /* noop */
    },
    getAddedElements: () => elements,
    keyInput: {
      off: (event: string, handler: (...args: unknown[]) => void) => {
        keyEmitter.removeEventListener(event, handler as EventListener);
      },
      on: (event: string, handler: (...args: unknown[]) => void) => {
        keyEmitter.addEventListener(event, handler as EventListener);
      },
    },
    root: mockRoot,
    setBackgroundColor: () => {
      /* noop */
    },
    simulateKey: (key: Partial<KeyEvent>) => {
      keyEmitter.dispatchEvent(
        new KeyPressEvent({
          ctrl: false,
          meta: false,
          name: "",
          shift: false,
          ...key,
        })
      );
    },
    terminalHeight: 24,
    terminalWidth: 80,
  };

  return mock as unknown as MockCliRenderer;
}
