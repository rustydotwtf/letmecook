import { type CliRenderer, TextRenderable, InputRenderable, type KeyEvent } from "@opentui/core";
import { createBaseLayout, clearLayout } from "./renderer";
import { showFooter, hideFooter } from "./common/footer";
import { isEnter, isEscape } from "./common/keyboard";

export interface SkillsPromptResult {
  skills: string[];
  cancelled: boolean;
}

export async function showSkillsPrompt(
  renderer: CliRenderer,
  _existingSkills: string[] = [],
): Promise<SkillsPromptResult> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Add skills to session");

    const description = new TextRenderable(renderer, {
      id: "description",
      content:
        "Enter skill packages to install (e.g., vercel-labs/agent-skills).\nSkills will be installed in the session directory.",
      fg: "#64748b",
      marginBottom: 1,
    });
    content.add(description);

    const input = new InputRenderable(renderer, {
      id: "skill-input",
      width: 60,
      height: 1,
      placeholder: "Enter skill package",
      placeholderColor: "#64748b",
      backgroundColor: "#334155",
      textColor: "#f8fafc",
      cursorColor: "#38bdf8",
      marginTop: 1,
    });
    content.add(input);

    const skillsLabel = new TextRenderable(renderer, {
      id: "skills-label",
      content: "\nAdded skills:",
      fg: "#e2e8f0",
      marginTop: 1,
      marginBottom: 0,
    });
    content.add(skillsLabel);

    const existingSkillsText = new TextRenderable(renderer, {
      id: "existing-skills",
      content: "(none)",
      fg: "#64748b",
      marginTop: 1,
      marginBottom: 0,
    });
    content.add(existingSkillsText);

    const skillsCounter = new TextRenderable(renderer, {
      id: "skills-counter",
      content: "",
      fg: "#94a3b8",
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
          skills: [],
          cancelled: true,
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
            skills,
            cancelled: false,
          });
        }
        return;
      }
    };

    input.focus();
    showFooter(renderer, content, {
      navigate: false,
      select: true,
      back: true,
      custom: ["Enter Add/Done"],
    });
    renderer.keyInput.on("keypress", handleKeypress);
    updateExistingSkills();
  });
}
