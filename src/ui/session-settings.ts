import {
  type CliRenderer,
  TextRenderable,
  InputRenderable,
  type KeyEvent,
} from "@opentui/core";

import type { Session, RepoSpec } from "../types";

import { showFooter, hideFooter } from "./common/footer";
import {
  isEnter,
  isEscape,
  isTab,
  isArrowUp,
  isArrowDown,
} from "./common/keyboard";
import { formatRepoString } from "./common/repo-formatter";
import { createBaseLayout, clearLayout } from "./renderer";

export interface SessionSettingsResult {
  action: "saved" | "add-repos" | "add-skills" | "cancel";
  session: Session;
}

type EditMode = "repos" | "goal";
type SelectionTarget = "goal" | "repo" | "skill";

export function showSessionSettings(
  renderer: CliRenderer,
  session: Session
): Promise<SessionSettingsResult> {
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Edit session settings");

    const sessionInfo = new TextRenderable(renderer, {
      id: "session-info",
      content: `Session: ${session.name}`,
      fg: "#38bdf8",
      marginBottom: 1,
    });
    content.add(sessionInfo);

    const goalLabel = new TextRenderable(renderer, {
      id: "goal-label",
      content: "Goal:",
      fg: "#e2e8f0",
      marginBottom: 0,
    });
    content.add(goalLabel);

    const goalInput = new InputRenderable(renderer, {
      id: "goal-input",
      width: 60,
      height: 1,
      placeholder: "Add a goal for this session",
      placeholderColor: "#64748b",
      backgroundColor: "#334155",
      textColor: "#f8fafc",
      cursorColor: "#38bdf8",
      marginTop: 1,
    });
    goalInput.value = session.goal ?? "";
    content.add(goalInput);

    const reposLabel = new TextRenderable(renderer, {
      id: "repos-label",
      content: "\nRepositories:",
      fg: "#e2e8f0",
      marginTop: 1,
      marginBottom: 0,
    });
    content.add(reposLabel);

    const reposList = new TextRenderable(renderer, {
      id: "repos-list",
      content: "(none)",
      fg: "#94a3b8",
      marginTop: 0,
    });
    content.add(reposList);

    const skillsLabel = new TextRenderable(renderer, {
      id: "skills-label",
      content: "\nSkills:",
      fg: "#e2e8f0",
      marginTop: 1,
      marginBottom: 0,
    });
    content.add(skillsLabel);

    const skillsList = new TextRenderable(renderer, {
      id: "skills-list",
      content: "(none)",
      fg: "#94a3b8",
      marginTop: 0,
    });
    content.add(skillsList);

    const statusText = new TextRenderable(renderer, {
      id: "status",
      content: "",
      fg: "#64748b",
      marginTop: 1,
    });
    content.add(statusText);

    const instructions = new TextRenderable(renderer, {
      id: "instructions",
      content: "",
      fg: "#64748b",
      marginTop: 1,
    });
    content.add(instructions);

    let mode: EditMode = "repos";
    let selectedTarget: SelectionTarget = "goal";
    let selectedRepoIndex = 0;
    let selectedSkillIndex = 0;
    const updatedRepos: RepoSpec[] = session.repos.map((repo) => ({ ...repo }));
    const updatedSkills = (session.skills || []).slice();
    let updatedGoal = session.goal ?? "";

    const updateReposList = () => {
      if (updatedRepos.length === 0) {
        reposList.content = "(none)";
        reposList.fg = "#64748b";
        return;
      }

      reposList.content = updatedRepos
        .map((repo, index) => {
          const marker =
            selectedTarget === "repo" && index === selectedRepoIndex
              ? "▶"
              : " ";
          return `${marker} ${formatRepoString(repo)}`;
        })
        .join("\n");
      reposList.fg = "#94a3b8";
    };

    const updateSkillsList = () => {
      if (updatedSkills.length === 0) {
        skillsList.content = "(none)";
        skillsList.fg = "#64748b";
        return;
      }

      skillsList.content = updatedSkills
        .map((skill, index) => {
          const marker =
            selectedTarget === "skill" && index === selectedSkillIndex
              ? "▶"
              : " ";
          return `${marker} ${skill}`;
        })
        .join("\n");
      skillsList.fg = "#94a3b8";
    };

    const updateGoalLabel = () => {
      if (selectedTarget === "goal") {
        goalLabel.content = "▶ Goal:";
      } else {
        goalLabel.content = "Goal:";
      }
    };

    const updateReposLabel = () => {
      if (selectedTarget === "repo") {
        reposLabel.content = "▶ Repositories:";
      } else {
        reposLabel.content = "Repositories:";
      }
    };

    const updateSkillsLabel = () => {
      if (selectedTarget === "skill") {
        skillsLabel.content = "▶ Skills:";
      } else {
        skillsLabel.content = "Skills:";
      }
    };

    const updateMode = (nextMode: EditMode) => {
      mode = nextMode;
      if (mode === "goal") {
        goalInput.focus();
        statusText.content = "Editing goal. Press Enter to return.";
        statusText.fg = "#38bdf8";
      } else {
        goalInput.blur();
        statusText.content = "";
      }
    };

    const switchToNextSection = () => {
      if (selectedTarget === "goal") {
        if (updatedRepos.length > 0) {
          selectedTarget = "repo";
          selectedRepoIndex = 0;
        } else if (updatedSkills.length > 0) {
          selectedTarget = "skill";
          selectedSkillIndex = 0;
        }
      } else if (selectedTarget === "repo") {
        if (updatedSkills.length > 0) {
          selectedTarget = "skill";
          selectedSkillIndex = 0;
        } else {
          selectedTarget = "goal";
        }
      } else if (selectedTarget === "skill") {
        selectedTarget = "goal";
      }
      updateGoalLabel();
      updateReposLabel();
      updateSkillsLabel();
      updateFooter();
    };

    const updateFooter = () => {
      const customActions: string[] = [];
      if (selectedTarget === "goal") {
        customActions.push("Enter Edit");
      } else if (selectedTarget === "repo") {
        customActions.push("l Toggle Read-only", "a Add repos");
      } else if (selectedTarget === "skill") {
        customActions.push("x Remove", "a Add repos");
      }
      customActions.push("+ Add skills", "Enter Save");

      hideFooter(renderer);
      showFooter(renderer, content, {
        navigate: true,
        select: false,
        back: true,
        custom: ["Tab Switch", ...customActions],
      });
    };

    const handleKeypress = (key: KeyEvent) => {
      if (mode === "goal") {
        if (isEnter(key)) {
          updatedGoal = goalInput.value.trim();
          updateMode("repos");
          updateFooter();
        } else if (isEscape(key)) {
          goalInput.value = updatedGoal;
          updateMode("repos");
          updateFooter();
        }
        return;
      }

      if (isEscape(key)) {
        cleanup();
        resolve({ action: "cancel", session });
        return;
      }

      // Tab to switch sections
      if (isTab(key)) {
        switchToNextSection();
        return;
      }

      // Arrow keys for navigation within sections
      if (isArrowUp(key)) {
        if (selectedTarget === "skill" && selectedSkillIndex > 0) {
          selectedSkillIndex = Math.max(0, selectedSkillIndex - 1);
        } else if (selectedTarget === "repo" && selectedRepoIndex > 0) {
          selectedRepoIndex = Math.max(0, selectedRepoIndex - 1);
        }
        updateReposList();
        updateSkillsList();
        return;
      }

      if (isArrowDown(key)) {
        if (
          selectedTarget === "repo" &&
          selectedRepoIndex < updatedRepos.length - 1
        ) {
          selectedRepoIndex = Math.min(
            updatedRepos.length - 1,
            selectedRepoIndex + 1
          );
        } else if (
          selectedTarget === "skill" &&
          selectedSkillIndex < updatedSkills.length - 1
        ) {
          selectedSkillIndex = Math.min(
            updatedSkills.length - 1,
            selectedSkillIndex + 1
          );
        }
        updateReposList();
        updateSkillsList();
        return;
      }

      // Enter to edit goal or save
      if (isEnter(key)) {
        if (selectedTarget === "goal") {
          updateMode("goal");
        } else {
          // Save changes
          updatedGoal = goalInput.value.trim();
          const updatedSession: Session = {
            ...session,
            repos: updatedRepos,
            skills: updatedSkills.length > 0 ? updatedSkills : undefined,
            goal: updatedGoal || undefined,
          };
          cleanup();
          resolve({ action: "saved", session: updatedSession });
        }
        return;
      }

      // Hotkeys
      if (key.name === "a") {
        updatedGoal = goalInput.value.trim();
        const updatedSession: Session = {
          ...session,
          repos: updatedRepos,
          skills: updatedSkills,
          goal: updatedGoal || undefined,
        };
        cleanup();
        resolve({ action: "add-repos", session: updatedSession });
        return;
      }

      if (key.name === "+" || key.name === "=") {
        // + or = for add skills
        updatedGoal = goalInput.value.trim();
        const updatedSession: Session = {
          ...session,
          repos: updatedRepos,
          skills: updatedSkills,
          goal: updatedGoal || undefined,
        };
        cleanup();
        resolve({ action: "add-skills", session: updatedSession });
        return;
      }

      if (key.name === "x" && selectedTarget === "skill") {
        const skill = updatedSkills[selectedSkillIndex];
        if (skill) {
          updatedSkills.splice(selectedSkillIndex, 1);
          if (selectedSkillIndex >= updatedSkills.length) {
            selectedSkillIndex = Math.max(0, updatedSkills.length - 1);
          }
          if (updatedSkills.length === 0) {
            selectedTarget = updatedRepos.length > 0 ? "repo" : "goal";
            updateGoalLabel();
            updateReposLabel();
            updateSkillsLabel();
            updateFooter();
          }
          updateReposList();
          updateSkillsList();
        }
        return;
      }

      if (key.name === "l" && selectedTarget === "repo") {
        const repo = updatedRepos[selectedRepoIndex];
        if (repo) {
          repo.latest = !repo.latest;
          repo.readOnly = repo.latest;
          updateReposList();
        }
        return;
      }
    };

    const cleanup = () => {
      renderer.keyInput.off("keypress", handleKeypress);
      goalInput.blur();
      hideFooter(renderer);
      clearLayout(renderer);
    };

    updateGoalLabel();
    updateReposLabel();
    updateSkillsLabel();
    updateReposList();
    updateSkillsList();
    updateMode("repos");
    updateFooter();
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
