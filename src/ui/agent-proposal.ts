import { type CliRenderer, TextRenderable } from "@opentui/core";

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

function addSessionName(
  renderer: CliRenderer,
  content: ReturnType<typeof createBaseLayout>["content"],
  sessionName: string
) {
  const sessionNameText = new TextRenderable(renderer, {
    content: `Session: ${sessionName}`,
    fg: "#38bdf8",
    id: "session-name",
    marginBottom: 2,
  });
  content.add(sessionNameText);
  return sessionNameText;
}

function addGoalSection(
  renderer: CliRenderer,
  content: ReturnType<typeof createBaseLayout>["content"],
  goal?: string
) {
  if (!goal) {
    return;
  }
  content.add(
    new TextRenderable(renderer, {
      content: "Goal:",
      fg: "#e2e8f0",
      id: "goal-label",
      marginBottom: 0,
    })
  );
  content.add(
    new TextRenderable(renderer, {
      content: goal,
      fg: "#94a3b8",
      id: "goal-text",
      marginBottom: 2,
    })
  );
}

function addRepositories(
  renderer: CliRenderer,
  content: ReturnType<typeof createBaseLayout>["content"],
  repos: RepoSpec[]
) {
  content.add(
    new TextRenderable(renderer, {
      content: "Repositories to clone:",
      fg: "#e2e8f0",
      id: "plan-label",
      marginBottom: 1,
    })
  );
  for (const repo of repos) {
    content.add(
      new TextRenderable(renderer, {
        content: `  📦 ${repo.owner}/${repo.name}`,
        fg: "#10b981",
        id: `repo-${repo.owner}-${repo.name}`,
        marginBottom: 0,
      })
    );
  }
}

export function showAgentProposal(
  renderer: CliRenderer,
  proposal: AgentProposal
): AgentProposalResult {
  clearLayout(renderer);

  const { content } = createBaseLayout(renderer, "Agent Proposal");

  const sessionNameText = addSessionName(
    renderer,
    content,
    proposal.sessionName
  );
  addGoalSection(renderer, content, proposal.goal);
  addRepositories(renderer, content, proposal.repos);

  content.add(
    new TextRenderable(renderer, {
      content: `\nThis will clone ${proposal.repos.length} repositories.`,
      fg: "#64748b",
      id: "summary",
      marginTop: 2,
    })
  );
  content.add(
    new TextRenderable(renderer, {
      content: "Continuing...",
      fg: "#64748b",
      id: "continue",
      marginTop: 1,
    })
  );

  renderer.requestRender();

  return { content, sessionNameText };
}
