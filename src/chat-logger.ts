import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const LETMECOOK_DIR = join(homedir(), ".letmecook");
const CHAT_LOGS_DIR = join(LETMECOOK_DIR, "chat-logs");

export interface LoggedMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
}

export interface ToolCall {
  toolName: string;
  input: unknown;
  output: unknown;
  timestamp: string;
  durationMs: number;
}

export interface ErrorRecord {
  type: "validation" | "parse" | "llm" | "tool";
  message: string;
  details?: unknown;
  timestamp: string;
}

export interface ConfigAttempt {
  attempt: number;
  config?: unknown;
  success: boolean;
  timestamp: string;
}

export interface ChatLog {
  id: string;
  startedAt: string;
  endedAt?: string;
  sessionCreated: boolean;
  sessionName?: string;
  messages: LoggedMessage[];
  toolCalls: ToolCall[];
  errors: ErrorRecord[];
  configAttempts: ConfigAttempt[];
  finalConfig?: {
    repos: string[];
    skills: string[];
    goal: string;
  };
  cancelled: boolean;
  metadata: {
    apiKeyPresent: boolean;
    messageCount: number;
    toolCallCount: number;
    errorCount: number;
    durationMs?: number;
  };
}

export class ChatLogger {
  private log: ChatLog;
  private startTime: number;
  private attemptCounter = 0;

  constructor() {
    this.startTime = Date.now();
    this.log = {
      cancelled: false,
      configAttempts: [],
      errors: [],
      id: ChatLogger.generateId(),
      messages: [],
      metadata: {
        apiKeyPresent: !!process.env.AI_GATEWAY_API_KEY,
        errorCount: 0,
        messageCount: 0,
        toolCallCount: 0,
      },
      sessionCreated: false,
      startedAt: new Date().toISOString(),
      toolCalls: [],
    };
  }

  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  addMessage(role: LoggedMessage["role"], content: string): void {
    this.log.messages.push({
      content,
      role,
      timestamp: new Date().toISOString(),
    });
    this.log.metadata.messageCount += 1;
  }

  addToolCall(
    toolName: string,
    input: unknown,
    output: unknown,
    durationMs: number
  ): void {
    this.log.toolCalls.push({
      durationMs,
      input,
      output,
      timestamp: new Date().toISOString(),
      toolName,
    });
    this.log.metadata.toolCallCount += 1;
  }

  addError(
    type: ErrorRecord["type"],
    message: string,
    details?: unknown
  ): void {
    this.log.errors.push({
      details,
      message,
      timestamp: new Date().toISOString(),
      type,
    });
    this.log.metadata.errorCount += 1;
  }

  addConfigAttempt(config?: unknown, success = false): void {
    this.attemptCounter += 1;
    this.log.configAttempts.push({
      attempt: this.attemptCounter,
      config,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  markSessionCreated(
    sessionName: string,
    finalConfig: ChatLog["finalConfig"]
  ): void {
    this.log.sessionCreated = true;
    this.log.sessionName = sessionName;
    this.log.finalConfig = finalConfig;
  }

  markCancelled(): void {
    this.log.cancelled = true;
  }

  async save(): Promise<string> {
    this.log.endedAt = new Date().toISOString();
    this.log.metadata.durationMs = Date.now() - this.startTime;

    await mkdir(CHAT_LOGS_DIR, { recursive: true });

    const filename = `${this.log.id}.json`;
    const filepath = join(CHAT_LOGS_DIR, filename);

    await Bun.write(filepath, JSON.stringify(this.log, null, 2));

    return filepath;
  }

  getLog(): ChatLog {
    return this.log;
  }

  static async listLogs(): Promise<
    { id: string; filename: string; createdAt: string }[]
  > {
    try {
      const entries = await readdir(CHAT_LOGS_DIR);
      const logs: { id: string; filename: string; createdAt: string }[] = [];

      for (const filename of entries) {
        if (filename.endsWith(".json")) {
          const id = filename.replace(".json", "");
          const stat = await Bun.file(join(CHAT_LOGS_DIR, filename)).stat();
          logs.push({
            createdAt: stat.mtime.toISOString(),
            filename,
            id,
          });
        }
      }

      return logs.toSorted(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  static async getLog(id: string): Promise<ChatLog | null> {
    try {
      const filepath = join(CHAT_LOGS_DIR, `${id}.json`);
      const file = Bun.file(filepath);
      if (await file.exists()) {
        return await file.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  static async deleteLog(id: string): Promise<boolean> {
    try {
      const filepath = join(CHAT_LOGS_DIR, `${id}.json`);
      await rm(filepath);
      return true;
    } catch {
      return false;
    }
  }

  static async deleteAllLogs(): Promise<number> {
    try {
      const logs = await ChatLogger.listLogs();
      let count = 0;
      for (const log of logs) {
        if (await ChatLogger.deleteLog(log.id)) {
          count += 1;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }
}
