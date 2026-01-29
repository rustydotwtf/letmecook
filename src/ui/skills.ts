import {
  type CliRenderer,
  TextRenderable,
  InputRenderable,
  type KeyEvent,
} from "@opentui/core";

import { showFooter, hideFooter } from "./common/footer";
import { isEnter, isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export interface SkillsPromptResult {
  skills: string[];
  cancelled: boolean;
}

export function showSkillsPrompt(
  renderer: CliRenderer,
  _existingSkills: string[] = []
): Promise<SkillsPromptResult> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Add skills to session");

    const description = new TextRenderable(renderer, {
      content:
        "Enter skill packages to install (e.g., vercel-labs/agent-skills).\nSkills will be installed in the session directory.",
      fg: "#64748b",
      id: "description",
      marginBottom: 1,
    });
    content.add(description);

    const input = new InputRenderable(renderer, {
      backgroundColor: "#334155",
      cursorColor: "#38bdf8",
      height: 1,
      id: "skill-input",
      marginTop: 1,
      placeholder: "Enter skill package",
      placeholderColor: "#64748b",
      textColor: "#f8fafc",
      width: 60,
    });
    content.add(input);

    const skillsLabel = new TextRenderable(renderer, {
      content: "\nAdded skills:",
      fg: "#e2e8f0",
      id: "skills-label",
      marginBottom: 0,
      marginTop: 1,
    });
    content.add(skillsLabel);

    const existingSkillsText = new TextRenderable(renderer, {
      content: "(none)",
      fg: "#64748b",
      id: "existing-skills",
      marginBottom: 0,
      marginTop: 1,
    });
    content.add(existingSkillsText);

    const skillsCounter = new TextRenderable(renderer, {
      content: "",
      fg: "#94a3b8",
      id: "skills-counter",
      marginTop: 0,
    });
    content.add(skillsCounter);

    const skills: string[] = [];

    const updateExistingSkills = () => {
      if (skills.length === 0) {
        existingSkillsText.content = "(none)";
        existingSkillsText.fg = "#64748b";
        skillsCounter.content = "";
      } else {
        const text = skills.map((skill) => `  ✓ ${skill}`).join("\n");
        existingSkillsText.content = text;
        existingSkillsText.fg = "#94a3b8";
        skillsCounter.content = `Added: ${skills.length} ${skills.length === 1 ? "skill" : "skills"}`;
      }
    };

    const cleanup = () => {
      renderer.keyInput.off("keypress", handleKeypress);
      input.blur();
      hideFooter(renderer);
      clearLayout(renderer);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        cleanup();
        resolve({
          cancelled: true,
          skills: [],
        });
        return;
      }

      if (isEnter(key)) {
        const skill = input.value.trim();
        if (skill) {
          // Add skill
          skills.push(skill);
          updateExistingSkills();
          input.value = "";
        } else {
          // Empty input = done (with or without skills)
          cleanup();
          resolve({
            cancelled: false,
            skills,
          });
        }
        return;
      }
    };

    input.focus();
    showFooter(renderer, content, {
      back: true,
      custom: ["Enter Add/Done"],
      navigate: false,
      select: true,
    });
    renderer.keyInput.on("keypress", handleKeypress);
    updateExistingSkills();
  });
}
