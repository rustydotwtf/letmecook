import type { CliRenderer, KeyEvent } from "@opentui/core";

import { TextRenderable } from "@opentui/core";

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
      content: "Here's what I'll set up for you:",
      fg: "#e2e8f0",
      id: "confirm-title",
      marginBottom: 2,
    });
    content.add(title);

    // Repositories
    const reposLabel = new TextRenderable(renderer, {
      content: "📦 Repositories:",
      fg: "#38bdf8",
      id: "repos-label",
      marginBottom: 0,
    });
    content.add(reposLabel);

    if (config.repos.length > 0) {
      config.repos.forEach((repo, i) => {
        const repoText = new TextRenderable(renderer, {
          content: `  • ${repo}`,
          fg: "#94a3b8",
          id: `repo-${i}`,
        });
        content.add(repoText);
      });
    } else {
      const noRepos = new TextRenderable(renderer, {
        content: "  (none)",
        fg: "#64748b",
        id: "no-repos",
      });
      content.add(noRepos);
    }

    // Skills
    const skillsLabel = new TextRenderable(renderer, {
      content: "\n🛠️  Skills:",
      fg: "#38bdf8",
      id: "skills-label",
      marginBottom: 0,
    });
    content.add(skillsLabel);

    if (config.skills && config.skills.length > 0) {
      config.skills.forEach((skill, i) => {
        const skillText = new TextRenderable(renderer, {
          content: `  • ${skill}`,
          fg: "#94a3b8",
          id: `skill-${i}`,
        });
        content.add(skillText);
      });
    } else {
      const noSkills = new TextRenderable(renderer, {
        content: "  (none)",
        fg: "#64748b",
        id: "no-skills",
      });
      content.add(noSkills);
    }

    // Goal
    const goalLabel = new TextRenderable(renderer, {
      content: "\n🎯 Goal:",
      fg: "#38bdf8",
      id: "goal-label",
      marginBottom: 0,
    });
    content.add(goalLabel);

    const goalText = new TextRenderable(renderer, {
      content: config.goal ? `  ${config.goal}` : "  (none)",
      fg: config.goal ? "#94a3b8" : "#64748b",
      id: "goal-text",
      marginBottom: 2,
    });
    content.add(goalText);

    // Confirmation question
    const confirmText = new TextRenderable(renderer, {
      content: "Does this look right?",
      fg: "#e2e8f0",
      id: "confirm-question",
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
      back: true,
      custom: [
        "Enter Confirm",
        "b Back to Chat",
        "e Manual Edit",
        "Esc Cancel",
      ],
      navigate: false,
      select: false,
    });
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
