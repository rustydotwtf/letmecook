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
      label: `Cloning ${repo.owner}/${repo.name}`,
      command: args,
      cwd: sessionPath,
    };
  });
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
      const tasks = reposToCommandTasks(newRepos, session.path);

      const results = await runCommands(renderer, {
        title: "Adding repositories",
        tasks,
        showOutput: true,
        outputLines: 5,
        allowAbort: true,
        allowSkip: tasks.length > 1,
        allowBackground: true,
        sessionName: session.name,
      });

      // Handle aborted operation - return without changes
      const wasAborted = results.some((r) => r.outcome === "aborted");
      if (wasAborted) {
        hideCommandRunner(renderer);
        // Clean up any partially cloned repos
        for (const repo of newRepos) {
          const repoPath = join(session.path, repo.dir);
          try {
            await rm(repoPath, { recursive: true, force: true });
          } catch {
            // Ignore cleanup errors
          }
        }
        return { session, cancelled: true };
      }

      // Clean up skipped repo directories
      const skippedResults = results.filter((r) => r.outcome === "skipped");
      for (const skipped of skippedResults) {
        const repoSpec = skipped.task.label.replace("Cloning ", "");
        const repo = newRepos.find((r) => `${r.owner}/${r.name}` === repoSpec);
        if (repo) {
          const repoPath = join(session.path, repo.dir);
          try {
            await rm(repoPath, { recursive: true, force: true });
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      // Filter to only successfully cloned repos
      const successfulRepos = newRepos.filter((repo) => {
        const result = results.find(
          (r) => r.task.label === `Cloning ${repo.owner}/${repo.name}`
        );
        return result?.outcome === "completed";
      });

      // Check for errors (not skipped/aborted)
      const errors = results.filter((r) => r.outcome === "error");
      if (errors.length > 0) {
        console.error(
          `\n⚠️  ${errors.length} repository(ies) failed to clone:`
        );
        errors.forEach((err) => {
          console.error(`  ✗ ${err.task.label}`);
          if (err.error) {
            console.error(`    ${err.error}`);
          }
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 700));
      hideCommandRunner(renderer);

      if (successfulRepos.length > 0) {
        const allRepos = [...session.repos, ...successfulRepos];
        const updatedSession = await updateSessionRepos(session.name, allRepos);
        const nextSession = updatedSession ?? session;

        await recordRepoHistory(successfulRepos);
        await writeAgentsMd(nextSession);

        return { session: nextSession, cancelled: false };
      }

      return { session, cancelled: false };
    }
  }

  return { session, cancelled: addResult.cancelled };
}
