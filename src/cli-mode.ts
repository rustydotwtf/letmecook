import { ChatLogger } from "./chat-logger";
import { createNewSession, resumeSession } from "./flows";
import {
  listSessions,
  getSession,
  updateLastAccessed,
  deleteAllSessions,
  deleteSession,
} from "./sessions";
import { parseRepoSpec, type RepoSpec } from "./types";
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

export async function handleNewSessionCLI(repos: RepoSpec[]): Promise<void> {
  const renderer = await createRenderer();

  try {
    const { goal, cancelled } = await showNewSessionPrompt(renderer, repos);

    if (cancelled) {
      destroyRenderer();
      console.log("\nCancelled.");
      return;
    }

    const result = await createNewSession(renderer, {
      repos,
      goal,
      mode: "cli",
    });

    if (!result) {
      destroyRenderer();
      console.log("\nCancelled.");
      return;
    }

    const { session, skipped } = result;

    if (skipped) {
      destroyRenderer();
      console.log(`\nResuming existing session: ${session.name}\n`);
      await resumeSession(renderer, {
        session,
        mode: "cli",
        initialRefresh: true,
      });
      return;
    }

    destroyRenderer();
    console.log(`\nSession created: ${session.name}`);
    console.log(`Path: ${session.path}\n`);

    await resumeSession(renderer, {
      session,
      mode: "cli",
      initialRefresh: false,
    });
  } catch (error) {
    destroyRenderer();
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export async function handleList(): Promise<void> {
  const renderer = await createRenderer();

  try {
    while (true) {
      const sessions = await listSessions();
      const action = await showSessionList(renderer, sessions);

      switch (action.type) {
        case "resume":
          destroyRenderer();
          await updateLastAccessed(action.session.name);
          console.log(`\nResuming session: ${action.session.name}\n`);
          await resumeSession(renderer, {
            session: action.session,
            mode: "cli",
            initialRefresh: true,
          });
          return;

        case "delete":
          console.log("[TODO] Delete session flow");
          break;

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

        case "quit":
          destroyRenderer();
          return;
      }
    }
  } catch (error) {
    destroyRenderer();
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export async function handleResume(sessionName: string): Promise<void> {
  const session = await getSession(sessionName);

  if (!session) {
    console.error(`Session not found: ${sessionName}`);
    console.log("\nAvailable sessions:");
    const sessions = await listSessions();
    if (sessions.length === 0) {
      console.log("  (none)");
    } else {
      sessions.forEach((s) => console.log(`  - ${s.name}`));
    }
    process.exit(1);
  }

  await updateLastAccessed(session.name);
  console.log(`\nResuming session: ${session.name}\n`);

  const renderer = await createRenderer();
  await resumeSession(renderer, {
    session,
    mode: "cli",
    initialRefresh: true,
  });
}

export async function handleDelete(sessionName: string): Promise<void> {
  const session = await getSession(sessionName);

  if (!session) {
    console.error(`Session not found: ${sessionName}`);
    const sessions = await listSessions();
    if (sessions.length > 0) {
      console.log("\nAvailable sessions:");
      sessions.forEach((s) => console.log(`  - ${s.name}`));
    }
    process.exit(1);
  }

  const deleted = await deleteSession(sessionName);
  if (deleted) {
    console.log(`Deleted session: ${sessionName}`);
  } else {
    console.error(`Failed to delete session: ${sessionName}`);
    process.exit(1);
  }
}

export async function handleNuke(skipConfirm = false): Promise<void> {
  const sessions = await listSessions();
  if (sessions.length === 0) {
    console.log("Nothing to nuke.");
    return;
  }

  // Skip confirmation if --yes flag or non-interactive (piped input)
  if (skipConfirm || !process.stdin.isTTY) {
    const count = await deleteAllSessions();
    console.log(`Nuked ${count} session(s) and all data.`);
    return;
  }

  const renderer = await createRenderer();
  const choice = await showNukeConfirm(renderer, sessions.length);
  destroyRenderer();

  if (choice === "confirm") {
    const count = await deleteAllSessions();
    console.log(`Nuked ${count} session(s) and all data.`);
  } else {
    console.log("Cancelled.");
  }
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

export async function handleChatLogsNuke(skipConfirm = false): Promise<void> {
  const logs = await ChatLogger.listLogs();
  if (logs.length === 0) {
    console.log("No chat logs to delete.");
    return;
  }

  // Skip confirmation if --yes flag or non-interactive (piped input)
  if (skipConfirm || !process.stdin.isTTY) {
    const count = await ChatLogger.deleteAllLogs();
    console.log(`Deleted ${count} chat log(s).`);
    return;
  }

  // Prompt for confirmation
  process.stdout.write(`Delete all ${logs.length} chat logs? [y/N] `);
  const response = await new Promise<string>((resolve) => {
    process.stdin.once("data", (data) => {
      resolve(data.toString().trim().toLowerCase());
    });
  });

  if (response === "y" || response === "yes") {
    const count = await ChatLogger.deleteAllLogs();
    console.log(`\nDeleted ${count} chat log(s).`);
  } else {
    console.log("Cancelled.");
  }
}

export function parseRepos(args: string[]): RepoSpec[] {
  const repos: RepoSpec[] = [];

  for (const arg of args) {
    if (!arg || arg.startsWith("-")) continue;

    if (!arg.includes("/")) {
      throw new Error(`Invalid repo format: ${arg} (expected owner/repo)`);
    }

    const repo = parseRepoSpec(arg);
    repos.push(repo);
  }

  return repos;
}

export async function handleCLIMode(args: string[]): Promise<void> {
  const firstArg = args[0];

  if (firstArg === "--list" || firstArg === "-l") {
    await handleList();
  } else if (firstArg === "--resume" || firstArg === "-r") {
    const sessionName = args[1];
    if (!sessionName) {
      console.error(
        "Missing session name. Usage: letmecook --cli --resume <session-name>"
      );
      process.exit(1);
    }
    await handleResume(sessionName);
  } else if (firstArg === "--delete" || firstArg === "-d") {
    const sessionName = args[1];
    if (!sessionName) {
      console.error(
        "Missing session name. Usage: letmecook --cli --delete <session-name>"
      );
      process.exit(1);
    }
    await handleDelete(sessionName);
  } else if (firstArg === "--nuke") {
    const hasYes = args.includes("--yes") || args.includes("-y");
    await handleNuke(hasYes);
  } else if (firstArg === "--logs") {
    const secondArg = args[1];
    if (secondArg === "--view") {
      const logId = args[2];
      if (!logId) {
        console.error(
          "Missing log ID. Usage: letmecook --cli --logs --view <log-id>"
        );
        process.exit(1);
      }
      await handleChatLogView(logId);
    } else if (secondArg === "--delete") {
      const logId = args[2];
      if (!logId) {
        console.error(
          "Missing log ID. Usage: letmecook --cli --logs --delete <log-id>"
        );
        process.exit(1);
      }
      await handleChatLogDelete(logId);
    } else if (secondArg === "--nuke") {
      const hasYes = args.includes("--yes") || args.includes("-y");
      await handleChatLogsNuke(hasYes);
    } else {
      await handleChatLogsList();
    }
  } else if (!firstArg || firstArg.startsWith("-")) {
    // No args or unknown flag after --cli
    if (firstArg?.startsWith("-")) {
      console.error(`Unknown CLI option: ${firstArg}`);
    }
    printCLIUsage();
    process.exit(firstArg ? 1 : 0);
  } else {
    try {
      const repos = parseRepos(args);
      if (repos.length === 0) {
        printCLIUsage();
        process.exit(1);
      }
      await handleNewSessionCLI(repos);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}
