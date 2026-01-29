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
      id: "repos-label",
      content: "Repositories:",
      fg: "#e2e8f0",
      marginBottom: 0,
    });
    content.add(reposLabel);

    repos.forEach((repo, i) => {
      const branch = repo.branch ? ` (${repo.branch})` : " (default)";
      const roMarker = repo.readOnly ? " [Read-only]" : "";
      const repoText = new TextRenderable(renderer, {
        id: `repo-${i}`,
        content: `  - ${repo.owner}/${repo.name}${branch}${roMarker}`,
        fg: "#94a3b8",
      });
      content.add(repoText);
    });

    // Goal prompt
    const goalLabel = new TextRenderable(renderer, {
      id: "goal-label",
      content: "\nAnything you'd like to add? (goal/context for AI agents)",
      fg: "#e2e8f0",
      marginTop: 1,
    });
    content.add(goalLabel);

    const goalInput = new InputRenderable(renderer, {
      id: "goal-input",
      width: 60,
      height: 1,
      placeholder: "e.g., Integrate testing framework...",
      placeholderColor: "#64748b",
      backgroundColor: "#334155",
      textColor: "#f8fafc",
      cursorColor: "#38bdf8",
      marginTop: 1,
    });
    content.add(goalInput);

    goalInput.onPaste = (event) => {
      const text = event.text.replace(/[\r\n]+/g, "");
      if (!text) return;
      goalInput.insertText(text);
      event.preventDefault();
    };

    // Instructions
    const instructions = new TextRenderable(renderer, {
      id: "instructions",
      content: "\n[Enter] Continue   [Esc] Cancel",
      fg: "#64748b",
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
        resolve({ goal, cancelled: false });
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
