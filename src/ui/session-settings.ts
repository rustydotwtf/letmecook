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

interface UIRefs {
  content: ReturnType<typeof createBaseLayout>["content"];
  goalInput: InputRenderable;
  goalLabel: TextRenderable;
  renderer: CliRenderer;
  reposLabel: TextRenderable;
  reposList: TextRenderable;
  skillsLabel: TextRenderable;
  skillsList: TextRenderable;
  statusText: TextRenderable;
}

interface UIState {
  editMode: EditMode;
  selectedRepoIndex: number;
  selectedSkillIndex: number;
  selectedTarget: SelectionTarget;
  session: Session;
  updatedGoal: string;
  updatedRepos: RepoSpec[];
  updatedSkills: string[];
}

interface SessionContext {
  cleanup: () => void;
  refs: UIRefs;
  resolve: (result: SessionSettingsResult) => void;
  state: UIState;
}

function createTextElement(
  renderer: CliRenderer,
  content: ReturnType<typeof createBaseLayout>["content"],
  id: string,
  textContent: string,
  fg: string,
  marginTop = 0,
  marginBottom = 0
): TextRenderable {
  const element = new TextRenderable(renderer, {
    content: textContent,
    fg,
    id,
    marginBottom,
    marginTop,
  });
  content.add(element);
  return element;
}

function addGoalElements(
  renderer: CliRenderer,
  content: ReturnType<typeof createBaseLayout>["content"],
  refs: Partial<UIRefs>,
  session: Session
): void {
  refs.goalLabel = createTextElement(
    renderer,
    content,
    "goal-label",
    "Goal:",
    "#e2e8f0"
  );

  refs.goalInput = new InputRenderable(renderer, {
    backgroundColor: "#334155",
    cursorColor: "#38bdf8",
    height: 1,
    id: "goal-input",
    marginTop: 1,
    placeholder: "Add a goal for this session",
    placeholderColor: "#64748b",
    textColor: "#f8fafc",
    width: 60,
  });
  refs.goalInput.value = session.goal ?? "";
  content.add(refs.goalInput);
}

function addRepoElements(
  renderer: CliRenderer,
  content: ReturnType<typeof createBaseLayout>["content"],
  refs: Partial<UIRefs>
): void {
  refs.reposLabel = createTextElement(
    renderer,
    content,
    "repos-label",
    "\nRepositories:",
    "#e2e8f0",
    1
  );

  refs.reposList = createTextElement(
    renderer,
    content,
    "repos-list",
    "(none)",
    "#64748b"
  );
}

function addSkillElements(
  renderer: CliRenderer,
  content: ReturnType<typeof createBaseLayout>["content"],
  refs: Partial<UIRefs>
): void {
  refs.skillsLabel = createTextElement(
    renderer,
    content,
    "skills-label",
    "\nSkills:",
    "#e2e8f0",
    1
  );

  refs.skillsList = createTextElement(
    renderer,
    content,
    "skills-list",
    "(none)",
    "#64748b"
  );
}

function createUIElements(
  renderer: CliRenderer,
  content: ReturnType<typeof createBaseLayout>["content"],
  session: Session
): UIRefs {
  createTextElement(
    renderer,
    content,
    "session-info",
    `Session: ${session.name}`,
    "#38bdf8",
    0,
    1
  );

  const refs: Partial<UIRefs> = { content, renderer };
  addGoalElements(renderer, content, refs, session);
  addRepoElements(renderer, content, refs);
  addSkillElements(renderer, content, refs);

  refs.statusText = createTextElement(
    renderer,
    content,
    "status",
    "",
    "#64748b",
    1
  );

  return refs as UIRefs;
}

function createUIState(session: Session): UIState {
  return {
    editMode: "repos",
    selectedRepoIndex: 0,
    selectedSkillIndex: 0,
    selectedTarget: "goal",
    session,
    updatedGoal: session.goal ?? "",
    updatedRepos: session.repos.map((repo) => ({ ...repo })),
    updatedSkills: [...(session.skills || [])],
  };
}

function updateReposList(state: UIState, refs: UIRefs): void {
  if (state.updatedRepos.length === 0) {
    refs.reposList.content = "(none)";
    refs.reposList.fg = "#64748b";
    return;
  }

  refs.reposList.content = state.updatedRepos
    .map((repo, index) => {
      const marker =
        state.selectedTarget === "repo" && index === state.selectedRepoIndex
          ? "▶"
          : " ";
      return `${marker} ${formatRepoString(repo)}`;
    })
    .join("\n");
  refs.reposList.fg = "#94a3b8";
}

function updateSkillsList(state: UIState, refs: UIRefs): void {
  if (state.updatedSkills.length === 0) {
    refs.skillsList.content = "(none)";
    refs.skillsList.fg = "#64748b";
    return;
  }

  refs.skillsList.content = state.updatedSkills
    .map((skill, index) => {
      const marker =
        state.selectedTarget === "skill" && index === state.selectedSkillIndex
          ? "▶"
          : " ";
      return `${marker} ${skill}`;
    })
    .join("\n");
  refs.skillsList.fg = "#94a3b8";
}

function updateGoalLabel(state: UIState, refs: UIRefs): void {
  if (state.selectedTarget === "goal") {
    refs.goalLabel.content = "▶ Goal:";
  } else {
    refs.goalLabel.content = "Goal:";
  }
}

function updateReposLabel(state: UIState, refs: UIRefs): void {
  if (state.selectedTarget === "repo") {
    refs.reposLabel.content = "▶ Repositories:";
  } else {
    refs.reposLabel.content = "\nRepositories:";
  }
}

function updateSkillsLabel(state: UIState, refs: UIRefs): void {
  if (state.selectedTarget === "skill") {
    refs.skillsLabel.content = "▶ Skills:";
  } else {
    refs.skillsLabel.content = "\nSkills:";
  }
}

function updateEditMode(
  state: UIState,
  refs: UIRefs,
  nextMode: EditMode
): void {
  state.editMode = nextMode;
  if (nextMode === "goal") {
    refs.goalInput.focus();
    refs.statusText.content = "Editing goal. Press Enter to return.";
    refs.statusText.fg = "#38bdf8";
  } else {
    refs.goalInput.blur();
    refs.statusText.content = "";
  }
}

function getNextTarget(
  currentTarget: SelectionTarget,
  hasRepos: boolean,
  hasSkills: boolean
): SelectionTarget {
  let goalNext: SelectionTarget = "goal";
  if (hasRepos) {
    goalNext = "repo";
  } else if (hasSkills) {
    goalNext = "skill";
  }
  const transitionMap: Record<SelectionTarget, SelectionTarget> = {
    goal: goalNext,
    repo: hasSkills ? "skill" : "goal",
    skill: "goal",
  };
  return transitionMap[currentTarget];
}

function hasSingleSection(state: UIState): boolean {
  const hasRepos = state.updatedRepos.length > 0;
  const hasSkills = state.updatedSkills.length > 0;
  return !hasRepos && !hasSkills;
}

function shouldSkipSectionSwitch(state: UIState): boolean {
  const hasRepos = state.updatedRepos.length > 0;
  const hasSkills = state.updatedSkills.length > 0;
  const singleSection = hasSingleSection(state);
  const onlyRepos = hasRepos && !hasSkills && state.selectedTarget === "repo";
  const onlySkills = !hasRepos && hasSkills && state.selectedTarget === "skill";
  return singleSection || onlyRepos || onlySkills;
}

function updateTargetIndices(
  state: UIState,
  nextTarget: SelectionTarget
): void {
  if (nextTarget === "repo") {
    state.selectedRepoIndex = 0;
  } else if (nextTarget === "skill") {
    state.selectedSkillIndex = 0;
  }
}

function updateSectionLabels(state: UIState, refs: UIRefs): void {
  updateGoalLabel(state, refs);
  updateReposLabel(state, refs);
  updateSkillsLabel(state, refs);
}

function switchToNextSection(state: UIState, refs: UIRefs): void {
  if (shouldSkipSectionSwitch(state)) {
    return;
  }

  const hasRepos = state.updatedRepos.length > 0;
  const hasSkills = state.updatedSkills.length > 0;
  const nextTarget = getNextTarget(state.selectedTarget, hasRepos, hasSkills);
  state.selectedTarget = nextTarget;
  updateTargetIndices(state, nextTarget);
  updateSectionLabels(state, refs);
}

function getFooterActions(state: UIState): string[] {
  const customActions: string[] = [];
  if (state.selectedTarget === "goal") {
    customActions.push("Enter Edit");
  } else if (state.selectedTarget === "repo") {
    customActions.push("l Toggle Read-only", "a Add repos");
  } else if (state.selectedTarget === "skill") {
    customActions.push("x Remove", "a Add repos");
  }
  customActions.push("+ Add skills", "Enter Save");
  return customActions;
}

function updateFooter(refs: UIRefs, state: UIState): void {
  const customActions = getFooterActions(state);

  hideFooter(refs.renderer);
  showFooter(refs.renderer, refs.content, {
    back: true,
    custom: ["Tab Switch", ...customActions],
    navigate: true,
    select: false,
  });
}

function handleArrowUp(state: UIState, refs: UIRefs): void {
  if (state.selectedTarget === "skill" && state.selectedSkillIndex > 0) {
    state.selectedSkillIndex = Math.max(0, state.selectedSkillIndex - 1);
  } else if (state.selectedTarget === "repo" && state.selectedRepoIndex > 0) {
    state.selectedRepoIndex = Math.max(0, state.selectedRepoIndex - 1);
  }
  updateReposList(state, refs);
  updateSkillsList(state, refs);
}

function handleArrowDown(state: UIState, refs: UIRefs): void {
  if (
    state.selectedTarget === "repo" &&
    state.selectedRepoIndex < state.updatedRepos.length - 1
  ) {
    state.selectedRepoIndex = Math.min(
      state.updatedRepos.length - 1,
      state.selectedRepoIndex + 1
    );
  } else if (
    state.selectedTarget === "skill" &&
    state.selectedSkillIndex < state.updatedSkills.length - 1
  ) {
    state.selectedSkillIndex = Math.min(
      state.updatedSkills.length - 1,
      state.selectedSkillIndex + 1
    );
  }
  updateReposList(state, refs);
  updateSkillsList(state, refs);
}

function handleArrowKeys(state: UIState, refs: UIRefs, key: KeyEvent): boolean {
  if (isArrowUp(key)) {
    handleArrowUp(state, refs);
    return true;
  }

  if (isArrowDown(key)) {
    handleArrowDown(state, refs);
    return true;
  }

  return false;
}

function createUpdatedSession(state: UIState): Session {
  return {
    ...state.session,
    goal: state.updatedGoal || undefined,
    repos: state.updatedRepos,
    skills: state.updatedSkills.length > 0 ? state.updatedSkills : undefined,
  };
}

function handleSave(ctx: SessionContext): void {
  ctx.state.updatedGoal = ctx.refs.goalInput.value.trim();
  const updatedSession = createUpdatedSession(ctx.state);
  ctx.cleanup();
  ctx.resolve({ action: "saved", session: updatedSession });
}

function handleAddRepos(ctx: SessionContext): void {
  ctx.state.updatedGoal = ctx.refs.goalInput.value.trim();
  const updatedSession: Session = {
    ...ctx.state.session,
    goal: ctx.state.updatedGoal || undefined,
    repos: ctx.state.updatedRepos,
    skills: ctx.state.updatedSkills,
  };
  ctx.cleanup();
  ctx.resolve({ action: "add-repos", session: updatedSession });
}

function handleAddSkills(ctx: SessionContext): void {
  ctx.state.updatedGoal = ctx.refs.goalInput.value.trim();
  const updatedSession: Session = {
    ...ctx.state.session,
    goal: ctx.state.updatedGoal || undefined,
    repos: ctx.state.updatedRepos,
    skills: ctx.state.updatedSkills,
  };
  ctx.cleanup();
  ctx.resolve({ action: "add-skills", session: updatedSession });
}

function updateAfterSkillRemoval(state: UIState, refs: UIRefs): void {
  if (state.selectedSkillIndex >= state.updatedSkills.length) {
    state.selectedSkillIndex = Math.max(0, state.updatedSkills.length - 1);
  }
  if (state.updatedSkills.length === 0) {
    state.selectedTarget = state.updatedRepos.length > 0 ? "repo" : "goal";
    updateGoalLabel(state, refs);
    updateReposLabel(state, refs);
    updateSkillsLabel(state, refs);
  }
  updateReposList(state, refs);
  updateSkillsList(state, refs);
}

function handleRemoveSkill(ctx: SessionContext): void {
  const skill = ctx.state.updatedSkills[ctx.state.selectedSkillIndex];
  if (!skill) {
    return;
  }

  ctx.state.updatedSkills.splice(ctx.state.selectedSkillIndex, 1);
  updateAfterSkillRemoval(ctx.state, ctx.refs);
}

function handleToggleRepoReadOnly(state: UIState, refs: UIRefs): void {
  const repo = state.updatedRepos[state.selectedRepoIndex];
  if (repo) {
    repo.latest = !repo.latest;
    repo.readOnly = repo.latest;
    updateReposList(state, refs);
  }
}

function handleGoalModeEnter(ctx: SessionContext): void {
  ctx.state.updatedGoal = ctx.refs.goalInput.value.trim();
  updateEditMode(ctx.state, ctx.refs, "repos");
  updateFooter(ctx.refs, ctx.state);
}

function handleGoalModeEscape(ctx: SessionContext): void {
  ctx.refs.goalInput.value = ctx.state.updatedGoal;
  updateEditMode(ctx.state, ctx.refs, "repos");
  updateFooter(ctx.refs, ctx.state);
}

function handleGoalModeKey(ctx: SessionContext, key: KeyEvent): void {
  if (isEnter(key)) {
    handleGoalModeEnter(ctx);
  } else if (isEscape(key)) {
    handleGoalModeEscape(ctx);
  }
}

function handleHotkeyA(ctx: SessionContext): boolean {
  handleAddRepos(ctx);
  return true;
}

function handleHotkeyPlus(ctx: SessionContext): boolean {
  handleAddSkills(ctx);
  return true;
}

function handleHotkeyX(ctx: SessionContext): boolean {
  if (ctx.state.selectedTarget !== "skill") {
    return false;
  }
  handleRemoveSkill(ctx);
  updateFooter(ctx.refs, ctx.state);
  return true;
}

function handleHotkeyL(ctx: SessionContext): boolean {
  if (ctx.state.selectedTarget !== "repo") {
    return false;
  }
  handleToggleRepoReadOnly(ctx.state, ctx.refs);
  return true;
}

function handleHotkeys(ctx: SessionContext, key: KeyEvent): boolean {
  if (key.name === "a") {
    return handleHotkeyA(ctx);
  }

  if (key.name === "+" || key.name === "=") {
    return handleHotkeyPlus(ctx);
  }

  if (key.name === "x") {
    return handleHotkeyX(ctx);
  }

  if (key.name === "l") {
    return handleHotkeyL(ctx);
  }

  return false;
}

function handleEnterKey(ctx: SessionContext): void {
  if (ctx.state.selectedTarget === "goal") {
    updateEditMode(ctx.state, ctx.refs, "goal");
  } else {
    handleSave(ctx);
  }
}

function handleEscapeKey(ctx: SessionContext): void {
  ctx.cleanup();
  ctx.resolve({ action: "cancel", session: ctx.state.session });
}

function handleTabKey(ctx: SessionContext): void {
  switchToNextSection(ctx.state, ctx.refs);
  updateFooter(ctx.refs, ctx.state);
}

function handleNavEscape(ctx: SessionContext, key: KeyEvent): boolean {
  if (isEscape(key)) {
    handleEscapeKey(ctx);
    return true;
  }
  return false;
}

function handleNavTab(ctx: SessionContext, key: KeyEvent): boolean {
  if (isTab(key)) {
    handleTabKey(ctx);
    return true;
  }
  return false;
}

function handleNavEnter(ctx: SessionContext, key: KeyEvent): boolean {
  if (isEnter(key)) {
    handleEnterKey(ctx);
    return true;
  }
  return false;
}

function handleNavigationKeys(ctx: SessionContext, key: KeyEvent): boolean {
  if (handleNavEscape(ctx, key)) {
    return true;
  }

  if (handleNavTab(ctx, key)) {
    return true;
  }

  if (handleArrowKeys(ctx.state, ctx.refs, key)) {
    return true;
  }

  return handleNavEnter(ctx, key);
}

function handleKeypress(ctx: SessionContext, key: KeyEvent): void {
  if (ctx.state.editMode === "goal") {
    handleGoalModeKey(ctx, key);
    return;
  }

  if (handleNavigationKeys(ctx, key)) {
    return;
  }

  handleHotkeys(ctx, key);
}

function initializeUI(state: UIState, refs: UIRefs): void {
  updateGoalLabel(state, refs);
  updateReposLabel(state, refs);
  updateSkillsLabel(state, refs);
  updateReposList(state, refs);
  updateSkillsList(state, refs);
  updateEditMode(state, refs, "repos");
  updateFooter(refs, state);
}

type KeyHandler = (key: KeyEvent) => void;

function createCleanup(
  renderer: CliRenderer,
  refs: UIRefs,
  keyHandler: KeyHandler
): () => void {
  return () => {
    renderer.keyInput.off("keypress", keyHandler);
    refs.goalInput.blur();
    hideFooter(renderer);
    clearLayout(renderer);
  };
}

interface SettingsState {
  ctx: SessionContext;
  keyHandler: KeyHandler;
  refs: UIRefs;
  state: UIState;
}

function createSettingsState(
  renderer: CliRenderer,
  session: Session,
  resolve: (result: SessionSettingsResult) => void
): SettingsState {
  const { content } = createBaseLayout(renderer, "Edit session settings");
  const refs = createUIElements(renderer, content, session);
  const state = createUIState(session);

  // Use a mutable object to hold cleanup function
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Placeholder until cleanup is set
  const cleanupHolder: { fn: () => void } = { fn: () => {} };

  const ctx: SessionContext = {
    cleanup: () => cleanupHolder.fn(),
    refs,
    resolve,
    state,
  };

  const keyHandler: KeyHandler = (key: KeyEvent) => handleKeypress(ctx, key);

  // Set the actual cleanup function
  cleanupHolder.fn = createCleanup(renderer, refs, keyHandler);

  renderer.keyInput.on("keypress", keyHandler);

  return { ctx, keyHandler, refs, state };
}

export function showSessionSettings(
  renderer: CliRenderer,
  session: Session
): Promise<SessionSettingsResult> {
  // eslint-disable-next-line promise/avoid-new -- Event-based async requires Promise constructor
  return new Promise((resolve) => {
    clearLayout(renderer);

    const { refs, state } = createSettingsState(renderer, session, resolve);

    initializeUI(state, refs);
  });
}
