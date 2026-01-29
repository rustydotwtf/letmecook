import { type CliRenderer, TextRenderable, type KeyEvent } from "@opentui/core";

import type { ChatConfig } from "../flows/chat-to-config";

import { showFooter, hideFooter } from "./common/footer";
import { isEnter, isEscape, isKey } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export type ConfirmationAction = "confirm" | "edit" | "cancel" | "back";

export interface ConfirmationResult {
  action: ConfirmationAction;
}

export function showChatConfirmation(
  renderer: CliRenderer,
  config: ChatConfig
): Promise<ConfirmationResult> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Review Configuration");

    // Title
    const title = new TextRenderable(renderer, {
      id: "confirm-title",
      content: "Here's what I'll set up for you:",
      fg: "#e2e8f0",
      marginBottom: 2,
    });
    content.add(title);

    // Repositories
    const reposLabel = new TextRenderable(renderer, {
      id: "repos-label",
      content: "📦 Repositories:",
      fg: "#38bdf8",
      marginBottom: 0,
    });
    content.add(reposLabel);

    if (config.repos.length > 0) {
      config.repos.forEach((repo, i) => {
        const repoText = new TextRenderable(renderer, {
          id: `repo-${i}`,
          content: `  • ${repo}`,
          fg: "#94a3b8",
        });
        content.add(repoText);
      });
    } else {
      const noRepos = new TextRenderable(renderer, {
        id: "no-repos",
        content: "  (none)",
        fg: "#64748b",
      });
      content.add(noRepos);
    }

    // Skills
    const skillsLabel = new TextRenderable(renderer, {
      id: "skills-label",
      content: "\n🛠️  Skills:",
      fg: "#38bdf8",
      marginBottom: 0,
    });
    content.add(skillsLabel);

    if (config.skills && config.skills.length > 0) {
      config.skills.forEach((skill, i) => {
        const skillText = new TextRenderable(renderer, {
          id: `skill-${i}`,
          content: `  • ${skill}`,
          fg: "#94a3b8",
        });
        content.add(skillText);
      });
    } else {
      const noSkills = new TextRenderable(renderer, {
        id: "no-skills",
        content: "  (none)",
        fg: "#64748b",
      });
      content.add(noSkills);
    }

    // Goal
    const goalLabel = new TextRenderable(renderer, {
      id: "goal-label",
      content: "\n🎯 Goal:",
      fg: "#38bdf8",
      marginBottom: 0,
    });
    content.add(goalLabel);

    const goalText = new TextRenderable(renderer, {
      id: "goal-text",
      content: config.goal ? `  ${config.goal}` : "  (none)",
      fg: config.goal ? "#94a3b8" : "#64748b",
      marginBottom: 2,
    });
    content.add(goalText);

    // Confirmation question
    const confirmText = new TextRenderable(renderer, {
      id: "confirm-question",
      content: "Does this look right?",
      fg: "#e2e8f0",
      marginTop: 2,
    });
    content.add(confirmText);

    const cleanup = () => {
      renderer.keyInput.off("keypress", handleKeypress);
      hideFooter(renderer);
      clearLayout(renderer);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        cleanup();
        resolve({ action: "cancel" });
        return;
      }

      if (isEnter(key)) {
        cleanup();
        resolve({ action: "confirm" });
        return;
      }

      if (isKey(key, "e")) {
        cleanup();
        resolve({ action: "edit" });
        return;
      }

      if (isKey(key, "b")) {
        cleanup();
        resolve({ action: "back" });
        return;
      }
    };

    showFooter(renderer, content, {
      navigate: false,
      select: false,
      back: true,
      custom: [
        "Enter Confirm",
        "b Back to Chat",
        "e Manual Edit",
        "Esc Cancel",
      ],
    });
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
