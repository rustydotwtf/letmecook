import type { CliRenderer } from "@opentui/core";

import { rm } from "node:fs/promises";
import { join } from "node:path";

import type { Session, RepoSpec } from "../types";

import { writeAgentsMd, createClaudeMdSymlink } from "../agents-md";
import { generateSessionName } from "../naming";
import { recordRepoHistory } from "../repo-history";
import { findMatchingSession, createSession, deleteSession } from "../sessions";
import { showAgentProposal } from "../ui/agent-proposal";
import {
  runCommands,
  hideCommandRunner,
  type CommandTask,
} from "../ui/common/command-runner";
import { showConflictPrompt } from "../ui/conflict";

export interface NewSessionParams {
  repos: RepoSpec[];
  goal?: string;
  skills?: string[];
  mode: "cli" | "tui";
  skipConflictCheck?: boolean;
}

export interface NewSessionResult {
  session: Session;
  skipped?: boolean;
}

type ConflictResolution =
  | { action: "resume"; session: Session }
  | { action: "nuke" | "new" | "cancel" };

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

function skillsToCommandTasks(
  skills: string[],
  sessionPath: string
): CommandTask[] {
  return skills.map((skill) => ({
    command: ["bunx", "skills", "add", skill, "-y"],
    cwd: sessionPath,
    label: `Installing ${skill}`,
  }));
}

function getConflictResolution(
  choice: string,
  existingSession: Session
): ConflictResolution {
  switch (choice) {
    case "resume": {
      return { action: "resume", session: existingSession };
    }

    case "nuke": {
      return { action: "nuke" };
    }

    case "new": {
      return { action: "new" };
    }

    case "cancel": {
      return { action: "cancel" };
    }

    default: {
      return { action: "new" };
    }
  }
}

async function handleConflictCheck(
  renderer: CliRenderer,
  repos: RepoSpec[]
): Promise<ConflictResolution | null> {
  const existingSession = await findMatchingSession(repos);
  if (!existingSession) {
    return { action: "new" };
  }

  const choice = await showConflictPrompt(renderer, existingSession);
  return getConflictResolution(choice, existingSession);
}

async function generateSessionNameWithFeedback(
  renderer: CliRenderer,
  repos: RepoSpec[],
  goal: string | undefined,
  mode: "cli" | "tui"
): Promise<string> {
  if (mode === "tui") {
    const proposal = showAgentProposal(renderer, {
      goal,
      repos,
      sessionName: "generating...",
    });
    const sessionName = await generateSessionName(repos, goal);
    proposal.sessionNameText.content = `Session: ${sessionName}`;
    renderer.requestRender();
    return sessionName;
  }

  return generateSessionName(repos, goal);
}

function buildCommandTasks(
  repos: RepoSpec[],
  skills: string[] | undefined,
  sessionPath: string
): CommandTask[] {
  return [
    ...reposToCommandTasks(repos, sessionPath),
    ...(skills && skills.length > 0
      ? skillsToCommandTasks(skills, sessionPath)
      : []),
  ];
}

async function cleanupSkippedRepos(
  results: { outcome: string; task: CommandTask }[],
  sessionPath: string
): Promise<void> {
  const skippedResults = results.filter((r) => r.outcome === "skipped");
  for (const skipped of skippedResults) {
    const [, repoName] = skipped.task.label.replace("Cloning ", "").split("/");
    if (repoName) {
      const repoPath = join(sessionPath, repoName);
      try {
        await rm(repoPath, { force: true, recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

function getSuccessfulRepoSpecs(
  results: { outcome: string; task: CommandTask }[],
  repos: RepoSpec[]
): RepoSpec[] {
  const successfulRepoResults = results.filter(
    (r) => r.outcome === "completed" && r.task.label.startsWith("Cloning ")
  );
  return successfulRepoResults
    .map((r) => {
      const repoSpec = r.task.label.replace("Cloning ", "");
      return repos.find((repo) => `${repo.owner}/${repo.name}` === repoSpec);
    })
    .filter((r): r is RepoSpec => r !== undefined);
}

function reportCommandErrors(
  results: { outcome: string; task: CommandTask; error?: string }[]
): void {
  const errors = results.filter((r) => r.outcome === "error");
  if (errors.length > 0) {
    console.error(`\n⚠️  ${errors.length} task(s) failed:`);
    for (const err of errors) {
      console.error(`  ✗ ${err.task.label}`);
      if (err.error) {
        console.error(`    ${err.error}`);
      }
    }
  }
}

async function completeSessionSetup(
  session: Session,
  successfulRepoSpecs: RepoSpec[]
): Promise<void> {
  if (successfulRepoSpecs.length > 0) {
    await recordRepoHistory(successfulRepoSpecs);
  }

  await writeAgentsMd(session);
  await createClaudeMdSymlink(session.path);
}

function handleAbortedTasks(results: { outcome: string }[]): boolean {
  return results.some((r) => r.outcome === "aborted");
}

async function processSessionResults(
  renderer: CliRenderer,
  session: Session,
  results: { outcome: string; task: CommandTask; error?: string }[],
  repos: RepoSpec[]
): Promise<void> {
  await cleanupSkippedRepos(results, session.path);
  const successfulRepoSpecs = getSuccessfulRepoSpecs(results, repos);
  reportCommandErrors(results);
  await completeSessionSetup(session, successfulRepoSpecs);
}

async function finalizeSessionUi(renderer: CliRenderer): Promise<void> {
  await Bun.sleep(700);
  hideCommandRunner(renderer);
}

async function setupSessionTui(
  renderer: CliRenderer,
  sessionName: string,
  repos: RepoSpec[],
  goal: string | undefined,
  skills: string[] | undefined
): Promise<Session | null> {
  const session = await createSession(
    sessionName,
    repos,
    goal,
    skills?.length ? skills : undefined
  );

  const tasks = buildCommandTasks(repos, skills, session.path);

  const results = await runCommands(renderer, {
    allowAbort: true,
    allowBackground: true,
    allowSkip: tasks.length > 1,
    outputLines: 5,
    sessionName,
    showOutput: true,
    tasks,
    title: "Setting up session",
  });

  if (handleAbortedTasks(results)) {
    hideCommandRunner(renderer);
    await deleteSession(session.name);
    return null;
  }

  await processSessionResults(renderer, session, results, repos);
  await finalizeSessionUi(renderer);

  return session;
}

function printCliResults(
  results: { success: boolean; task: CommandTask; error?: string }[]
): void {
  for (const result of results) {
    if (result.success) {
      console.log(`  ✓ ${result.task.label}`);
    } else {
      console.log(`  ✗ ${result.task.label}`);
      if (result.error) {
        console.log(`    ${result.error}`);
      }
    }
  }
}

async function setupSessionCli(
  renderer: CliRenderer,
  sessionName: string,
  repos: RepoSpec[],
  goal: string | undefined,
  skills: string[] | undefined
): Promise<Session> {
  const session = await createSession(
    sessionName,
    repos,
    goal,
    skills?.length ? skills : undefined
  );

  console.log(`\nCloning ${repos.length} repository(ies)...`);

  const tasks = buildCommandTasks(repos, skills, session.path);

  const results = await runCommands(renderer, {
    showOutput: false,
    tasks,
    title: "Setting up session",
  });

  printCliResults(results);

  await completeSessionSetup(session, repos);

  hideCommandRunner(renderer);

  return session;
}

async function executeSessionSetup(
  renderer: CliRenderer,
  params: NewSessionParams,
  sessionName: string
): Promise<NewSessionResult | null> {
  const { repos, goal, skills, mode } = params;

  if (mode === "tui") {
    await Bun.sleep(3000);

    const session = await setupSessionTui(
      renderer,
      sessionName,
      repos,
      goal,
      skills
    );
    if (!session) {
      return null;
    }

    return { session };
  }

  const session = await setupSessionCli(
    renderer,
    sessionName,
    repos,
    goal,
    skills
  );
  return { session };
}

function handleConflictResolution(
  resolution: ConflictResolution | null
): NewSessionResult | null {
  if (!resolution) {
    return null;
  }
  if (resolution.action === "cancel") {
    return null;
  }
  if (resolution.action === "resume") {
    return { session: resolution.session, skipped: true };
  }
  return null;
}

export async function createNewSession(
  renderer: CliRenderer,
  params: NewSessionParams
): Promise<NewSessionResult | null> {
  const { repos, mode, skipConflictCheck = false } = params;

  if (!skipConflictCheck) {
    const resolution = await handleConflictCheck(renderer, repos);
    const conflictResult = handleConflictResolution(resolution);
    if (conflictResult !== null) {
      return conflictResult;
    }
  }

  const sessionName = await generateSessionNameWithFeedback(
    renderer,
    repos,
    params.goal,
    mode
  );

  return executeSessionSetup(renderer, params, sessionName);
}
