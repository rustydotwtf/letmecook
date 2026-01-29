import {
  type CliRenderer,
  TextRenderable,
  type BoxRenderable,
} from "@opentui/core";

import type { RepoSpec } from "../types";

import { createBaseLayout, clearLayout } from "./renderer";

export type ProgressPhase =
  | "naming"
  | "proposal"
  | "cloning"
  | "installing-skills"
  | "refreshing"
  | "done";

export type ProgressRepoStatus =
  | "pending"
  | "cloning"
  | "refreshing"
  | "updated"
  | "up-to-date"
  | "skipped"
  | "done"
  | "error";

export interface ProgressOptions {
  title?: string;
  label?: string;
  initialPhase?: ProgressPhase;
}

export interface ProgressState {
  sessionName?: string;
  repos: {
    repo: RepoSpec;
    status: ProgressRepoStatus;
  }[];
  phase: ProgressPhase;
  currentOutput?: string[]; // Last 5 lines of git output
}

const uiState = {
  outputText: null as TextRenderable | null,
  phaseText: null as TextRenderable | null,
  sessionText: null as TextRenderable | null,
  statusTexts: [] as TextRenderable[],
};

function getRepoStatusIcon(status: ProgressRepoStatus): string {
  const statusIcons: Record<ProgressRepoStatus, string> = {
    cloning: "[~]",
    done: "[x]",
    error: "[!]",
    pending: "[ ]",
    refreshing: "[~]",
    skipped: "[>]",
    "up-to-date": "[=]",
    updated: "[x]",
  };
  return statusIcons[status];
}

function getRepoStatusColor(status: ProgressRepoStatus): string {
  const statusColors: Record<ProgressRepoStatus, string> = {
    cloning: "#fbbf24",
    done: "#22c55e",
    error: "#ef4444",
    pending: "#94a3b8",
    refreshing: "#38bdf8",
    skipped: "#f59e0b",
    "up-to-date": "#94a3b8",
    updated: "#22c55e",
  };
  return statusColors[status];
}

function getPhasePresentation(phase: ProgressPhase): {
  content: string;
  fg: string;
} {
  switch (phase) {
    case "naming": {
      return { content: "Generating session name...", fg: "#fbbf24" };
    }
    case "proposal": {
      return { content: "Here's what the agent proposed:", fg: "#38bdf8" };
    }
    case "cloning": {
      return { content: "Cloning repositories...", fg: "#38bdf8" };
    }
    case "installing-skills": {
      return { content: "Installing skills...", fg: "#38bdf8" };
    }
    case "refreshing": {
      return { content: "Refreshing read-only repositories...", fg: "#38bdf8" };
    }
    case "done": {
      return { content: "Ready!", fg: "#22c55e" };
    }
    default: {
      return { content: "Processing...", fg: "#38bdf8" };
    }
  }
}

function initializePhaseText(
  renderer: CliRenderer,
  content: BoxRenderable,
  phasePresentation: { content: string; fg: string }
): void {
  uiState.phaseText = new TextRenderable(renderer, {
    content: phasePresentation.content,
    fg: phasePresentation.fg,
    id: "phase",
    marginBottom: 1,
  });
  content.add(uiState.phaseText);
}

function initializeSessionText(
  renderer: CliRenderer,
  content: BoxRenderable
): void {
  uiState.sessionText = new TextRenderable(renderer, {
    content: "",
    fg: "#38bdf8",
    id: "session-name",
  });
  content.add(uiState.sessionText);
}

function initializeRepoTexts(
  renderer: CliRenderer,
  content: BoxRenderable,
  repos: RepoSpec[]
): void {
  for (const [i, repo] of repos.entries()) {
    const statusText = new TextRenderable(renderer, {
      content: `  [ ] ${repo.owner}/${repo.name}`,
      fg: "#94a3b8",
      id: `repo-status-${i}`,
    });
    content.add(statusText);
    uiState.statusTexts.push(statusText);
  }
}

function initializeOutputText(
  renderer: CliRenderer,
  content: BoxRenderable
): void {
  uiState.outputText = new TextRenderable(renderer, {
    content: "",
    fg: "#64748b",
    id: "git-output",
    marginTop: 1,
  });
  content.add(uiState.outputText);
}

function createCloningLabel(
  renderer: CliRenderer,
  label: string
): TextRenderable {
  return new TextRenderable(renderer, {
    content: `\n${label}`,
    fg: "#e2e8f0",
    id: "cloning-label",
    marginTop: 1,
  });
}

function createProgressState(
  initialPhase: ProgressPhase,
  repos: RepoSpec[]
): ProgressState {
  return {
    phase: initialPhase,
    repos: repos.map((repo) => ({ repo, status: "pending" as const })),
  };
}

function initializeProgressUI(
  renderer: CliRenderer,
  content: BoxRenderable,
  label: string,
  initialPhase: ProgressPhase,
  repos: RepoSpec[]
): ProgressState {
  const phasePresentation = getPhasePresentation(initialPhase);
  initializePhaseText(renderer, content, phasePresentation);
  initializeSessionText(renderer, content);
  content.add(createCloningLabel(renderer, label));
  const state = createProgressState(initialPhase, repos);
  initializeRepoTexts(renderer, content, repos);
  initializeOutputText(renderer, content);
  return state;
}

export function showProgress(
  renderer: CliRenderer,
  repos: RepoSpec[],
  options: ProgressOptions = {}
): ProgressState {
  clearLayout(renderer);
  uiState.statusTexts = [];

  const {
    title = "Setting up session",
    label = "Cloning repositories:",
    initialPhase = "naming",
  } = options;

  const { content } = createBaseLayout(renderer, title);

  return initializeProgressUI(renderer, content, label, initialPhase, repos);
}

function updatePhaseItem(phase: ProgressPhase): void {
  if (uiState.phaseText) {
    const phasePresentation = getPhasePresentation(phase);
    uiState.phaseText.content = phasePresentation.content;
    uiState.phaseText.fg = phasePresentation.fg;
  }
}

function updateSessionItem(sessionName?: string): void {
  if (uiState.sessionText && sessionName) {
    uiState.sessionText.content = `Session: ${sessionName}`;
  }
}

function updateRepoTexts(repos: ProgressState["repos"]): void {
  for (const [i, item] of repos.entries()) {
    const text = uiState.statusTexts[i];
    if (text) {
      const icon = getRepoStatusIcon(item.status);
      const color = getRepoStatusColor(item.status);
      text.content = `  ${icon} ${item.repo.owner}/${item.repo.name}`;
      text.fg = color;
    }
  }
}

function updateOutputText(currentOutput?: string[]): void {
  if (uiState.outputText && currentOutput && currentOutput.length > 0) {
    uiState.outputText.content = currentOutput
      .map((line) => `  ${line}`)
      .join("\n");
  } else if (uiState.outputText) {
    uiState.outputText.content = "";
  }
}

export function updateProgress(
  renderer: CliRenderer,
  state: ProgressState
): void {
  updatePhaseItem(state.phase);
  updateSessionItem(state.sessionName);
  updateRepoTexts(state.repos);
  updateOutputText(state.currentOutput);
  renderer.requestRender();
}

export function hideProgress(renderer: CliRenderer): void {
  clearLayout(renderer);
  uiState.statusTexts = [];
  uiState.phaseText = null;
  uiState.sessionText = null;
  uiState.outputText = null;
}
