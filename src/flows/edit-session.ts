import { join } from "node:path";
import type { Session, RepoSpec } from "../types";
import { updateSessionRepos, updateSessionSkills, deleteSession } from "../sessions";
import { writeAgentsMd } from "../agents-md";
import { recordRepoHistory } from "../repo-history";
import { removeSkillFromSession } from "../skills";
import { createRenderer, destroyRenderer } from "../ui/renderer";
import { runCommands, hideCommandRunner, type CommandTask } from "../ui/common/command-runner";
import { rm } from "node:fs/promises";

export interface EditSessionParams {
  session: Session;
  updates: {
    repos?: RepoSpec[];
    goal?: string;
    skills?: string[];
  };
}

function reposToCommandTasks(repos: RepoSpec[], sessionPath: string): CommandTask[] {
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
      : ["git", "clone", "--depth", "1", "--single-branch", "--progress", url, targetDir];

    return {
      label: `Cloning ${repo.owner}/${repo.name}`,
      command: args,
      cwd: sessionPath,
    };
  });
}

function skillsToCommandTasks(skills: string[], sessionPath: string): CommandTask[] {
  return skills.map((skill) => ({
    label: `Installing ${skill}`,
    command: ["bunx", "skills", "add", skill, "-y"],
    cwd: sessionPath,
  }));
}

export async function editSession(params: EditSessionParams): Promise<Session | null> {
  const { session, updates } = params;

  if (!updates.repos && !updates.goal && !updates.skills) {
    return session;
  }

  let currentSession = session;
  const renderer = await createRenderer();

  try {
    if (updates.repos) {
      const existingSpecs = new Set(session.repos.map((r) => r.spec));
      const newRepos = updates.repos.filter((r) => !existingSpecs.has(r.spec));

      if (newRepos.length > 0) {
        const tasks = reposToCommandTasks(newRepos, currentSession.path);

        const results = await runCommands(renderer, {
          title: "Adding repositories",
          tasks,
          showOutput: true,
          outputLines: 5,
          allowAbort: true,
          allowSkip: tasks.length > 1,
          allowBackground: true,
        });

        // Handle aborted operation
        const wasAborted = results.some((r) => r.outcome === "aborted");
        if (wasAborted) {
          hideCommandRunner(renderer);
          // Clean up any partially cloned repos
          for (const repo of newRepos) {
            const repoPath = join(currentSession.path, repo.dir);
            try {
              await rm(repoPath, { recursive: true, force: true });
            } catch {
              // Ignore cleanup errors
            }
          }
          destroyRenderer();
          return session; // Return unchanged session
        }

        // Clean up skipped repo directories
        const skippedResults = results.filter((r) => r.outcome === "skipped");
        for (const skipped of skippedResults) {
          const repoSpec = skipped.task.label.replace("Cloning ", "");
          const repo = newRepos.find((r) => `${r.owner}/${r.name}` === repoSpec);
          if (repo) {
            const repoPath = join(currentSession.path, repo.dir);
            try {
              await rm(repoPath, { recursive: true, force: true });
            } catch {
              // Ignore cleanup errors
            }
          }
        }

        // Filter to only successfully cloned repos
        const successfulRepos = newRepos.filter((repo) => {
          const result = results.find((r) => r.task.label === `Cloning ${repo.owner}/${repo.name}`);
          return result?.outcome === "completed";
        });

        // Check for errors (not skipped/aborted)
        const errors = results.filter((r) => r.outcome === "error");
        if (errors.length > 0) {
          console.error(`\n⚠️  ${errors.length} repository(ies) failed to clone:`);
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
          await recordRepoHistory(successfulRepos);
          await writeAgentsMd(currentSession);
        }

        // Update session with existing + successful repos only
        const allRepos = [...session.repos, ...successfulRepos];
        const updatedSession = await updateSessionRepos(session.name, allRepos);
        if (updatedSession) {
          currentSession = updatedSession;
        }
      } else {
        // No new repos, just update with the provided list
        const updatedSession = await updateSessionRepos(session.name, updates.repos);
        if (updatedSession) {
          currentSession = updatedSession;
        }
      }
    }

    if (updates.skills) {
      const existingSkills = new Set(session.skills || []);
      const newSkills = updates.skills.filter((s) => !existingSkills.has(s));

      if (newSkills.length > 0) {
        const tasks = skillsToCommandTasks(newSkills, currentSession.path);

        const results = await runCommands(renderer, {
          title: "Adding skills",
          tasks,
          showOutput: true,
          outputLines: 5,
          allowAbort: true,
          allowSkip: tasks.length > 1,
          allowBackground: true,
        });

        // Handle aborted operation
        const wasAborted = results.some((r) => r.outcome === "aborted");
        if (wasAborted) {
          hideCommandRunner(renderer);
          destroyRenderer();
          return currentSession; // Return current session state
        }

        // Filter to only successfully installed skills
        const successfulSkills = newSkills.filter((skill) => {
          const result = results.find((r) => r.task.label === `Installing ${skill}`);
          return result?.outcome === "completed";
        });

        // Check for errors (not skipped/aborted)
        const errors = results.filter((r) => r.outcome === "error");
        if (errors.length > 0) {
          console.error(`\n⚠️  ${errors.length} skill(s) failed to install:`);
          errors.forEach((err) => {
            console.error(`  ✗ ${err.task.label}`);
            if (err.error) {
              console.error(`    ${err.error}`);
            }
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 700));
        hideCommandRunner(renderer);

        if (successfulSkills.length > 0) {
          const allSkills = [...(currentSession.skills || []), ...successfulSkills];
          const updatedSession = await updateSessionSkills(currentSession.name, allSkills);

          if (updatedSession) {
            currentSession = updatedSession;
            await writeAgentsMd(currentSession);
          }
        }
      }
    }
  } finally {
    destroyRenderer();
  }

  if (updates.goal !== undefined) {
    const sessionGoal = updates.goal || undefined;
    const updatedSession = { ...currentSession, goal: sessionGoal };

    await writeAgentsMd(updatedSession);
    currentSession = updatedSession as Session;
  }

  return currentSession;
}

export async function nukeSession(session: Session): Promise<boolean> {
  const success = await deleteSession(session.name);
  return success;
}

export async function removeSkill(session: Session, skillString: string): Promise<Session> {
  const updatedSession = await removeSkillFromSession(session, skillString);
  return updatedSession || session;
}
