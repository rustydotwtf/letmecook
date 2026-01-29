import { type CliRenderer, TextRenderable } from "@opentui/core";

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

let statusTexts: TextRenderable[] = [];
let phaseText: TextRenderable | null = null;
let sessionText: TextRenderable | null = null;
let outputText: TextRenderable | null = null;

function getRepoStatusIcon(status: ProgressRepoStatus): string {
  if (status === "done" || status === "updated") {
    return "[x]";
  }
  if (status === "cloning" || status === "refreshing") {
    return "[~]";
  }
  if (status === "error") {
    return "[!]";
  }
  if (status === "up-to-date") {
    return "[=]";
  }
  if (status === "skipped") {
    return "[>]";
  }
  return "[ ]";
}

function getRepoStatusColor(status: ProgressRepoStatus): string {
  if (status === "done" || status === "updated") {
    return "#22c55e";
  }
  if (status === "cloning") {
    return "#fbbf24";
  }
  if (status === "refreshing") {
    return "#38bdf8";
  }
  if (status === "error") {
    return "#ef4444";
  }
  if (status === "skipped") {
    return "#f59e0b";
  }
  return "#94a3b8";
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

export function showProgress(
  renderer: CliRenderer,
  repos: RepoSpec[],
  options: ProgressOptions = {}
): ProgressState {
  clearLayout(renderer);
  statusTexts = [];

  const {
    title = "Setting up session",
    label = "Cloning repositories:",
    initialPhase = "naming",
  } = options;

  const { content } = createBaseLayout(renderer, title);

  const phasePresentation = getPhasePresentation(initialPhase);

  phaseText = new TextRenderable(renderer, {
    content: phasePresentation.content,
    fg: phasePresentation.fg,
    id: "phase",
    marginBottom: 1,
  });
  content.add(phaseText);

  sessionText = new TextRenderable(renderer, {
    content: "",
    fg: "#38bdf8",
    id: "session-name",
  });
  content.add(sessionText);

  const cloningLabel = new TextRenderable(renderer, {
    content: `\n${label}`,
    fg: "#e2e8f0",
    id: "cloning-label",
    marginTop: 1,
  });
  content.add(cloningLabel);

  const state: ProgressState = {
    phase: initialPhase,
    repos: repos.map((repo) => ({ repo, status: "pending" as const })),
  };

  for (const [i, repo] of repos.entries()) {
    const statusText = new TextRenderable(renderer, {
      content: `  [ ] ${repo.owner}/${repo.name}`,
      fg: "#94a3b8",
      id: `repo-status-${i}`,
    });
    content.add(statusText);
    statusTexts.push(statusText);
  }

  // Output display section (shows last 5 lines of git output)
  outputText = new TextRenderable(renderer, {
    id: "git-output",
    content: "",
    fg: "#64748b", // Muted slate gray
    marginTop: 1,
  });
  content.add(outputText);

  return state;
}

export function updateProgress(
  renderer: CliRenderer,
  state: ProgressState
): void {
  if (phaseText) {
    const phasePresentation = getPhasePresentation(state.phase);
    phaseText.content = phasePresentation.content;
    phaseText.fg = phasePresentation.fg;
  }

  if (sessionText && state.sessionName) {
    sessionText.content = `Session: ${state.sessionName}`;
  }

  for (const [i, item] of state.repos.entries()) {
    const text = statusTexts[i];
    if (text) {
      const icon = getRepoStatusIcon(item.status);
      const color = getRepoStatusColor(item.status);

      text.content = `  ${icon} ${item.repo.owner}/${item.repo.name}`;
      text.fg = color;
    }
  }

  // Update git output display
  if (outputText && state.currentOutput && state.currentOutput.length > 0) {
    outputText.content = state.currentOutput
      .map((line) => `  ${line}`)
      .join("\n");
  } else if (outputText) {
    outputText.content = "";
  }

  renderer.requestRender();
}

export function hideProgress(renderer: CliRenderer): void {
  clearLayout(renderer);
  statusTexts = [];
  phaseText = null;
  sessionText = null;
  outputText = null;
}
