import type { CliRenderer } from "@opentui/core";

import { ChatLogger } from "./chat-logger";
import {
  createNewSession,
  resumeSession,
  type NewSessionResult,
} from "./flows";
import {
  deleteAllSessions,
  deleteSession,
  getSession,
  listSessions,
  updateLastAccessed,
} from "./sessions";
import { type RepoSpec, type Session, parseRepoSpec } from "./types";
import { showNukeConfirm } from "./ui/confirm-nuke";
import { showSessionList } from "./ui/list";
import { showNewSessionPrompt } from "./ui/new-session";
import { createRenderer, destroyRenderer } from "./ui/renderer";

export function printCLIUsage(): void {
  console.log(`
letmecook CLI mode

Usage:
  letmecook --cli <owner/repo> [owner/repo:branch...] Create or resume a session
  letmecook --cli --list                              List all sessions
  letmecook --cli --resume <session-name>             Resume a session
  letmecook --cli --delete <session-name>             Delete a session
  letmecook --cli --nuke [--yes]                      Nuke everything
  letmecook --cli --logs                              List chat logs
  letmecook --cli --logs --view <log-id>              View chat log
  letmecook --cli --logs --delete <log-id>            Delete chat log
  letmecook --cli --logs --nuke [--yes]               Delete all chat logs

Examples:
  letmecook --cli microsoft/playwright
  letmecook --cli facebook/react openai/agents
  letmecook --cli --resume playwright-agent-tests
  letmecook --cli --logs
  letmecook --cli --logs --view 1700000000000-abc123
  `);
}

function cancelSession(): void {
  destroyRenderer();
  console.log("\nCancelled.");
}

async function resumeExistingSession(
  renderer: CliRenderer,
  session: Session
): Promise<void> {
  destroyRenderer();
  console.log(`\nResuming existing session: ${session.name}\n`);
  await resumeSession(renderer, {
    initialRefresh: true,
    mode: "cli",
    session,
  });
}

async function startSession(
  renderer: CliRenderer,
  session: Session
): Promise<void> {
  destroyRenderer();
  console.log(`\nSession created: ${session.name}`);
  console.log(`Path: ${session.path}\n`);
  await resumeSession(renderer, {
    initialRefresh: false,
    mode: "cli",
    session,
  });
}

async function handleNewSessionResult(
  renderer: CliRenderer,
  result: NewSessionResult
): Promise<void> {
  const { session, skipped } = result;

  if (skipped) {
    await resumeExistingSession(renderer, session);
  } else {
    await startSession(renderer, session);
  }
}

async function runNewSessionFlow(
  renderer: CliRenderer,
  repos: RepoSpec[]
): Promise<void> {
  const { goal, cancelled } = await showNewSessionPrompt(renderer, repos);
  if (cancelled) {
    cancelSession();
    return;
  }

  const result = await createNewSession(renderer, {
    goal,
    mode: "cli",
    repos,
  });

  if (!result) {
    cancelSession();
    return;
  }

  await handleNewSessionResult(renderer, result);
}

export async function handleNewSessionCLI(repos: RepoSpec[]): Promise<void> {
  const renderer = await createRenderer();

  try {
    await runNewSessionFlow(renderer, repos);
  } catch (error) {
    destroyRenderer();
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function processResumeAction(
  renderer: CliRenderer,
  session: Session
): Promise<void> {
  destroyRenderer();
  await updateLastAccessed(session.name);
  console.log(`\nResuming session: ${session.name}`);
  await resumeSession(renderer, {
    initialRefresh: true,
    mode: "cli",
    session,
  });
}

async function processNukeAction(
  renderer: CliRenderer,
  count: number
): Promise<void> {
  const choice = await showNukeConfirm(renderer, count);
  if (choice === "confirm") {
    const deletedCount = await deleteAllSessions();
    destroyRenderer();
    console.log(`\nNuked ${deletedCount} session(s) and all data.`);
  } else {
    destroyRenderer();
  }
}

async function processListAction(
  renderer: CliRenderer,
  session: Session
): Promise<void> {
  await processResumeAction(renderer, session);
}

function processQuitAction(): void {
  destroyRenderer();
}

async function handleSessionAction(
  renderer: CliRenderer,
  action: { type: string; session?: Session },
  sessionCount: number
): Promise<void> {
  switch (action.type) {
    case "resume": {
      if (action.session) {
        await processListAction(renderer, action.session);
      }
      break;
    }
    case "delete": {
      console.log("[TODO] Delete session flow");
      break;
    }
    case "nuke": {
      await processNukeAction(renderer, sessionCount);
      break;
    }
    case "quit": {
      processQuitAction();
      break;
    }
    default: {
      break;
    }
  }
}

async function listSessionLoop(renderer: CliRenderer): Promise<void> {
  const sessions = await listSessions();
  const action = await showSessionList(renderer, sessions);
  await handleSessionAction(renderer, action, sessions.length);
}

export async function handleList(): Promise<void> {
  const renderer = await createRenderer();

  try {
    while (true) {
      await listSessionLoop(renderer);
    }
  } catch (error) {
    destroyRenderer();
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function printSessionsList(sessions: unknown[]): void {
  if (sessions.length === 0) {
    console.log("  (none)");
  } else {
    for (const s of sessions) {
      console.log(`  - ${(s as { name: string }).name}`);
    }
  }
}

async function handleSessionNotFound(sessionName: string): Promise<never> {
  console.error(`Session not found: ${sessionName}`);
  console.log("\nAvailable sessions:");
  const sessions = await listSessions();
  printSessionsList(sessions);
  process.exit(1);
}

export async function handleResume(sessionName: string): Promise<void> {
  const session = await getSession(sessionName);

  if (!session) {
    return handleSessionNotFound(sessionName);
  }

  await updateLastAccessed(session.name);
  console.log(`\nResuming session: ${session.name}`);
  const renderer = await createRenderer();
  await resumeSession(renderer, {
    initialRefresh: true,
    mode: "cli",
    session,
  });
}

async function attemptDeleteSession(sessionName: string): Promise<boolean> {
  const deleted = await deleteSession(sessionName);
  if (deleted) {
    console.log(`Deleted session: ${sessionName}`);
    return true;
  }
  console.error(`Failed to delete session: ${sessionName}`);
  process.exit(1);
}

export async function handleDelete(sessionName: string): Promise<void> {
  const session = await getSession(sessionName);

  if (!session) {
    await handleSessionNotFound(sessionName);
  }

  await attemptDeleteSession(sessionName);
}

async function confirmSessionDeletion(
  renderer: CliRenderer,
  count: number
): Promise<void> {
  const choice = await showNukeConfirm(renderer, count);
  destroyRenderer();

  if (choice === "confirm") {
    const deletedCount = await deleteAllSessions();
    console.log(`Nuked ${deletedCount} session(s) and all data.`);
  } else {
    console.log("Cancelled.");
  }
}

async function performNukeWithConfirmation(
  renderer: CliRenderer,
  sessionCount: number
): Promise<void> {
  await confirmSessionDeletion(renderer, sessionCount);
}

export async function handleNuke(skipConfirm = false): Promise<void> {
  const sessions = await listSessions();
  if (sessions.length === 0) {
    console.log("Nothing to nuke.");
    return;
  }

  if (skipConfirm || !process.stdin.isTTY) {
    const count = await deleteAllSessions();
    console.log(`Nuked ${count} session(s) and all data.`);
    return;
  }

  const renderer = await createRenderer();
  await performNukeWithConfirmation(renderer, sessions.length);
}

function readStdin(): Promise<string> {
  const { promise, resolve } = Promise.withResolvers<string>();
  process.stdin.once("data", (data) => {
    resolve(data.toString().trim().toLowerCase());
  });
  return promise;
}

async function confirmNudgeLogs(): Promise<void> {
  const count = await ChatLogger.deleteAllLogs();
  console.log(`Deleted ${count} chat log(s).`);
}

function cancelNukeLogs(): void {
  console.log("Cancelled.");
}

async function processChatLogsNukeConfirmation(
  logsCount: number
): Promise<void> {
  process.stdout.write(`Delete all ${logsCount} chat logs? [y/N] `);
  const response = await readStdin();

  if (response === "y" || response === "yes") {
    await confirmNudgeLogs();
  } else {
    await cancelNukeLogs();
  }
}

async function deleteAllChatLogs(): Promise<void> {
  const count = await ChatLogger.deleteAllLogs();
  console.log(`Deleted ${count} chat log(s).`);
}

async function performChatLogsNuke(skipConfirm: boolean): Promise<void> {
  const logs = await ChatLogger.listLogs();
  if (logs.length === 0) {
    console.log("No chat logs to delete.");
    return;
  }

  if (skipConfirm || !process.stdin.isTTY) {
    await deleteAllChatLogs();
    return;
  }

  await processChatLogsNukeConfirmation(logs.length);
}

export async function handleChatLogsNuke(skipConfirm = false): Promise<void> {
  await performChatLogsNuke(skipConfirm);
}

export async function handleChatLogsList(): Promise<void> {
  const logs = await ChatLogger.listLogs();
  if (logs.length === 0) {
    console.log("No chat logs found.");
    return;
  }

  console.log("Chat Logs:");
  for (const log of logs) {
    console.log(`  ID: ${log.id}`);
    console.log(`  Created: ${log.createdAt}`);
    console.log("");
  }
}

export async function handleChatLogView(logId: string): Promise<void> {
  const log = await ChatLogger.getLog(logId);
  if (!log) {
    console.error(`Chat log not found: ${logId}`);
    process.exit(1);
  }

  console.log(JSON.stringify(log, null, 2));
}

export async function handleChatLogDelete(logId: string): Promise<void> {
  const log = await ChatLogger.getLog(logId);
  if (!log) {
    console.error(`Chat log not found: ${logId}`);
    process.exit(1);
  }

  const deleted = await ChatLogger.deleteLog(logId);
  if (deleted) {
    console.log(`Deleted chat log: ${logId}`);
  } else {
    console.error(`Failed to delete chat log: ${logId}`);
    process.exit(1);
  }
}

export function parseRepos(args: string[]): RepoSpec[] {
  const repos: RepoSpec[] = [];

  for (const arg of args) {
    if (!arg || arg.startsWith("-")) {
      continue;
    }

    if (!arg.includes("/")) {
      throw new Error(`Invalid repo format: ${arg} (expected owner/repo)`);
    }

    const repo = parseRepoSpec(arg);
    repos.push(repo);
  }

  return repos;
}

async function handleResumeCommand(
  secondArg: string | undefined,
  _args: string[]
): Promise<void> {
  if (!secondArg) {
    console.error(
      "Missing session name. Usage: letmecook --cli --resume <session-name>"
    );
    process.exit(1);
  }
  await handleResume(secondArg);
}

async function handleDeleteCommand(
  secondArg: string | undefined,
  _args: string[]
): Promise<void> {
  if (!secondArg) {
    console.error(
      "Missing session name. Usage: letmecook --cli --delete <session-name>"
    );
    process.exit(1);
  }
  await handleDelete(secondArg);
}

async function handleLogsViewCommand(
  thirdArg: string | undefined,
  _args: string[]
): Promise<void> {
  if (!thirdArg) {
    console.error(
      "Missing log ID. Usage: letmecook --cli --logs --view <log-id>"
    );
    process.exit(1);
  }
  await handleChatLogView(thirdArg);
}

async function handleLogsDeleteCommand(
  thirdArg: string | undefined,
  _args: string[]
): Promise<void> {
  if (!thirdArg) {
    console.error(
      "Missing log ID. Usage: letmecook --cli --logs --delete <log-id>"
    );
    process.exit(1);
  }
  await handleChatLogDelete(thirdArg);
}

async function handleLogsNukeCommand(args: string[]): Promise<void> {
  const hasYes = args.includes("--yes") || args.includes("-y");
  await handleChatLogsNuke(hasYes);
}

async function handleLogsCommands(
  secondArg: string | undefined,
  args: string[]
): Promise<void> {
  if (secondArg === "--view") {
    await handleLogsViewCommand(args[2], args);
  } else if (secondArg === "--delete") {
    await handleLogsDeleteCommand(args[2], args);
  } else if (secondArg === "--nuke") {
    await handleLogsNukeCommand(args);
  } else {
    await handleChatLogsList();
  }
}

async function handleNewSessionCommand(args: string[]): Promise<void> {
  const repos = parseRepos(args);
  if (repos.length === 0) {
    printCLIUsage();
    process.exit(1);
  }
  await handleNewSessionCLI(repos);
}

function handleUnknownCommand(firstArg: string | undefined): never {
  if (firstArg?.startsWith("-")) {
    console.error(`Unknown CLI option: ${firstArg}`);
  }
  printCLIUsage();
  process.exit(firstArg ? 1 : 0);
}

async function handleNukeCommand(args: string[]): Promise<void> {
  const hasYes = args.includes("--yes") || args.includes("-y");
  await handleNuke(hasYes);
}

const CLI_COMMAND_MAP: Record<
  string,
  (args: string[], secondArg?: string) => Promise<void>
> = {
  "--delete": (args, secondArg) => handleDeleteCommand(secondArg, args),
  "--list": () => handleList(),
  "--logs": (args, secondArg) => handleLogsCommands(secondArg, args),
  "--nuke": (args) => handleNukeCommand(args),
  "--resume": (args, secondArg) => handleResumeCommand(secondArg, args),
  "-d": (args, secondArg) => handleDeleteCommand(secondArg, args),
  "-l": () => handleList(),
  "-r": (args, secondArg) => handleResumeCommand(secondArg, args),
};

async function runNewSessionWithErrorHandling(args: string[]): Promise<void> {
  try {
    await handleNewSessionCommand(args);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export async function handleCLIMode(args: string[]): Promise<void> {
  const [firstArg, secondArg] = args;

  const handler = firstArg ? CLI_COMMAND_MAP[firstArg] : undefined;
  if (handler) {
    await handler(args, secondArg);
    return;
  }

  if (!firstArg || firstArg.startsWith("-")) {
    handleUnknownCommand(firstArg);
  }

  await runNewSessionWithErrorHandling(args);
}
