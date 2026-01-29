import {
  TextRenderable,
  type BoxRenderable,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";

import type { ChatConfig } from "../flows/chat-to-config";

import { showFooter, hideFooter } from "./common/footer";
import { isEnter, isEscape, isKey } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export type ConfirmationAction = "confirm" | "edit" | "cancel" | "back";

export interface ConfirmationResult {
  action: ConfirmationAction;
}

function renderSection(
  renderer: CliRenderer,
  content: BoxRenderable,
  label: string,
  items: string[]
): void {
  const labelText = new TextRenderable(renderer, {
    content: label,
    fg: "#38bdf8",
    id: label.toLowerCase().replaceAll(/[^a-z]+/g, "-"),
    marginBottom: 0,
  });
  content.add(labelText);

  if (items.length > 0) {
    for (const [i, item] of items.entries()) {
      const itemText = new TextRenderable(renderer, {
        content: `  • ${item}`,
        fg: "#94a3b8",
        id: `${label.toLowerCase().replaceAll(/[^a-z]+/g, "-")}-${i}`,
      });
      content.add(itemText);
    }
  } else {
    const noItemsText = new TextRenderable(renderer, {
      content: "  (none)",
      fg: "#64748b",
      id: `${label.toLowerCase().replaceAll(/[^a-z]+/g, "-")}-none`,
    });
    content.add(noItemsText);
  }
}

function renderConfirmationUI(renderer: CliRenderer, config: ChatConfig): void {
  clearLayout(renderer);

  const { content } = createBaseLayout(renderer, "Review Configuration");

  const title = new TextRenderable(renderer, {
    content: "Here's what I'll set up for you:",
    fg: "#e2e8f0",
    id: "confirm-title",
    marginBottom: 2,
  });
  content.add(title);

  renderSection(renderer, content, "📦 Repositories:", config.repos);
  renderSection(renderer, content, "\n🛠️  Skills:", config.skills || []);
  renderSection(
    renderer,
    content,
    "\n🎯 Goal:",
    config.goal ? [config.goal] : []
  );

  const confirmText = new TextRenderable(renderer, {
    content: "Does this look right?",
    fg: "#e2e8f0",
    id: "confirm-question",
    marginTop: 2,
  });
  content.add(confirmText);
}

function createKeyHandler(
  renderer: CliRenderer,
  resolve: (value: ConfirmationResult) => void
): (key: KeyEvent) => void {
  const cleanup = () => {
    renderer.keyInput.off("keypress", handler);
    hideFooter(renderer);
    clearLayout(renderer);
  };

  const handler = (key: KeyEvent) => {
    if (isEscape(key)) {
      cleanup();
      resolve({ action: "cancel" });
    } else if (isEnter(key)) {
      cleanup();
      resolve({ action: "confirm" });
    } else if (isKey(key, "e")) {
      cleanup();
      resolve({ action: "edit" });
    } else if (isKey(key, "b")) {
      cleanup();
      resolve({ action: "back" });
    }
  };

  return handler;
}

export function showChatConfirmation(
  renderer: CliRenderer,
  config: ChatConfig
): Promise<ConfirmationResult> {
  renderConfirmationUI(renderer, config);

  const { content } = createBaseLayout(renderer, "Review Configuration");

  showFooter(renderer, content, {
    back: true,
    custom: ["Enter Confirm", "b Back to Chat", "e Manual Edit", "Esc Cancel"],
    navigate: false,
    select: false,
  });

  // eslint-disable-next-line promise/avoid-new -- Needed for event-driven pattern
  return new Promise((resolve) => {
    const handler = createKeyHandler(renderer, resolve);
    renderer.keyInput.on("keypress", handler);
  });
}
