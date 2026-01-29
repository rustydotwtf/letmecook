import  { type CliRenderer } from "@opentui/core";

import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import  { type Session } from "./types";

import { handleChatMode } from "./chat-mode";
import { createNewSession, resumeSession } from "./flows";
import { getRunningProcesses, killAllProcesses } from "./process-registry";
import {
  listSessions,
  deleteSession,
  deleteAllSessions,
  updateLastAccessed,
  updateSessionSettings,
} from "./sessions";
import { showSplash } from "./splash";
import { showAddReposPrompt } from "./ui/add-repos";
import { showQuitWarning } from "./ui/background-warning";
import { showDeleteConfirm } from "./ui/confirm-delete";
import { showNukeConfirm } from "./ui/confirm-nuke";
import { showMainMenu } from "./ui/main-menu";
import { showNewSessionPrompt } from "./ui/new-session";
import { createRenderer, destroyRenderer } from "./ui/renderer";
import { showSessionDetails } from "./ui/session-details";
import { showSessionSettings } from "./ui/session-settings";
import { showSkillsPrompt } from "./ui/skills";

export async function handleTUIMode(): Promise<void> {
  await showSplash();

  // Start with chat mode as default entry point
  const chatResult = await handleChatMode();

  if (chatResult.cancelled) {
    // User cancelled, exit
    return;
  }

  if (chatResult.session) {
    // Chat successfully created a session, go to session details
    const renderer = await createRenderer();
    try {
      await handleSessionDetailsFlow(renderer, chatResult.session as Session);
    } catch (error) {
      destroyRenderer();
      throw error;
    }
    destroyRenderer();
    return;
  }

  // Fall back to manual mode or main menu
  let renderer = await createRenderer();

  try {
    while (true) {
      renderer = await createRenderer();
      const sessions = await listSessions();
      const action = await showMainMenu(renderer, sessions);

      switch (action.type) {
        case "chat": {
          destroyRenderer();
          const chatResult = await handleChatMode();
          if (chatResult.session) {
            // Re-create renderer for session details
            renderer = await createRenderer();
            await handleSessionDetailsFlow(
              renderer,
              chatResult.session as Session
            );
          } else if (chatResult.useManualMode) {
            // Fall back to manual mode
            renderer = await createRenderer();
            await handleNewSessionFlow(renderer);
          }
          break;
        }

        case "new-session": {
          await handleNewSessionFlow(renderer);
          break;
        }

        case "resume": {
          await handleSessionDetailsFlow(renderer, action.session);
          break;
        }

        case "delete": {
          const choice = await showDeleteConfirm(renderer, action.session);
          if (choice === "confirm") {
            await deleteSession(action.session.name);
          }
          break;
        }

        case "nuke": {
          const choice = await showNukeConfirm(renderer, sessions.length);
          if (choice === "confirm") {
            const count = await deleteAllSessions();
            destroyRenderer();
            console.log(`\nNuked ${count} session(s) and all data.`);
            return;
          }
          break;
        }

        case "quit": {
          const runningProcesses = await getRunningProcesses();
          if (runningProcesses.length > 0) {
            const choice = await showQuitWarning(renderer, runningProcesses);
            if (choice === "cancel") {
              break; // Stay in main loop
            }
            if (choice === "kill") {
              await killAllProcesses();
            }
          }
          destroyRenderer();
          console.log("\nGoodbye!");
          return;
        }
      }
    }
  } catch (error) {
    destroyRenderer();
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function handleNewSessionFlow(renderer: CliRenderer): Promise<void> {
  const addReposResult = await showAddReposPrompt(renderer);

  if (addReposResult.cancelled || addReposResult.repos.length === 0) {
    return;
  }

  const {repos} = addReposResult;

  const { skills, cancelled: skillsCancelled } =
    await showSkillsPrompt(renderer);

  if (skillsCancelled) {
    return;
  }

  const goalResult = await showNewSessionPrompt(renderer, repos);

  if (goalResult.cancelled) {
    return;
  }

  const result = await createNewSession(renderer, {
    goal: goalResult.goal,
    mode: "tui",
    repos,
    skills: skills.length > 0 ? skills : undefined,
  });

  if (!result) {
    return;
  }

  const { session, skipped } = result;

  if (skipped) {
    await handleSessionDetailsFlow(renderer, session);
    return;
  }

  // Destroy renderer before runManualSetup to release stdin for readline
  destroyRenderer();

  await runManualSetup(session);
  await resumeSession(renderer, {
    initialRefresh: false,
    mode: "tui",
    session,
  });
}

async function runManualSetup(session: Session): Promise<void> {
  const rl = createInterface({ input, output });

  console.log(
    "\n⚡️ Would you like to run any setup commands before launching claude?"
  );
  console.log("   Examples: npm install, bun install, make build");
  console.log("   Press Enter to skip and launch claude immediately.\n");

  while (true) {
    const answer = await rl.question("> ");
    const cmd = answer.trim();

    if (!cmd) {
      console.log("\n🚀 Launching claude...\n");
      break;
    }

    console.log(`\nRunning: ${cmd}...`);
    const proc = Bun.spawn(["bash", "-c", cmd], {
      cwd: session.path,
      stdio: ["inherit", "inherit", "inherit"],
    });

    await proc.exited;

    if (proc.exitCode !== 0) {
      console.log(`❌ Command failed with exit code ${proc.exitCode}`);
    } else {
      console.log("✅ Command completed");
    }

    console.log("\nEnter another command or press Enter to launch claude.");
  }

  rl.close();
}

async function handleSessionDetailsFlow(
  renderer: CliRenderer,
  session: Session
): Promise<void> {
  let currentSession = session;

  while (true) {
    const detailsAction = await showSessionDetails(renderer, currentSession);

    if (detailsAction === "resume") {
      await updateLastAccessed(currentSession.name);
      await resumeSession(renderer, {
        initialRefresh: true,
        mode: "tui",
        session: currentSession,
      });
      return;
    }

    if (detailsAction === "edit") {
      const editResult = await showSessionSettings(renderer, currentSession);
      if (editResult.action === "saved") {
        const saved = await updateSessionSettings(editResult.session.name, {
          goal: editResult.session.goal,
          repos: editResult.session.repos,
        });
        if (saved) {
          currentSession = saved;
        }
      } else if (editResult.action === "add-repos") {
        const saved = await updateSessionSettings(editResult.session.name, {
          goal: editResult.session.goal,
          repos: editResult.session.repos,
        });
        if (saved) {
          currentSession = saved;
        }
        console.log("[TODO] Add repos flow - needs to be implemented");
      }
      continue;
    }

    if (detailsAction === "back") {
      return;
    }
  }
}
