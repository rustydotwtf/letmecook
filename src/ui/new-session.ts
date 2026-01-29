import {
  type CliRenderer,
  TextRenderable,
  InputRenderable,
  type KeyEvent,
} from "@opentui/core";

import type { RepoSpec } from "../types";

import { createBaseLayout, clearLayout } from "./renderer";

export interface NewSessionResult {
  goal?: string;
  cancelled: boolean;
}

export function showNewSessionPrompt(
  renderer: CliRenderer,
  repos: RepoSpec[]
): Promise<NewSessionResult> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Creating new session");

    // Show repos
    const reposLabel = new TextRenderable(renderer, {
      content: "Repositories:",
      fg: "#e2e8f0",
      id: "repos-label",
      marginBottom: 0,
    });
    content.add(reposLabel);

    for (const [i, repo] of repos.entries()) {
      const branch = repo.branch ? ` (${repo.branch})` : " (default)";
      const roMarker = repo.readOnly ? " [Read-only]" : "";
      const repoText = new TextRenderable(renderer, {
        content: `  - ${repo.owner}/${repo.name}${branch}${roMarker}`,
        fg: "#94a3b8",
        id: `repo-${i}`,
      });
      content.add(repoText);
    }

    // Goal prompt
    const goalLabel = new TextRenderable(renderer, {
      content: "\nAnything you'd like to add? (goal/context for AI agents)",
      fg: "#e2e8f0",
      id: "goal-label",
      marginTop: 1,
    });
    content.add(goalLabel);

    const goalInput = new InputRenderable(renderer, {
      backgroundColor: "#334155",
      cursorColor: "#38bdf8",
      height: 1,
      id: "goal-input",
      marginTop: 1,
      placeholder: "e.g., Integrate testing framework...",
      placeholderColor: "#64748b",
      textColor: "#f8fafc",
      width: 60,
    });
    content.add(goalInput);

    goalInput.onPaste = (event) => {
      const text = event.text.replaceAll(/[\r\n]+/g, "");
      if (!text) {
        return;
      }
      goalInput.insertText(text);
      event.preventDefault();
    };

    // Instructions
    const instructions = new TextRenderable(renderer, {
      content: "\n[Enter] Continue   [Esc] Cancel",
      fg: "#64748b",
      id: "instructions",
      marginTop: 1,
    });
    content.add(instructions);

    goalInput.focus();

    const handleKeypress = (key: KeyEvent) => {
      if (key.name === "escape") {
        cleanup();
        resolve({ cancelled: true });
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        const goal = goalInput.value.trim() || undefined;
        resolve({ cancelled: false, goal });
      }
    };

    const cleanup = () => {
      renderer.keyInput.off("keypress", handleKeypress);
      goalInput.blur();
      clearLayout(renderer);
    };

    renderer.keyInput.on("keypress", handleKeypress);
  });
}
