import {
  type CliRenderer,
  InputRenderable,
  type KeyEvent,
  TextRenderable,
} from "@opentui/core";

import { listRepoHistory } from "../repo-history";
import { type RepoSpec, parseRepoSpec } from "../types";
import { showFooter, hideFooter } from "./common/footer";
import { isEnter, isEscape, isArrowUp, isArrowDown } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export interface AddReposResult {
  cancelled: boolean;
  repos: RepoSpec[];
}

interface AddReposState {
  confirmOptionIndex: number;
  currentInput: string;
  currentLatest: boolean;
  currentReadOnly: boolean;
  currentValidRepo: RepoSpec | null;
  isConfirming: boolean;
  isNavigating: boolean;
  lastQuery: string;
  repos: RepoSpec[];
  selectedMatchIndex: number;
}

interface AddReposUI {
  confirmButton: TextRenderable;
  detailsLabel: TextRenderable;
  detailsLatest: TextRenderable;
  matchesList: TextRenderable;
  repoInput: InputRenderable;
  reposList: TextRenderable;
  statusText: TextRenderable;
}

function createInitialState(): AddReposState {
  return {
    confirmOptionIndex: 0,
    currentInput: "",
    currentLatest: false,
    currentReadOnly: false,
    currentValidRepo: null,
    isConfirming: false,
    isNavigating: false,
    lastQuery: "",
    repos: [],
    selectedMatchIndex: -1,
  };
}

function getDetailsLatestColor(
  latestSelected: boolean,
  currentLatest: boolean
): string {
  if (latestSelected) {
    return "#f8fafc";
  }
  if (currentLatest) {
    return "#22d3ee";
  }
  return "#94a3b8";
}

function renderConfirmationMode(state: AddReposState, ui: AddReposUI): void {
  ui.detailsLabel.content = `\nConfigure options for: ${state.currentInput.trim()}`;
  ui.detailsLabel.fg = "#38bdf8";

  const latestCheckbox = state.currentLatest ? "[✓]" : "[ ]";
  const latestSelected = state.confirmOptionIndex === 0;
  ui.detailsLatest.content = `  ${latestSelected ? "▶" : " "} ${latestCheckbox} Read-only [l]`;
  ui.detailsLatest.fg = getDetailsLatestColor(
    latestSelected,
    state.currentLatest
  );

  const confirmSelected = state.confirmOptionIndex === 1;
  ui.confirmButton.content = `  ${confirmSelected ? "▶" : " "} [Add repository]`;
  ui.confirmButton.fg = confirmSelected ? "#10b981" : "#64748b";
}

function renderValidRepoMode(ui: AddReposUI): void {
  ui.detailsLabel.content = "\nPress Enter to configure options";
  ui.detailsLabel.fg = "#64798b";
  ui.detailsLatest.content = "";
  ui.confirmButton.content = "";
}

function clearDetailsMode(ui: AddReposUI): void {
  ui.detailsLabel.content = "";
  ui.detailsLatest.content = "";
  ui.confirmButton.content = "";
}

function updateDetails(state: AddReposState, ui: AddReposUI): void {
  if (state.isConfirming && state.currentValidRepo) {
    renderConfirmationMode(state, ui);
  } else if (state.currentValidRepo) {
    renderValidRepoMode(ui);
  } else {
    clearDetailsMode(ui);
  }
}

function resetInputState(state: AddReposState, ui: AddReposUI): void {
  state.currentInput = "";
  state.currentLatest = false;
  state.currentReadOnly = false;
  state.currentValidRepo = null;
  state.lastQuery = "";
  state.selectedMatchIndex = -1;
  ui.repoInput.value = "";
  ui.statusText.content = "";
}

function updateRepoAfterValidation(
  state: AddReposState,
  repo: RepoSpec | null
): void {
  state.currentValidRepo = repo;
  if (repo) {
    state.currentReadOnly = false;
    state.currentLatest = false;
  }
}

function applySelectedMatch(
  state: AddReposState,
  ui: AddReposUI,
  selectedMatch: string,
  matchIndex: number,
  validateRepo: (spec: string) => RepoSpec | null
): void {
  state.selectedMatchIndex = matchIndex;
  state.isNavigating = true;
  ui.repoInput.value = selectedMatch;
  ui.repoInput.cursorPosition = selectedMatch.length;
  state.currentInput = selectedMatch;
  updateRepoAfterValidation(state, validateRepo(selectedMatch.trim()));
  state.isNavigating = false;
}

function handlePastedInput(
  state: AddReposState,
  ui: AddReposUI,
  validateRepo: (spec: string) => RepoSpec | null
): void {
  if (state.currentInput.trim()) {
    updateRepoAfterValidation(state, validateRepo(state.currentInput.trim()));
  } else {
    ui.statusText.content = "";
    state.currentValidRepo = null;
  }
}

function processPastedText(
  text: string,
  state: AddReposState,
  ui: AddReposUI,
  validateRepo: (spec: string) => RepoSpec | null,
  updateMatches: () => void
): void {
  const cleanText = text.replaceAll(/[\r\n]+/g, "");
  if (!cleanText) {
    return;
  }

  ui.repoInput.insertText(cleanText);
  state.currentInput = ui.repoInput.value;
  handlePastedInput(state, ui, validateRepo);
  state.selectedMatchIndex = -1;
  state.lastQuery = state.currentInput;
  updateMatches();
  updateDetails(state, ui);
}

function handleConfirmationHotkey(state: AddReposState, ui: AddReposUI): void {
  state.currentLatest = !state.currentLatest;
  state.currentReadOnly = state.currentLatest;
  updateDetails(state, ui);
}

function handleConfirmationArrow(
  state: AddReposState,
  ui: AddReposUI,
  direction: "up" | "down"
): void {
  state.confirmOptionIndex =
    direction === "up"
      ? Math.max(0, state.confirmOptionIndex - 1)
      : Math.min(1, state.confirmOptionIndex + 1);
  updateDetails(state, ui);
}

interface ConfirmationActions {
  addCurrentRepo: () => void;
  exitConfirmMode: () => void;
  toggleCurrentOption: () => void;
}

function handleConfirmationEnter(actions: ConfirmationActions): void {
  actions.addCurrentRepo();
  actions.exitConfirmMode();
}

function handleConfirmationModeKey(
  key: KeyEvent,
  state: AddReposState,
  ui: AddReposUI,
  actions: ConfirmationActions
): void {
  if (key.name === "l") {
    handleConfirmationHotkey(state, ui);
    return;
  }
  if (key.name === "space") {
    actions.toggleCurrentOption();
    return;
  }
  if (isEnter(key)) {
    handleConfirmationEnter(actions);
    return;
  }
  if (isArrowUp(key)) {
    handleConfirmationArrow(state, ui, "up");
    return;
  }
  if (isArrowDown(key)) {
    handleConfirmationArrow(state, ui, "down");
  }
}

function handleInputModeArrowUp(
  state: AddReposState,
  getMatchesForQuery: (query: string) => string[],
  selectMatch: (index: number) => void
): void {
  const matches = getMatchesForQuery(state.lastQuery);
  if (matches.length === 0) {
    return;
  }

  state.selectedMatchIndex =
    state.selectedMatchIndex < 0
      ? matches.length - 1
      : Math.max(0, state.selectedMatchIndex - 1);
  selectMatch(state.selectedMatchIndex);
}

function handleInputModeArrowDown(
  state: AddReposState,
  getMatchesForQuery: (query: string) => string[],
  selectMatch: (index: number) => void
): void {
  const matches = getMatchesForQuery(state.lastQuery);
  if (matches.length === 0) {
    return;
  }

  state.selectedMatchIndex =
    state.selectedMatchIndex < 0
      ? 0
      : Math.min(matches.length - 1, state.selectedMatchIndex + 1);
  selectMatch(state.selectedMatchIndex);
}

interface ContentContainer {
  add: (r: TextRenderable | InputRenderable) => void;
}

function createTextRenderable(
  renderer: CliRenderer,
  content: ContentContainer,
  options: {
    content: string;
    fg: string;
    id: string;
    marginBottom?: number;
    marginTop?: number;
  }
): TextRenderable {
  const renderable = new TextRenderable(renderer, options);
  content.add(renderable);
  return renderable;
}

function createInputElements(renderer: CliRenderer, content: ContentContainer) {
  createTextRenderable(renderer, content, {
    content: "Repository (owner/repo format):",
    fg: "#e2e8f0",
    id: "repo-label",
    marginBottom: 0,
  });

  const repoInput = new InputRenderable(renderer, {
    backgroundColor: "#334155",
    cursorColor: "#38bdf8",
    height: 1,
    id: "repo-input",
    marginTop: 1,
    placeholder: "e.g., microsoft/playwright",
    placeholderColor: "#64748b",
    textColor: "#f8fafc",
    width: 50,
  });
  content.add(repoInput);

  return repoInput;
}

function createMatchesElements(
  renderer: CliRenderer,
  content: ContentContainer
) {
  createTextRenderable(renderer, content, {
    content: "Matches:",
    fg: "#94a3b8",
    id: "matches-label",
    marginTop: 1,
  });

  return createTextRenderable(renderer, content, {
    content: "(no matches)",
    fg: "#64748b",
    id: "matches-list",
    marginTop: 0,
  });
}

function createDetailsElements(
  renderer: CliRenderer,
  content: ContentContainer
) {
  const detailsLabel = createTextRenderable(renderer, content, {
    content: "",
    fg: "#e2e8f0",
    id: "details-label",
    marginTop: 1,
  });

  const detailsLatest = createTextRenderable(renderer, content, {
    content: "",
    fg: "#94a3b8",
    id: "details-latest",
    marginTop: 0,
  });

  const confirmButton = createTextRenderable(renderer, content, {
    content: "",
    fg: "#10b981",
    id: "confirm-button",
    marginTop: 1,
  });

  return { confirmButton, detailsLabel, detailsLatest };
}

function createStatusAndReposElements(
  renderer: CliRenderer,
  content: ContentContainer
) {
  const statusText = createTextRenderable(renderer, content, {
    content: "",
    fg: "#64748b",
    id: "status",
    marginTop: 1,
  });

  createTextRenderable(renderer, content, {
    content: "\nAdded repositories:",
    fg: "#e2e8f0",
    id: "repos-label",
    marginTop: 1,
  });

  const reposList = createTextRenderable(renderer, content, {
    content: "(none)",
    fg: "#64748b",
    id: "repos-list",
    marginTop: 1,
  });

  return { reposList, statusText };
}

function createUIComponents(
  renderer: CliRenderer,
  content: unknown
): AddReposUI {
  const container = content as ContentContainer;
  const repoInput = createInputElements(renderer, container);
  const matchesList = createMatchesElements(renderer, container);
  const { confirmButton, detailsLabel, detailsLatest } = createDetailsElements(
    renderer,
    container
  );
  const { reposList, statusText } = createStatusAndReposElements(
    renderer,
    container
  );

  return {
    confirmButton,
    detailsLabel,
    detailsLatest,
    matchesList,
    repoInput,
    reposList,
    statusText,
  };
}

function sortByLengthThenAlpha(a: string, b: string): number {
  return a.length === b.length ? a.localeCompare(b) : a.length - b.length;
}

export async function showAddReposPrompt(
  renderer: CliRenderer
): Promise<AddReposResult> {
  const history = await listRepoHistory();
  const historySpecs = history.map((item) => item.spec);
  const maxMatches = 6;

  const { promise, resolve } = Promise.withResolvers<AddReposResult>();

  clearLayout(renderer);
  const { content } = createBaseLayout(renderer, "Add repositories");
  const state = createInitialState();
  const ui = createUIComponents(renderer, content);

  ui.repoInput.focus();

  function updateReposList() {
    if (state.repos.length === 0) {
      ui.reposList.content = "(none)";
      ui.reposList.fg = "#64748b";
      return;
    }
    ui.reposList.content = state.repos
      .map((repo, i) => {
        const roMarker = repo.readOnly ? " [Read-only]" : "";
        return `  ${i + 1}. ${repo.spec}${roMarker}`;
      })
      .join("\n");
    ui.reposList.fg = "#94a3b8";
  }

  function getMatchesForQuery(query: string): string[] {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
    const lowerQuery = trimmed.toLowerCase();
    return historySpecs
      .filter((spec) => spec.toLowerCase().startsWith(lowerQuery))
      .toSorted(sortByLengthThenAlpha)
      .slice(0, maxMatches);
  }

  function updateMatches() {
    const matches = getMatchesForQuery(state.lastQuery);
    if (matches.length === 0) {
      ui.matchesList.content = "(no matches)";
      ui.matchesList.fg = "#64748b";
      return;
    }
    ui.matchesList.content = matches
      .map(
        (spec, index) =>
          `${state.selectedMatchIndex === index ? "▶" : " "} ${spec}`
      )
      .join("\n");
    ui.matchesList.fg = "#94a3b8";
  }

  function validateRepo(spec: string): RepoSpec | null {
    try {
      const repo = parseRepoSpec(spec);
      ui.statusText.content = "✓ Valid format";
      ui.statusText.fg = "#10b981";
      return repo;
    } catch (error) {
      ui.statusText.content = `✗ ${error instanceof Error ? error.message : "Invalid format"}`;
      ui.statusText.fg = "#ef4444";
      return null;
    }
  }

  function selectMatch(matchIndex: number) {
    const matches = getMatchesForQuery(state.lastQuery);
    const selectedMatch = matches[matchIndex];
    if (matchIndex < 0 || matchIndex >= matches.length || !selectedMatch) {
      return;
    }
    applySelectedMatch(state, ui, selectedMatch, matchIndex, validateRepo);
    updateMatches();
    updateDetails(state, ui);
  }

  function addCurrentRepo() {
    if (!state.currentValidRepo) {
      return;
    }
    const spec = state.currentInput.trim();
    if (state.repos.some((r) => r.spec === spec)) {
      ui.statusText.content = "⚠️ Repository already added";
      ui.statusText.fg = "#f59e0b";
      return;
    }
    state.repos.push({
      ...state.currentValidRepo,
      latest: state.currentLatest,
      readOnly: state.currentReadOnly,
    });
    resetInputState(state, ui);
    updateReposList();
    updateMatches();
    updateDetails(state, ui);
  }

  function updateFooter() {
    if (state.isConfirming) {
      showFooter(renderer, content, {
        back: true,
        custom: ["l Read-only", "space Toggle", "enter Add"],
        navigate: true,
        select: false,
      });
    } else {
      showFooter(renderer, content, {
        back: true,
        custom: state.repos.length > 0 ? ["enter (empty) Continue"] : [],
        navigate: true,
        select: true,
      });
    }
  }

  function enterConfirmMode() {
    state.isConfirming = true;
    state.confirmOptionIndex = 2;
    ui.repoInput.blur();
    updateDetails(state, ui);
    updateFooter();
  }

  function exitConfirmMode() {
    state.isConfirming = false;
    state.confirmOptionIndex = 0;
    ui.repoInput.focus();
    updateDetails(state, ui);
    updateFooter();
  }

  function toggleCurrentOption() {
    if (state.confirmOptionIndex === 0) {
      state.currentLatest = !state.currentLatest;
      state.currentReadOnly = state.currentLatest;
    } else if (state.confirmOptionIndex === 1) {
      addCurrentRepo();
      exitConfirmMode();
    }
    updateDetails(state, ui);
  }

  ui.repoInput.onPaste = (event) => {
    processPastedText(event.text, state, ui, validateRepo, updateMatches);
    event.preventDefault();
  };

  const cleanup = () => {
    renderer.keyInput.off("keypress", handleKeypress);
    ui.repoInput.blur();
    hideFooter(renderer);
    clearLayout(renderer);
  };

  const handleKeypress = (key: KeyEvent) => {
    if (isEscape(key)) {
      if (state.isConfirming) {
        exitConfirmMode();
        return;
      }
      cleanup();
      resolve({ cancelled: true, repos: state.repos });
      return;
    }

    if (state.isConfirming) {
      handleConfirmationModeKey(key, state, ui, {
        addCurrentRepo,
        exitConfirmMode,
        toggleCurrentOption,
      });
      return;
    }

    if (isEnter(key)) {
      if (state.currentInput.trim() && state.currentValidRepo) {
        enterConfirmMode();
      } else if (!state.currentInput.trim() && state.repos.length > 0) {
        cleanup();
        resolve({ cancelled: false, repos: state.repos });
      }
      return;
    }

    if (isArrowUp(key)) {
      handleInputModeArrowUp(state, getMatchesForQuery, selectMatch);
      return;
    }

    if (isArrowDown(key)) {
      handleInputModeArrowDown(state, getMatchesForQuery, selectMatch);
    }
  };

  ui.repoInput.on("input", (value: string) => {
    state.currentInput = value;
    if (state.isNavigating) {
      return;
    }
    state.selectedMatchIndex = -1;
    state.lastQuery = value;
    if (value.trim()) {
      updateRepoAfterValidation(state, validateRepo(value.trim()));
    } else {
      ui.statusText.content = "";
      state.currentValidRepo = null;
    }
    updateMatches();
    updateDetails(state, ui);
  });

  renderer.keyInput.on("keypress", handleKeypress);
  updateDetails(state, ui);
  updateReposList();
  updateFooter();

  return promise;
}
