import type { CliRenderer } from "@opentui/core";

import type { Session } from "../types";

import { writeAgentsMd } from "../agents-md";
import { refreshLatestRepos } from "../git";
import { recloneRepo } from "../git";
import { getProcessesForSession } from "../process-registry";
import { updateSessionSettings } from "../sessions";
import { deleteSession } from "../sessions";
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

export async function resumeSession(
  renderer: CliRenderer,
  params: ResumeSessionParams
): Promise<ResumeResult> {
  const { session, mode, initialRefresh = true } = params;

  let currentSession = session;
  let shouldRefresh = initialRefresh;

  // Check for background processes running for this session
  if (mode === "tui") {
    const runningProcesses = await getProcessesForSession(session.name);
    if (runningProcesses.length > 0) {
      renderer = await createRenderer();
      const choice = await showSessionStartWarning(renderer, runningProcesses);
      destroyRenderer();
      if (choice === "cancel") {
        return "home";
      }
      // "continue" proceeds with warning acknowledged
    }
  }

  while (true) {
    if (mode === "tui" && shouldRefresh) {
      renderer = await createRenderer();
      await refreshLatestBeforeResume(renderer, currentSession);
      destroyRenderer();
    } else if (shouldRefresh) {
      await refreshLatestBeforeResumeSimple(currentSession);
    }

    await runOpencodeMode(mode, currentSession.path);
    shouldRefresh = true;

    if (mode === "tui") {
      renderer = await createRenderer();
    }

    while (true) {
      const exitResult = await handleSmartExit(renderer, currentSession);

      if (exitResult.action === "resume") {
        break;
      }

      if (exitResult.action === "home") {
        destroyRenderer();
        return "home";
      }

      if (exitResult.action === "delete") {
        const choice = await showDeleteConfirm(renderer, currentSession);
        if (choice === "confirm") {
          await deleteSession(currentSession.name);
        }
        destroyRenderer();
        return "home";
      }

      if (exitResult.action === "edit") {
        const editResult = await showSessionSettings(renderer, currentSession);

        if (
          editResult.action === "saved" ||
          editResult.action === "add-repos" ||
          editResult.action === "add-skills"
        ) {
          const saved = await updateSessionSettings(editResult.session.name, {
            goal: editResult.session.goal,
            repos: editResult.session.repos,
            skills: editResult.session.skills,
          });

          if (saved) {
            currentSession = saved;
            await writeAgentsMd(currentSession);
          }
        }

        if (editResult.action === "add-repos") {
          console.log("[TODO] Add repos flow - needs to be implemented");
        }

        if (editResult.action === "add-skills") {
          console.log("[TODO] Add skills flow - needs to be implemented");
        }
      }
    }

    destroyRenderer();
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

  const refreshProgressState = showProgress(renderer, readOnlyRepos, {
    initialPhase: "refreshing",
    label: "Refreshing read-only repositories:",
    title: "Refreshing repositories",
  });
  refreshProgressState.sessionName = session.name;
  updateProgress(renderer, refreshProgressState);

  const refreshResults = await refreshLatestRepos(
    readOnlyRepos,
    session.path,
    (repoIndex, status, outputLines) => {
      const repoState = refreshProgressState.repos[repoIndex];
      if (repoState) {
        repoState.status = status;
        if (outputLines) {
          refreshProgressState.currentOutput = outputLines;
        }
        updateProgress(renderer, refreshProgressState);
      }
    }
  );

  refreshProgressState.phase = "done";
  updateProgress(renderer, refreshProgressState);

  await new Promise((resolve) => setTimeout(resolve, 700));
  hideProgress(renderer);

  const recloneTargets = refreshResults.filter(
    (result) => result.status === "error" && result.repo.readOnly
  );

  for (const result of recloneTargets) {
    const choice = await showReclonePrompt(renderer, result.repo);

    if (choice === "reclone") {
      const recloneProgressState = showProgress(renderer, [result.repo], {
        initialPhase: "cloning",
        label: "Recloning:",
        title: "Recloning repository",
      });
      recloneProgressState.sessionName = session.name;
      updateProgress(renderer, recloneProgressState);

      try {
        await recloneRepo(result.repo, session.path, (status, outputLines) => {
          const repoState = recloneProgressState.repos[0];
          if (repoState) {
            repoState.status = status;
            if (outputLines) {
              recloneProgressState.currentOutput = outputLines;
            }
            updateProgress(renderer, recloneProgressState);
          }
        });
      } catch (error) {
        const repoState = recloneProgressState.repos[0];
        if (repoState) {
          repoState.status = "error";
        }
        recloneProgressState.currentOutput = [
          error instanceof Error ? error.message : String(error),
        ];
        updateProgress(renderer, recloneProgressState);
      }

      recloneProgressState.phase = "done";
      updateProgress(renderer, recloneProgressState);
      await new Promise((resolve) => setTimeout(resolve, 700));
      hideProgress(renderer);
    }
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

  results.forEach((result) => {
    const icon =
      result.status === "updated"
        ? "✓"
        : result.status === "up-to-date"
          ? "•"
          : result.status === "skipped"
            ? "↷"
            : "✗";
    const reason = result.reason ? ` (${result.reason})` : "";
    console.log(`  ${icon} ${result.repo.owner}/${result.repo.name}${reason}`);
  });

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
