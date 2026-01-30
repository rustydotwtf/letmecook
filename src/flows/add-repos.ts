import type { CliRenderer } from "@opentui/core";

import { rm } from "node:fs/promises";
import { join } from "node:path";

import type { Session, RepoSpec } from "../types";

import { writeAgentsMd } from "../agents-md";
import { recordRepoHistory } from "../repo-history";
import { updateSessionRepos } from "../sessions";
import { showAddReposPrompt } from "../ui/add-repos";
import {
  runCommands,
  hideCommandRunner,
  type CommandTask,
  type CommandResult,
} from "../ui/common/command-runner";

export interface AddReposParams {
  renderer: CliRenderer;
  session: Session;
}

export interface AddReposResult {
  session: Session;
  cancelled: boolean;
}

function reposToCommandTasks(
  repos: RepoSpec[],
  sessionPath: string
): CommandTask[] {
  return repos.map((repo) => {
    const url = `https://github.com/${repo.owner}/${repo.name}.git`;
    const targetDir = join(sessionPath, repo.dir);
    const args = repo.branch
      ? [
          "git",
          "clone",
          "--depth",
          "1",
          "--single-branch",
          "--branch",
          repo.branch,
          "--progress",
          url,
          targetDir,
        ]
      : [
          "git",
          "clone",
          "--depth",
          "1",
          "--single-branch",
          "--progress",
          url,
          targetDir,
        ];

    return {
      command: args,
      cwd: sessionPath,
      label: `Cloning ${repo.owner}/${repo.name}`,
    };
  });
}

async function cleanupRepos(
  repos: RepoSpec[],
  sessionPath: string
): Promise<void> {
  for (const repo of repos) {
    const repoPath = join(sessionPath, repo.dir);
    try {
      await rm(repoPath, { force: true, recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function handleAborted(
  renderer: CliRenderer,
  newRepos: RepoSpec[],
  session: Session
): Promise<AddReposResult> {
  hideCommandRunner(renderer);
  await cleanupRepos(newRepos, session.path);
  return { cancelled: true, session };
}

async function processCompletedRepos(
  renderer: CliRenderer,
  session: Session,
  newRepos: RepoSpec[],
  results: CommandResult[]
): Promise<AddReposResult> {
  await cleanSkippedRepos(results, newRepos, session.path);
  const successfulRepos = filterSuccessfulRepos(newRepos, results);
  logErrors(results);
  await Bun.sleep(700);
  hideCommandRunner(renderer);

  if (successfulRepos.length > 0) {
    const nextSession = await updateSessionWithRepos(session, successfulRepos);
    return { cancelled: false, session: nextSession };
  }

  return { cancelled: false, session };
}

async function processNewRepos(
  renderer: CliRenderer,
  session: Session,
  newRepos: RepoSpec[]
): Promise<AddReposResult> {
  const tasks = reposToCommandTasks(newRepos, session.path);
  const results = await runCommands(renderer, {
    allowAbort: true,
    allowBackground: true,
    allowSkip: tasks.length > 1,
    outputLines: 5,
    sessionName: session.name,
    showOutput: true,
    tasks,
    title: "Adding repositories",
  });

  const wasAborted = results.some((r) => r.outcome === "aborted");
  if (wasAborted) {
    return handleAborted(renderer, newRepos, session);
  }

  return processCompletedRepos(renderer, session, newRepos, results);
}

async function cleanSkippedRepos(
  results: CommandResult[],
  newRepos: RepoSpec[],
  sessionPath: string
): Promise<void> {
  const skippedResults = results.filter((r) => r.outcome === "skipped");
  for (const skipped of skippedResults) {
    const repoSpec = skipped.task.label.replace("Cloning ", "");
    const repo = newRepos.find((r) => `${r.owner}/${r.name}` === repoSpec);
    if (repo) {
      const repoPath = join(sessionPath, repo.dir);
      try {
        await rm(repoPath, { force: true, recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

function filterSuccessfulRepos(
  newRepos: RepoSpec[],
  results: CommandResult[]
): RepoSpec[] {
  return newRepos.filter((repo) => {
    const result = results.find(
      (r) => r.task.label === `Cloning ${repo.owner}/${repo.name}`
    );
    return result?.outcome === "completed";
  });
}

function logErrors(results: CommandResult[]): void {
  const errors = results.filter((r) => r.outcome === "error");
  if (errors.length > 0) {
    console.error(`\n⚠️  ${errors.length} repository(ies) failed to clone:`);
    for (const err of errors) {
      console.error(`  ✗ ${err.task.label}`);
      if (err.error) {
        console.error(`    ${err.error}`);
      }
    }
  }
}

async function updateSessionWithRepos(
  session: Session,
  successfulRepos: RepoSpec[]
): Promise<Session> {
  const allRepos = [...session.repos, ...successfulRepos];
  const updatedSession = await updateSessionRepos(session.name, allRepos);
  const nextSession = updatedSession ?? session;
  await recordRepoHistory(successfulRepos);
  await writeAgentsMd(nextSession);
  return nextSession;
}

export async function addReposFlow(
  params: AddReposParams
): Promise<AddReposResult> {
  const { renderer, session } = params;

  const addResult = await showAddReposPrompt(renderer);

  if (!addResult.cancelled && addResult.repos.length > 0) {
    const existingSpecs = new Set(session.repos.map((r) => r.spec));
    const newRepos = addResult.repos.filter((r) => !existingSpecs.has(r.spec));

    if (newRepos.length > 0) {
      return processNewRepos(renderer, session, newRepos);
    }
  }

  return { cancelled: addResult.cancelled, session };
}
