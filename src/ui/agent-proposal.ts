import type { CliRenderer } from "@opentui/core";

import { TextRenderable } from "@opentui/core";

import type { RepoSpec } from "../types";

import { createBaseLayout, clearLayout } from "./renderer";

export interface AgentProposal {
  sessionName: string;
  repos: RepoSpec[];
  goal?: string;
}

export interface AgentProposalResult {
  sessionNameText: TextRenderable;
  content: ReturnType<typeof createBaseLayout>["content"];
}

export function showAgentProposal(
  renderer: CliRenderer,
  proposal: AgentProposal
): AgentProposalResult {
  clearLayout(renderer);

  const { content } = createBaseLayout(renderer, "Agent Proposal");

  // Session name
  const sessionNameText = new TextRenderable(renderer, {
    content: `Session: ${proposal.sessionName}`,
    fg: "#38bdf8",
    id: "session-name",
    marginBottom: 2,
  });
  content.add(sessionNameText);

  // Goal if provided
  if (proposal.goal) {
    const goalLabel = new TextRenderable(renderer, {
      content: "Goal:",
      fg: "#e2e8f0",
      id: "goal-label",
      marginBottom: 0,
    });
    content.add(goalLabel);

    const goalText = new TextRenderable(renderer, {
      content: proposal.goal,
      fg: "#94a3b8",
      id: "goal-text",
      marginBottom: 2,
    });
    content.add(goalText);
  }

  // Repository plan
  const planLabel = new TextRenderable(renderer, {
    content: "Repositories to clone:",
    fg: "#e2e8f0",
    id: "plan-label",
    marginBottom: 1,
  });
  content.add(planLabel);

  proposal.repos.forEach((repo) => {
    const repoText = new TextRenderable(renderer, {
      content: `  📦 ${repo.owner}/${repo.name}`,
      fg: "#10b981",
      id: `repo-${repo.owner}-${repo.name}`,
      marginBottom: 0,
    });
    content.add(repoText);
  });

  // Summary
  const summaryText = new TextRenderable(renderer, {
    content: `\nThis will clone ${proposal.repos.length} repositories.`,
    fg: "#64748b",
    id: "summary",
    marginTop: 2,
  });
  content.add(summaryText);

  // Continue prompt
  const continueText = new TextRenderable(renderer, {
    content: "Continuing...",
    fg: "#64748b",
    id: "continue",
    marginTop: 1,
  });
  content.add(continueText);

  renderer.requestRender();

  return { content, sessionNameText };
}
