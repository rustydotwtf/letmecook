import {
  type CliRenderer,
  TextRenderable,
  InputRenderable,
  type BoxRenderable,
  type KeyEvent,
} from "@opentui/core";

import { showFooter, hideFooter } from "./common/footer";
import { isEnter, isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export interface SkillsPromptResult {
  skills: string[];
  cancelled: boolean;
}

interface SkillsUIState {
  content: ReturnType<typeof createBaseLayout>["content"];
  input: InputRenderable;
  existingSkillsText: TextRenderable;
  skillsCounter: TextRenderable;
  skills: string[];
}

function addDescription(renderer: CliRenderer, content: BoxRenderable): void {
  const description = new TextRenderable(renderer, {
    content:
      "Enter skill packages to install (e.g., vercel-labs/agent-skills).\nSkills will be installed in the session directory.",
    fg: "#64748b",
    id: "description",
    marginBottom: 1,
  });
  content.add(description);
}

function createInput(
  renderer: CliRenderer,
  content: BoxRenderable
): InputRenderable {
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
  return input;
}

function createSkillsUIElements(
  renderer: CliRenderer,
  content: BoxRenderable
): {
  existingSkillsText: TextRenderable;
  skillsCounter: TextRenderable;
} {
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

  return { existingSkillsText, skillsCounter };
}

function setupSkillsUI(renderer: CliRenderer): SkillsUIState {
  clearLayout(renderer);
  const { content } = createBaseLayout(renderer, "Add skills to session");
  addDescription(renderer, content);
  const input = createInput(renderer, content);
  const uiElements = createSkillsUIElements(renderer, content);

  return {
    content,
    existingSkillsText: uiElements.existingSkillsText,
    input,
    skills: [],
    skillsCounter: uiElements.skillsCounter,
  };
}

function updateExistingSkills(
  skills: string[],
  existingSkillsText: TextRenderable,
  skillsCounter: TextRenderable
): void {
  if (skills.length === 0) {
    existingSkillsText.content = "(none)";
    existingSkillsText.fg = "#64748b";
    skillsCounter.content = "";
  } else {
    existingSkillsText.content = skills
      .map((skill) => `  ✓ ${skill}`)
      .join("\n");
    existingSkillsText.fg = "#94a3b8";
    skillsCounter.content = `Added: ${skills.length} ${skills.length === 1 ? "skill" : "skills"}`;
  }
}

export function showSkillsPrompt(
  renderer: CliRenderer,
  _existingSkills: string[] = []
): Promise<SkillsPromptResult> {
  const state = setupSkillsUI(renderer);

  let resolveFn: (result: SkillsPromptResult) => void;

  const cleanup = () => {
    renderer.keyInput.off("keypress", handleKeypress);
    state.input.blur();
    hideFooter(renderer);
    clearLayout(renderer);
  };

  const handleKeypress = (key: KeyEvent) => {
    if (isEscape(key)) {
      cleanup();
      resolveFn({
        cancelled: true,
        skills: [],
      });
    } else if (isEnter(key)) {
      const skill = state.input.value.trim();
      if (skill) {
        state.skills.push(skill);
        updateExistingSkills(
          state.skills,
          state.existingSkillsText,
          state.skillsCounter
        );
        state.input.value = "";
      } else {
        cleanup();
        resolveFn({
          cancelled: false,
          skills: state.skills,
        });
      }
    }
  };

  state.input.focus();
  showFooter(renderer, state.content, {
    back: true,
    custom: ["Enter Add/Done"],
    navigate: false,
    select: true,
  });
  renderer.keyInput.on("keypress", handleKeypress);
  updateExistingSkills(
    state.skills,
    state.existingSkillsText,
    state.skillsCounter
  );

  // eslint-disable-next-line promise/avoid-new -- Needed for event-driven UI pattern
  return new Promise((resolve) => {
    resolveFn = resolve;
  });
}
