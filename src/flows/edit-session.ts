import { rm } from "node:fs/promises";
import { join } from "node:path";

import type { Session, RepoSpec } from "../types";

import { writeAgentsMd } from "../agents-md";
import { recordRepoHistory } from "../repo-history";
import {
  updateSessionRepos,
  updateSessionSkills,
  deleteSession,
} from "../sessions";
import { removeSkillFromSession } from "../skills";
import {
  runCommands,
  hideCommandRunner,
  type CommandTask,
} from "../ui/common/command-runner";
import { createRenderer, destroyRenderer } from "../ui/renderer";

export interface EditSessionParams {
  session: Session;
  updates: {
    repos?: RepoSpec[];
    goal?: string;
    skills?: string[];
  };
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

function runCommandBatch(
  renderer: Awaited<ReturnType<typeof createRenderer>>,
  tasks: CommandTask[],
  title: string
) {
  return runCommands(renderer, {
    allowAbort: true,
    allowBackground: true,
    allowSkip: tasks.length > 1,
    outputLines: 5,
    showOutput: true,
    tasks,
    title,
  });
}

function wasAborted(results: { outcome: string }[]): boolean {
  return results.some((r) => r.outcome === "aborted");
}

async function removeRepoDir(session: Session, repo: RepoSpec): Promise<void> {
  const repoPath = join(session.path, repo.dir);
  try {
    await rm(repoPath, { force: true, recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

async function cleanupAbortedRepos(
  session: Session,
  repos: RepoSpec[]
): Promise<void> {
  for (const repo of repos) {
    await removeRepoDir(session, repo);
  }
}

async function cleanupSkippedRepos(
  session: Session,
  skipped: { task: { label: string } },
  repos: RepoSpec[]
): Promise<void> {
  const repoSpec = skipped.task.label.replace("Cloning ", "");
  const repo = repos.find((r) => `${r.owner}/${r.name}` === repoSpec);
  if (repo) {
    await removeRepoDir(session, repo);
  }
}

function getSuccessfulRepos(
  repos: RepoSpec[],
  results: { task: { label: string }; outcome: string }[]
): RepoSpec[] {
  return repos.filter((repo) => {
    const result = results.find(
      (r) => r.task.label === `Cloning ${repo.owner}/${repo.name}`
    );
    return result?.outcome === "completed";
  });
}

function getSuccessfulSkills(
  skills: string[],
  results: { task: { label: string }; outcome: string }[]
): string[] {
  return skills.filter((skill) => {
    const result = results.find((r) => r.task.label === `Installing ${skill}`);
    return result?.outcome === "completed";
  });
}

function logErrors(
  results: { outcome: string; task: { label: string }; error?: string }[],
  type: string
): void {
  const errors = results.filter((r) => r.outcome === "error");
  if (errors.length === 0) {
    return;
  }

  console.error(`\n⚠️  ${errors.length} ${type} failed:`);
  for (const err of errors) {
    console.error(`  ✗ ${err.task.label}`);
    if (err.error) {
      console.error(`    ${err.error}`);
    }
  }
}

async function sleepAndHide(
  renderer: Awaited<ReturnType<typeof createRenderer>>
): Promise<void> {
  await Bun.sleep(700);
  hideCommandRunner(renderer);
}

async function saveReposAndUpdateSession(
  session: Session,
  successfulRepos: RepoSpec[]
): Promise<Session> {
  if (successfulRepos.length > 0) {
    await recordRepoHistory(successfulRepos);
    await writeAgentsMd(session);
  }

  const allRepos = [...session.repos, ...successfulRepos];
  const updated = await updateSessionRepos(session.name, allRepos);
  return updated || session;
}

async function saveSkillsAndUpdateSession(
  session: Session,
  successfulSkills: string[]
): Promise<Session> {
  if (successfulSkills.length === 0) {
    return session;
  }

  const allSkills = [...(session.skills || []), ...successfulSkills];
  const updated = await updateSessionSkills(session.name, allSkills);

  if (updated) {
    await writeAgentsMd(updated);
    return updated;
  }

  return session;
}

interface RepoUpdateResult {
  aborted: boolean;
  session: Session;
}

async function cleanupSkipped(
  session: Session,
  results: { outcome: string; task: { label: string } }[],
  repos: RepoSpec[]
): Promise<void> {
  const skipped = results.filter((r) => r.outcome === "skipped");
  for (const s of skipped) {
    await cleanupSkippedRepos(session, s, repos);
  }
}

async function processRepoResults(
  session: Session,
  repos: RepoSpec[],
  results: { outcome: string; task: { label: string } }[],
  renderer: Awaited<ReturnType<typeof createRenderer>>
): Promise<Session> {
  await cleanupSkipped(session, results, repos);
  const successful = getSuccessfulRepos(repos, results);
  logErrors(results, "repository(ies)");
  await sleepAndHide(renderer);
  return saveReposAndUpdateSession(session, successful);
}

async function handleRepoUpdates(
  session: Session,
  newRepos: RepoSpec[],
  renderer: Awaited<ReturnType<typeof createRenderer>>
): Promise<RepoUpdateResult> {
  const tasks = reposToCommandTasks(newRepos, session.path);
  const results = await runCommandBatch(renderer, tasks, "Adding repositories");

  if (wasAborted(results)) {
    hideCommandRunner(renderer);
    await cleanupAbortedRepos(session, newRepos);
    destroyRenderer();
    return { aborted: true, session };
  }

  const updatedSession = await processRepoResults(
    session,
    newRepos,
    results,
    renderer
  );
  return { aborted: false, session: updatedSession };
}

async function handleSkillUpdates(
  session: Session,
  newSkills: string[],
  renderer: Awaited<ReturnType<typeof createRenderer>>
): Promise<Session> {
  const tasks = skillsToCommandTasks(newSkills, session.path);
  const results = await runCommandBatch(renderer, tasks, "Adding skills");

  if (wasAborted(results)) {
    hideCommandRunner(renderer);
    destroyRenderer();
    return session;
  }

  const successful = getSuccessfulSkills(newSkills, results);
  logErrors(results, "skill(s)");
  await sleepAndHide(renderer);

  return saveSkillsAndUpdateSession(session, successful);
}

function getNewRepos(session: Session, updates: RepoSpec[]): RepoSpec[] {
  const existingSpecs = new Set(session.repos.map((r) => r.spec));
  return updates.filter((r) => !existingSpecs.has(r.spec));
}

function getNewSkills(session: Session, updates: string[]): string[] {
  const existingSkills = new Set(session.skills || []);
  return updates.filter((s) => !existingSkills.has(s));
}

async function updateGoal(
  session: Session,
  goal: string | undefined
): Promise<Session> {
  const updatedSession = { ...session, goal: goal || undefined };
  await writeAgentsMd(updatedSession);
  return updatedSession as Session;
}

async function processRepoUpdate(
  session: Session,
  repos: RepoSpec[],
  renderer: Awaited<ReturnType<typeof createRenderer>>
): Promise<Session | null> {
  const newRepos = getNewRepos(session, repos);
  if (newRepos.length === 0) {
    const updated = await updateSessionRepos(session.name, repos);
    return updated || session;
  }

  const result = await handleRepoUpdates(session, newRepos, renderer);
  if (result.aborted) {
    return null;
  }
  return result.session;
}

function processSkillUpdate(
  session: Session,
  skills: string[],
  renderer: Awaited<ReturnType<typeof createRenderer>>
): Promise<Session> {
  const newSkills = getNewSkills(session, skills);
  if (newSkills.length === 0) {
    return Promise.resolve(session);
  }
  return handleSkillUpdates(session, newSkills, renderer);
}

async function processUpdates(
  session: Session,
  updates: EditSessionParams["updates"],
  renderer: Awaited<ReturnType<typeof createRenderer>>
): Promise<Session | null> {
  let currentSession = session;

  if (updates.repos) {
    const result = await processRepoUpdate(session, updates.repos, renderer);
    if (result === null) {
      return null;
    }
    currentSession = result;
  }

  if (updates.skills) {
    currentSession = await processSkillUpdate(
      currentSession,
      updates.skills,
      renderer
    );
  }

  return currentSession;
}

async function executeWithRenderer<T>(
  fn: (renderer: Awaited<ReturnType<typeof createRenderer>>) => Promise<T>
): Promise<T> {
  const renderer = await createRenderer();
  try {
    return await fn(renderer);
  } finally {
    destroyRenderer();
  }
}

export async function editSession(
  params: EditSessionParams
): Promise<Session | null> {
  const { session, updates } = params;

  if (!updates.repos && !updates.goal && !updates.skills) {
    return session;
  }

  const currentSession = await executeWithRenderer((renderer) =>
    processUpdates(session, updates, renderer)
  );

  if (currentSession === null) {
    return session;
  }

  if (updates.goal !== undefined) {
    return updateGoal(currentSession, updates.goal);
  }

  return currentSession;
}

export async function nukeSession(session: Session): Promise<boolean> {
  const success = await deleteSession(session.name);
  return success;
}

export async function removeSkill(
  session: Session,
  skillString: string
): Promise<Session> {
  const updatedSession = await removeSkillFromSession(session, skillString);
  return updatedSession || session;
}
