import type { CliRenderer } from "@opentui/core";

import type { Session } from "../types";

import { writeAgentsMd } from "../agents-md";
import { recloneRepo, refreshLatestRepos } from "../git";
import { getProcessesForSession } from "../process-registry";
import { deleteSession, updateSessionSettings } from "../sessions";
import { updateSkills } from "../skills";
import { showSessionStartWarning } from "../ui/background-warning";
import { showDeleteConfirm } from "../ui/confirm-delete";
import { handleSmartExit } from "../ui/exit";
import { showProgress, updateProgress, hideProgress } from "../ui/progress";
import { showReclonePrompt } from "../ui/reclone-prompt";
import { createRenderer, destroyRenderer } from "../ui/renderer";
import { showSessionSettings } from "../ui/session-settings";

export interface ResumeSessionParams {
  session: Session;
  mode: "cli" | "tui";
  initialRefresh?: boolean;
}

export type ResumeResult = "resume" | "home";

async function checkBackgroundProcesses(session: Session): Promise<boolean> {
  const runningProcesses = await getProcessesForSession(session.name);
  if (runningProcesses.length === 0) {
    return true;
  }

  const activeRenderer = await createRenderer();
  const choice = await showSessionStartWarning(
    activeRenderer,
    runningProcesses
  );
  destroyRenderer();
  return choice === "continue";
}

function shouldSaveSessionSettings(editResult: { action: string }): boolean {
  return (
    editResult.action === "saved" ||
    editResult.action === "add-repos" ||
    editResult.action === "add-skills"
  );
}

function handleTodoEditAction(editResult: { action: string }): void {
  if (editResult.action === "add-repos") {
    console.log("[TODO] Add repos flow - needs to be implemented");
  }

  if (editResult.action === "add-skills") {
    console.log("[TODO] Add skills flow - needs to be implemented");
  }
}

async function updateSessionFromEdit(
  editResult: { session: Session },
  currentSession: Session
): Promise<Session> {
  const saved = await updateSessionSettings(editResult.session.name, {
    goal: editResult.session.goal,
    repos: editResult.session.repos,
    skills: editResult.session.skills,
  });

  if (!saved) {
    return currentSession;
  }

  await writeAgentsMd(saved);
  return saved;
}

async function handleSessionEdit(
  renderer: CliRenderer,
  session: Session
): Promise<Session> {
  const editResult = await showSessionSettings(renderer, session);

  if (!shouldSaveSessionSettings(editResult)) {
    handleTodoEditAction(editResult);
    return session;
  }

  return updateSessionFromEdit(editResult, session);
}

async function handleDeleteAction(
  renderer: CliRenderer,
  session: Session
): Promise<"home"> {
  const choice = await showDeleteConfirm(renderer, session);
  if (choice === "confirm") {
    await deleteSession(session.name);
  }
  destroyRenderer();
  return "home";
}

async function handleExitAction(
  renderer: CliRenderer,
  session: Session,
  action: "home" | "delete" | "edit"
): Promise<"resumed" | "home" | "edited"> {
  if (action === "home") {
    destroyRenderer();
    return "home";
  }

  if (action === "delete") {
    return await handleDeleteAction(renderer, session);
  }

  if (action === "edit") {
    return "edited";
  }

  return "resumed";
}

async function refreshSessionIfNeeded(
  mode: "cli" | "tui",
  shouldRefresh: boolean,
  session: Session,
  activeRenderer: CliRenderer
): Promise<CliRenderer> {
  if (mode === "tui" && shouldRefresh) {
    const renderer = await createRenderer();
    await refreshLatestBeforeResume(renderer, session);
    destroyRenderer();
    return renderer;
  }

  if (shouldRefresh) {
    await refreshLatestBeforeResumeSimple(session);
  }

  return activeRenderer;
}

async function handlePostOpencodeSessionExit(
  activeRenderer: CliRenderer,
  session: Session
): Promise<"resumed" | "home" | "edited"> {
  let currentSession = session;

  while (true) {
    const exitResult = await handleSmartExit(activeRenderer, currentSession);

    if (exitResult.action === "resume") {
      return "resumed";
    }

    const actionResult = await handleExitAction(
      activeRenderer,
      currentSession,
      exitResult.action
    );

    if (actionResult === "home") {
      return "home";
    }

    if (actionResult === "edited") {
      currentSession = await handleSessionEdit(activeRenderer, currentSession);
    }
  }
}

async function prepareForExitHandling(
  mode: "cli" | "tui",
  activeRenderer: CliRenderer
): Promise<CliRenderer> {
  if (mode !== "tui") {
    return activeRenderer;
  }
  return await createRenderer();
}

async function handleExitResult(
  exitResult: "resumed" | "home" | "edited",
  renderer: CliRenderer,
  session: Session
): Promise<Session | "home"> {
  if (exitResult === "home") {
    destroyRenderer();
    return "home";
  }

  destroyRenderer();

  if (exitResult === "edited") {
    return await handleSessionEdit(renderer, session);
  }

  return session;
}

async function runSessionCycle(
  mode: "cli" | "tui",
  shouldRefresh: boolean,
  session: Session,
  activeRenderer: CliRenderer
): Promise<Session | "home"> {
  let renderer = await refreshSessionIfNeeded(
    mode,
    shouldRefresh,
    session,
    activeRenderer
  );

  await runOpencodeMode(mode, session.path);
  renderer = await prepareForExitHandling(mode, renderer);

  const exitResult = await handlePostOpencodeSessionExit(renderer, session);

  return handleExitResult(exitResult, renderer, session);
}

async function initializeSessionCheck(
  mode: "cli" | "tui",
  session: Session
): Promise<"home" | "continue"> {
  if (mode !== "tui") {
    return "continue";
  }

  const shouldContinue = await checkBackgroundProcesses(session);
  return shouldContinue ? "continue" : "home";
}

async function executeSessionLoop(
  mode: "cli" | "tui",
  initialSession: Session,
  initialRefresh: boolean,
  renderer: CliRenderer
): Promise<ResumeResult> {
  let currentSession = initialSession;
  let shouldRefresh = initialRefresh;

  while (true) {
    const result = await runSessionCycle(
      mode,
      shouldRefresh,
      currentSession,
      renderer
    );
    if (result === "home") {
      return "home";
    }
    currentSession = result;
    shouldRefresh = true;
  }
}

export async function resumeSession(
  _renderer: CliRenderer,
  params: ResumeSessionParams
): Promise<ResumeResult> {
  const { session, mode, initialRefresh = true } = params;

  const initResult = await initializeSessionCheck(mode, session);
  if (initResult === "home") {
    return "home";
  }

  return executeSessionLoop(mode, session, initialRefresh, _renderer);
}

function createRefreshCallback(
  renderer: CliRenderer,
  refreshProgressState: ReturnType<typeof showProgress>
) {
  return (
    repoIndex: number,
    status: string,
    outputLines: string[] | undefined
  ) => {
    const repoState = refreshProgressState.repos[repoIndex];
    if (repoState && outputLines) {
      repoState.status =
        status as (typeof refreshProgressState.repos)[0]["status"];
      refreshProgressState.currentOutput = outputLines;
    } else if (repoState) {
      repoState.status =
        status as (typeof refreshProgressState.repos)[0]["status"];
    }
    updateProgress(renderer, refreshProgressState);
  };
}

function createRecloneCallback(
  renderer: CliRenderer,
  recloneProgressState: ReturnType<typeof showProgress>
) {
  return (status: string, outputLines: string[] | undefined): void => {
    const [repoState] = recloneProgressState.repos;
    if (repoState && outputLines) {
      repoState.status =
        status as (typeof recloneProgressState.repos)[0]["status"];
      recloneProgressState.currentOutput = outputLines;
    } else if (repoState) {
      repoState.status =
        status as (typeof recloneProgressState.repos)[0]["status"];
    }
    updateProgress(renderer, recloneProgressState);
  };
}

function handleRecloneError(
  error: unknown,
  renderer: CliRenderer,
  recloneProgressState: ReturnType<typeof showProgress>
): void {
  const [repoState] = recloneProgressState.repos;
  if (repoState) {
    repoState.status = "error";
  }
  recloneProgressState.currentOutput = [
    error instanceof Error ? error.message : String(error),
  ];
  updateProgress(renderer, recloneProgressState);
}

async function performReclone(
  renderer: CliRenderer,
  result: { repo: Parameters<typeof showProgress>[1][0] },
  session: Session
): Promise<void> {
  const recloneProgressState = showProgress(renderer, [result.repo], {
    initialPhase: "cloning",
    label: "Recloning:",
    title: "Recloning repository",
  });
  recloneProgressState.sessionName = session.name;
  updateProgress(renderer, recloneProgressState);

  try {
    await recloneRepo(
      result.repo,
      session.path,
      createRecloneCallback(renderer, recloneProgressState)
    );
  } catch (error) {
    handleRecloneError(error, renderer, recloneProgressState);
  }

  recloneProgressState.phase = "done";
  updateProgress(renderer, recloneProgressState);
  await Bun.sleep(700);
  hideProgress(renderer);
}

function setupRefreshProgress(
  renderer: CliRenderer,
  repos: {
    owner: string;
    name: string;
    dir: string;
    spec: string;
    readOnly?: boolean;
  }[],
  session: Session
): ReturnType<typeof showProgress> {
  const refreshProgressState = showProgress(renderer, repos, {
    initialPhase: "refreshing",
    label: "Refreshing read-only repositories:",
    title: "Refreshing repositories",
  });
  refreshProgressState.sessionName = session.name;
  updateProgress(renderer, refreshProgressState);
  return refreshProgressState;
}

async function handleRecloneTargets(
  renderer: CliRenderer,
  results: { status: string; repo: Parameters<typeof showProgress>[1][0] }[],
  session: Session
): Promise<void> {
  const recloneTargets = results.filter(
    (result) => result.status === "error" && result.repo
  );

  for (const result of recloneTargets) {
    const choice = await showReclonePrompt(renderer, result.repo);

    if (choice === "reclone") {
      await performReclone(renderer, result, session);
    }
  }
}

async function refreshLatestBeforeResume(
  renderer: CliRenderer,
  session: Session
): Promise<void> {
  const readOnlyRepos = session.repos.filter((repo) => repo.readOnly);
  if (readOnlyRepos.length === 0) {
    return;
  }

  const refreshProgressState = setupRefreshProgress(
    renderer,
    readOnlyRepos,
    session
  );

  const refreshResults = await refreshLatestRepos(
    readOnlyRepos,
    session.path,
    createRefreshCallback(renderer, refreshProgressState)
  );

  refreshProgressState.phase = "done";
  updateProgress(renderer, refreshProgressState);

  await Bun.sleep(700);
  hideProgress(renderer);

  await handleRecloneTargets(renderer, refreshResults, session);
}

function getRefreshStatusIcon(status: string): string {
  if (status === "updated") {
    return "✓";
  }
  if (status === "up-to-date") {
    return "•";
  }
  if (status === "skipped") {
    return "↷";
  }
  return "✗";
}

function displayRefreshResults(
  results: {
    status: string;
    reason?: string;
    repo: { owner: string; name: string };
  }[]
): void {
  for (const result of results) {
    const icon = getRefreshStatusIcon(result.status);
    const reason = result.reason ? ` (${result.reason})` : "";
    console.log(`  ${icon} ${result.repo.owner}/${result.repo.name}${reason}`);
  }
}

async function refreshLatestBeforeResumeSimple(
  session: Session
): Promise<void> {
  const readOnlyRepos = session.repos.filter((repo) => repo.readOnly);
  if (readOnlyRepos.length === 0) {
    return;
  }

  console.log("\nRefreshing read-only repositories...");

  const results = await refreshLatestRepos(readOnlyRepos, session.path);

  if (results.length === 0) {
    return;
  }

  displayRefreshResults(results);
  await updateSkillsSimple(session);
}

async function updateSkillsSimple(session: Session): Promise<void> {
  if (!session.skills || session.skills.length === 0) {
    return;
  }

  console.log("\nUpdating skills...");
  const { success } = await updateSkills(session, (output) => {
    console.log(`  ${output}`);
  });

  if (!success) {
    console.log("  ⚠️ Skills update failed (continuing anyway)");
  }
}

async function runOpencodeMode(
  mode: "cli" | "tui",
  sessionPath: string
): Promise<void> {
  const proc = Bun.spawn(["claude", "--dangerously-skip-permissions"], {
    cwd: sessionPath,
    env: { ...process.env, IS_DEMO: mode === "tui" ? "1" : undefined },
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  await proc.exited;
}
