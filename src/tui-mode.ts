import type { CliRenderer } from "@opentui/core";

import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";

import type { Session, RepoSpec } from "./types";

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

type MainMenuAction = Awaited<ReturnType<typeof showMainMenu>>;

async function handleChatAction(): Promise<Session | null> {
  destroyRenderer();
  const chatResult = await handleChatMode();
  if (chatResult.session) {
    return chatResult.session as Session;
  }
  return null;
}

async function handleChatSessionFlow(): Promise<void> {
  const session = await handleChatAction();
  if (session) {
    const renderer = await createRenderer();
    await handleSessionDetailsFlow(renderer, session);
  } else {
    const renderer = await createRenderer();
    await handleNewSessionFlow(renderer);
  }
}

async function handleNukeAction(
  renderer: CliRenderer,
  sessionCount: number
): Promise<boolean> {
  const choice = await showNukeConfirm(renderer, sessionCount);
  if (choice === "confirm") {
    const count = await deleteAllSessions();
    destroyRenderer();
    console.log(`\nNuked ${count} session(s) and all data.`);
    return true;
  }
  return false;
}

async function handleQuitAction(renderer: CliRenderer): Promise<boolean> {
  const runningProcesses = await getRunningProcesses();
  if (runningProcesses.length > 0) {
    const choice = await showQuitWarning(renderer, runningProcesses);
    if (choice === "cancel") {
      return false;
    }
    if (choice === "kill") {
      await killAllProcesses();
    }
  }
  destroyRenderer();
  console.log("\nGoodbye!");
  return true;
}

async function handleNewSessionFlowAction(
  renderer: CliRenderer
): Promise<boolean> {
  await handleNewSessionFlow(renderer);
  return false;
}

async function handleResumeAction(
  renderer: CliRenderer,
  session: Session
): Promise<boolean> {
  await handleSessionDetailsFlow(renderer, session);
  return false;
}

async function handleDeleteAction(
  renderer: CliRenderer,
  session: Session
): Promise<boolean> {
  const choice = await showDeleteConfirm(renderer, session);
  if (choice === "confirm") {
    await deleteSession(session.name);
  }
  return false;
}

async function handleMainMenuAction(
  renderer: CliRenderer,
  action: MainMenuAction,
  sessions: Session[]
): Promise<boolean> {
  switch (action.type) {
    case "chat": {
      await handleChatSessionFlow();
      return false;
    }

    case "new-session": {
      return await handleNewSessionFlowAction(renderer);
    }

    case "resume": {
      return await handleResumeAction(renderer, action.session);
    }

    case "delete": {
      return await handleDeleteAction(renderer, action.session);
    }

    case "nuke": {
      return await handleNukeAction(renderer, sessions.length);
    }

    case "quit": {
      return await handleQuitAction(renderer);
    }

    default: {
      return false;
    }
  }
}

async function processMainMenuIteration(
  renderer: CliRenderer
): Promise<boolean> {
  const sessions = await listSessions();
  const action = await showMainMenu(renderer, sessions);

  return await handleMainMenuAction(renderer, action, sessions);
}

async function runMainLoop(): Promise<void> {
  let renderer = await createRenderer();

  try {
    while (true) {
      renderer = await createRenderer();
      const shouldExit = await processMainMenuIteration(renderer);
      if (shouldExit) {
        return;
      }
    }
  } catch (error) {
    destroyRenderer();
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function launchSessionDetails(session: Session): Promise<void> {
  const renderer = await createRenderer();
  try {
    await handleSessionDetailsFlow(renderer, session);
  } catch (error) {
    destroyRenderer();
    throw error;
  }
  destroyRenderer();
}

async function handleChatSession(
  chatResult: Awaited<ReturnType<typeof handleChatMode>>
): Promise<boolean> {
  if (chatResult.cancelled) {
    return true;
  }

  if (chatResult.session) {
    await launchSessionDetails(chatResult.session as Session);
    return true;
  }

  return false;
}

export async function handleTUIMode(): Promise<void> {
  await showSplash();

  // Start with chat mode as default entry point
  const chatResult = await handleChatMode();

  const shouldExit = await handleChatSession(chatResult);
  if (shouldExit) {
    return;
  }

  await runMainLoop();
}

interface SessionInputs {
  repos: RepoSpec[];
  goal: string | undefined;
  skills: string[] | undefined;
}

async function addReposAndSkills(renderer: CliRenderer): Promise<{
  repos: RepoSpec[];
  skills: string[];
} | null> {
  const addReposResult = await showAddReposPrompt(renderer);

  if (addReposResult.cancelled || addReposResult.repos.length === 0) {
    return null;
  }

  const { repos } = addReposResult;

  const { skills, cancelled: skillsCancelled } =
    await showSkillsPrompt(renderer);

  if (skillsCancelled) {
    return null;
  }

  return { repos, skills };
}

async function gatherSessionInputs(
  renderer: CliRenderer
): Promise<SessionInputs | null> {
  const inputs = await addReposAndSkills(renderer);

  if (!inputs) {
    return null;
  }

  const { repos, skills } = inputs;

  const goalResult = await showNewSessionPrompt(renderer, repos);

  if (goalResult.cancelled) {
    return null;
  }

  return {
    goal: goalResult.goal,
    repos,
    skills: skills.length > 0 ? skills : undefined,
  };
}

async function launchSession(
  renderer: CliRenderer,
  session: Session,
  skipped: boolean
): Promise<void> {
  if (skipped) {
    await handleSessionDetailsFlow(renderer, session);
    return;
  }

  destroyRenderer();

  await runManualSetup(session);
  await resumeSession(renderer, {
    initialRefresh: false,
    mode: "tui",
    session,
  });
}

async function handleNewSessionFlow(renderer: CliRenderer): Promise<void> {
  const inputs = await gatherSessionInputs(renderer);

  if (!inputs) {
    return;
  }

  const result = await createNewSession(renderer, {
    goal: inputs.goal,
    mode: "tui",
    repos: inputs.repos,
    skills: inputs.skills,
  });

  if (!result) {
    return;
  }

  await launchSession(renderer, result.session, result.skipped ?? false);
}

async function executeSetupCommand(
  cmd: string,
  session: Session
): Promise<void> {
  console.log(`\nRunning: ${cmd}...`);
  const proc = Bun.spawn(["bash", "-c", cmd], {
    cwd: session.path,
    stdio: ["inherit", "inherit", "inherit"],
  });

  await proc.exited;

  if (proc.exitCode === 0) {
    console.log("✅ Command completed");
  } else {
    console.log(`❌ Command failed with exit code ${proc.exitCode}`);
  }

  console.log("\nEnter another command or press Enter to launch claude.");
}

async function processSetupCommand(
  rl: Interface,
  session: Session
): Promise<boolean> {
  const answer = await rl.question("> ");
  const cmd = answer.trim();

  if (!cmd) {
    console.log("\n🚀 Launching claude...\n");
    return false;
  }

  await executeSetupCommand(cmd, session);
  return true;
}

async function runSetupCommandLoop(session: Session): Promise<void> {
  const rl = createInterface({ input, output });

  console.log(
    "\n⚡️ Would you like to run any setup commands before launching claude?"
  );
  console.log("   Examples: npm install, bun install, make build");
  console.log("   Press Enter to skip and launch claude immediately.\n");

  while (await processSetupCommand(rl, session)) {
    // Continue loop
  }

  rl.close();
}

async function runManualSetup(session: Session): Promise<void> {
  await runSetupCommandLoop(session);
}

async function handleSessionResume(
  renderer: CliRenderer,
  session: Session
): Promise<void> {
  await updateLastAccessed(session.name);
  await resumeSession(renderer, {
    initialRefresh: true,
    mode: "tui",
    session,
  });
}

async function handleSessionEdit(
  renderer: CliRenderer,
  session: Session
): Promise<Session | null> {
  const editResult = await showSessionSettings(renderer, session);
  if (editResult.action === "saved") {
    return await updateSessionSettings(editResult.session.name, {
      goal: editResult.session.goal,
      repos: editResult.session.repos,
    });
  }
  if (editResult.action === "add-repos") {
    const saved = await updateSessionSettings(editResult.session.name, {
      goal: editResult.session.goal,
      repos: editResult.session.repos,
    });
    console.log("[TODO] Add repos flow - needs to be implemented");
    return saved;
  }
  return null;
}

async function processSessionDetailsAction(
  renderer: CliRenderer,
  currentSession: Session
): Promise<boolean> {
  const detailsAction = await showSessionDetails(renderer, currentSession);

  if (detailsAction === "resume") {
    await handleSessionResume(renderer, currentSession);
    return false;
  }

  if (detailsAction === "edit") {
    return true;
  }

  if (detailsAction === "back") {
    return false;
  }

  return true;
}

async function handleSessionDetailsFlow(
  renderer: CliRenderer,
  session: Session
): Promise<void> {
  let currentSession = session;

  while (true) {
    const keepLooping = await processSessionDetailsAction(
      renderer,
      currentSession
    );
    if (!keepLooping) {
      return;
    }

    const updated = await handleSessionEdit(renderer, currentSession);
    if (updated) {
      currentSession = updated;
    }
  }
}
