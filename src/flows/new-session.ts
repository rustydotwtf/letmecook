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

export async function createNewSession(
  renderer: CliRenderer,
  params: NewSessionParams
): Promise<NewSessionResult | null> {
  const { repos, goal, skills, mode, skipConflictCheck = false } = params;

  try {
    if (!skipConflictCheck) {
      const existingSession = await findMatchingSession(repos);

      if (existingSession) {
        const choice = await showConflictPrompt(renderer, existingSession);

        switch (choice) {
          case "resume": {
            return { session: existingSession, skipped: true };
          }

          case "nuke": {
            await deleteSession(existingSession.name);
            break;
          }

          case "new": {
            break;
          }

          case "cancel": {
            return null;
          }
        }
      }
    }

    // Generate session name (show UI feedback during generation in TUI mode)
    let sessionName: string;
    if (mode === "tui") {
      const proposal = showAgentProposal(renderer, {
        goal,
        repos,
        sessionName: "generating...",
      });
      sessionName = await generateSessionName(repos, goal);
      proposal.sessionNameText.content = `Session: ${sessionName}`;
      renderer.requestRender();
    } else {
      sessionName = await generateSessionName(repos, goal);
    }

    if (mode === "tui") {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const session = await createSession(
        sessionName,
        repos,
        goal,
        skills?.length ? skills : undefined
      );

      // Build all tasks (repos + skills)
      const tasks: CommandTask[] = [
        ...reposToCommandTasks(repos, session.path),
        ...(skills && skills.length > 0
          ? skillsToCommandTasks(skills, session.path)
          : []),
      ];

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

      // Handle aborted operation - clean up and return null
      const wasAborted = results.some((r) => r.outcome === "aborted");
      if (wasAborted) {
        hideCommandRunner(renderer);
        // Clean up the partial session
        await deleteSession(session.name);
        return null;
      }

      // Clean up skipped repo directories
      const skippedResults = results.filter((r) => r.outcome === "skipped");
      for (const skipped of skippedResults) {
        const repoName = skipped.task.label
          .replace("Cloning ", "")
          .split("/")[1];
        if (repoName) {
          const repoPath = join(session.path, repoName);
          try {
            await rm(repoPath, { force: true, recursive: true });
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      // Filter out skipped repos from the session
      const successfulRepoResults = results.filter(
        (r) => r.outcome === "completed" && r.task.label.startsWith("Cloning ")
      );
      const successfulRepoSpecs = successfulRepoResults
        .map((r) => {
          const repoSpec = r.task.label.replace("Cloning ", "");
          return repos.find(
            (repo) => `${repo.owner}/${repo.name}` === repoSpec
          );
        })
        .filter((r): r is RepoSpec => r !== undefined);

      // Check for errors (not skipped/aborted)
      const errors = results.filter((r) => r.outcome === "error");
      if (errors.length > 0) {
        console.error(`\n⚠️  ${errors.length} task(s) failed:`);
        errors.forEach((err) => {
          console.error(`  ✗ ${err.task.label}`);
          if (err.error) {
            console.error(`    ${err.error}`);
          }
        });
      }

      // Record only successful repos
      if (successfulRepoSpecs.length > 0) {
        await recordRepoHistory(successfulRepoSpecs);
      }

      await new Promise((resolve) => setTimeout(resolve, 700));
      hideCommandRunner(renderer);

      await writeAgentsMd(session);
      await createClaudeMdSymlink(session.path);

      return { session };
    }
    // CLI mode - simpler output
    const session = await createSession(
      sessionName,
      repos,
      goal,
      skills?.length ? skills : undefined
    );

    console.log(`\nCloning ${repos.length} repository(ies)...`);

    const tasks: CommandTask[] = [
      ...reposToCommandTasks(repos, session.path),
      ...(skills && skills.length > 0
        ? skillsToCommandTasks(skills, session.path)
        : []),
    ];

    const results = await runCommands(renderer, {
      showOutput: false,
      tasks,
      title: "Setting up session", // CLI mode doesn't need visual output
    });

    // Print results
    results.forEach((result) => {
      if (result.success) {
        console.log(`  ✓ ${result.task.label}`);
      } else {
        console.log(`  ✗ ${result.task.label}`);
        if (result.error) {
          console.log(`    ${result.error}`);
        }
      }
    });

    await writeAgentsMd(session);
    await createClaudeMdSymlink(session.path);

    hideCommandRunner(renderer);

    return { session };
  } catch (error) {
    hideCommandRunner(renderer);
    throw error;
  }
}
