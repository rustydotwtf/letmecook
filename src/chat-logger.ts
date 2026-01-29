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
  private attemptCounter: number = 0;

  constructor() {
    this.startTime = Date.now();
    this.log = {
      id: this.generateId(),
      startedAt: new Date().toISOString(),
      sessionCreated: false,
      messages: [],
      toolCalls: [],
      errors: [],
      configAttempts: [],
      cancelled: false,
      metadata: {
        apiKeyPresent: !!process.env.AI_GATEWAY_API_KEY,
        messageCount: 0,
        toolCallCount: 0,
        errorCount: 0,
      },
    };
  }

  private generateId(): string {
    return Date.now() + "-" + Math.random().toString(36).substring(2, 9);
  }

  addMessage(role: LoggedMessage["role"], content: string): void {
    this.log.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
    this.log.metadata.messageCount++;
  }

  addToolCall(
    toolName: string,
    input: unknown,
    output: unknown,
    durationMs: number
  ): void {
    this.log.toolCalls.push({
      toolName,
      input,
      output,
      timestamp: new Date().toISOString(),
      durationMs,
    });
    this.log.metadata.toolCallCount++;
  }

  addError(
    type: ErrorRecord["type"],
    message: string,
    details?: unknown
  ): void {
    this.log.errors.push({
      type,
      message,
      details,
      timestamp: new Date().toISOString(),
    });
    this.log.metadata.errorCount++;
  }

  addConfigAttempt(config?: unknown, success: boolean = false): void {
    this.attemptCounter++;
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

    const filename = this.log.id + ".json";
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
            id,
            filename,
            createdAt: stat.mtime.toISOString(),
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
      const filepath = join(CHAT_LOGS_DIR, id + ".json");
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
      const filepath = join(CHAT_LOGS_DIR, id + ".json");
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
          count++;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }
}
