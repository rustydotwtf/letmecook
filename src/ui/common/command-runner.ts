import { type CliRenderer, TextRenderable, type Renderable, type KeyEvent } from "@opentui/core";
import { createBaseLayout, clearLayout } from "../renderer";
import { readProcessOutputWithControl } from "../../utils/stream";
import { showFooter, hideFooter } from "./footer";
import { isAbort, isSkip, isBackground } from "./keyboard";
import { registerBackgroundProcess } from "../../process-registry";

export interface CommandTask {
  label: string; // "Cloning microsoft/playwright"
  command: string[]; // ["git", "clone", "https://..."]
  cwd?: string; // Working directory
}

export interface CommandRunnerOptions {
  title: string; // "Setting up session"
  tasks: CommandTask[]; // Array of commands to run
  showOutput?: boolean; // Show last N lines (default: true)
  outputLines?: number; // How many lines to show (default: 5)
  allowAbort?: boolean; // Show 'a' Abort
  allowSkip?: boolean; // Show 's' Skip (multi-task only)
  allowBackground?: boolean; // Show 'b' Background
  sessionName?: string; // Session name for tracking backgrounded processes
}

export type TaskOutcome = "completed" | "error" | "aborted" | "skipped" | "backgrounded";

export interface CommandResult {
  task: CommandTask;
  success: boolean;
  exitCode: number;
  output: string[];
  error?: string;
  outcome: TaskOutcome;
}

let taskTexts: TextRenderable[] = [];
let currentCommandText: TextRenderable | null = null;
let outputText: TextRenderable | null = null;
let tasksLabel: TextRenderable | null = null;

export type TaskStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "aborted"
  | "skipped"
  | "backgrounded";

function getStatusIcon(status: TaskStatus): {
  icon: string;
  color: string;
} {
  switch (status) {
    case "done":
      return { icon: "[✓]", color: "#22c55e" };
    case "running":
      return { icon: "[~]", color: "#fbbf24" };
    case "error":
      return { icon: "[✗]", color: "#ef4444" };
    case "aborted":
      return { icon: "[X]", color: "#ef4444" };
    case "skipped":
      return { icon: "[>]", color: "#f59e0b" };
    case "backgrounded":
      return { icon: "[~]", color: "#38bdf8" };
    case "pending":
    default:
      return { icon: "[ ]", color: "#94a3b8" };
  }
}

export function showCommandRunner(
  renderer: CliRenderer,
  options: CommandRunnerOptions,
): {
  taskStatuses: Array<{ task: CommandTask; status: TaskStatus }>;
  content: Renderable;
} {
  clearLayout(renderer);
  taskTexts = [];

  const { title, tasks, showOutput = true } = options;

  const { content } = createBaseLayout(renderer, title);

  tasksLabel = new TextRenderable(renderer, {
    id: "tasks-label",
    content: "Tasks",
    fg: "#e2e8f0",
    marginTop: 1,
    marginBottom: 1,
  });
  content.add(tasksLabel);

  const taskStatuses = tasks.map((task) => ({ task, status: "pending" as const }));

  tasks.forEach((task, i) => {
    const statusIcon = getStatusIcon("pending");
    const taskText = new TextRenderable(renderer, {
      id: `task-${i}`,
      content: `${statusIcon.icon} ${task.label}`,
      fg: statusIcon.color,
    });
    content.add(taskText);
    taskTexts.push(taskText);
  });

  if (showOutput) {
    currentCommandText = new TextRenderable(renderer, {
      id: "current-command",
      content: "",
      fg: "#64748b",
      marginTop: 2,
    });
    content.add(currentCommandText);

    const separator = new TextRenderable(renderer, {
      id: "output-separator",
      content: "──────────────────────────────────────",
      fg: "#475569",
      marginTop: 0,
    });
    content.add(separator);

    outputText = new TextRenderable(renderer, {
      id: "command-output",
      content: "",
      fg: "#64748b",
      marginTop: 0,
    });
    content.add(outputText);
  }

  return { taskStatuses, content };
}

export function updateCommandRunner(
  renderer: CliRenderer,
  taskStatuses: Array<{ task: CommandTask; status: TaskStatus }>,
  currentTaskIndex?: number,
  outputLines?: string[],
): void {
  taskStatuses.forEach((item, i) => {
    const text = taskTexts[i];
    if (text) {
      const statusIcon = getStatusIcon(item.status);
      text.content = `${statusIcon.icon} ${item.task.label}`;
      text.fg = statusIcon.color;
    }
  });

  if (currentCommandText && currentTaskIndex !== undefined && currentTaskIndex >= 0) {
    const currentTask = taskStatuses[currentTaskIndex];
    if (currentTask) {
      const commandStr = currentTask.task.command.join(" ");
      currentCommandText.content = `Running: ${commandStr}`;
      currentCommandText.fg = "#38bdf8";
    }
  }

  if (outputText && outputLines && outputLines.length > 0) {
    outputText.content = outputLines.map((line) => `  ${line}`).join("\n");
  } else if (outputText) {
    outputText.content = "";
  }

  renderer.requestRender();
}

export function hideCommandRunner(renderer: CliRenderer): void {
  hideFooter(renderer);
  clearLayout(renderer);
  taskTexts = [];
  currentCommandText = null;
  outputText = null;
  tasksLabel = null;
}

type ControlAction = "abort" | "skip" | "background" | null;

export async function runCommands(
  renderer: CliRenderer,
  options: CommandRunnerOptions,
): Promise<CommandResult[]> {
  const {
    tasks,
    showOutput = true,
    outputLines = 5,
    allowAbort = false,
    allowSkip = false,
    allowBackground = false,
    sessionName,
  } = options;

  const { taskStatuses, content } = showCommandRunner(renderer, options);
  const results: CommandResult[] = [];

  // Track control state
  let controlAction: ControlAction = null;
  let abortAll = false;
  let currentProc: ReturnType<typeof Bun.spawn> | null = null;
  let backgroundResolve: (() => void) | null = null;

  // Build footer hints
  const footerHints: string[] = [];
  if (allowAbort) {
    footerHints.push(tasks.length > 1 ? "a Abort All" : "a Abort");
  }
  if (allowSkip && tasks.length > 1) {
    footerHints.push("s Skip");
  }
  if (allowBackground) {
    footerHints.push("b Background");
  }

  // Show footer with control options
  if (footerHints.length > 0) {
    showFooter(renderer, content, {
      navigate: false,
      select: false,
      back: false,
      custom: footerHints,
    });
    renderer.requestRender();
  }

  // Set up keyboard listener
  const keyHandler = (key: KeyEvent) => {
    if (allowAbort && isAbort(key)) {
      controlAction = "abort";
      abortAll = true;
      if (currentProc) {
        currentProc.kill("SIGTERM");
      }
    } else if (allowSkip && tasks.length > 1 && isSkip(key)) {
      controlAction = "skip";
      if (currentProc) {
        currentProc.kill("SIGTERM");
      }
    } else if (allowBackground && isBackground(key)) {
      controlAction = "background";
      // Don't kill - just detach, but signal to move on
      if (backgroundResolve) {
        backgroundResolve();
        backgroundResolve = null;
      }
    }
  };

  // Subscribe to keyboard events via renderer's keyInput
  if (footerHints.length > 0) {
    renderer.keyInput.on("keypress", keyHandler);
  }

  try {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskState = taskStatuses[i];

      if (!task || !taskState) continue;

      // If abort all was triggered, mark remaining tasks as aborted
      if (abortAll) {
        taskState.status = "aborted";
        results.push({
          task,
          success: false,
          exitCode: -1,
          output: [],
          outcome: "aborted",
        });
        updateCommandRunner(renderer, taskStatuses, i, []);
        continue;
      }

      // Reset control action for this task
      controlAction = null;

      // Update status to running
      taskState.status = "running";
      updateCommandRunner(renderer, taskStatuses, i, []);

      try {
        const proc = Bun.spawn(task.command, {
          cwd: task.cwd,
          stdout: "pipe",
          stderr: "pipe",
        });
        currentProc = proc;

        let outputBuffer: string[] = [];

        // Create a promise that resolves when background is requested
        const backgroundPromise = new Promise<"background">((resolve) => {
          backgroundResolve = () => resolve("background");
        });

        // Race between normal completion and background request
        const streamPromise = readProcessOutputWithControl(proc, {
          maxBufferLines: outputLines,
          onBufferUpdate: (buffer) => {
            outputBuffer = buffer;
            if (showOutput) {
              updateCommandRunner(renderer, taskStatuses, i, buffer);
            }
          },
          shouldStop: () => controlAction !== null && controlAction !== "background",
        });

        const raceResult = await Promise.race([
          streamPromise.then((r) => ({ type: "stream" as const, ...r })),
          backgroundPromise.then(() => ({ type: "background" as const })),
        ]);

        backgroundResolve = null;
        currentProc = null;

        // Extract stream result or create default for background
        const { success, output, fullOutput, wasInterrupted } =
          raceResult.type === "stream"
            ? raceResult
            : { success: true, output: outputBuffer, fullOutput: "", wasInterrupted: false };

        // Handle control actions
        if (controlAction === "abort" || abortAll) {
          taskState.status = "aborted";
          results.push({
            task,
            success: false,
            exitCode: -1,
            output: outputBuffer.length > 0 ? outputBuffer : output,
            outcome: "aborted",
          });
          // abortAll is already set, remaining tasks will be marked as aborted
        } else if (controlAction === "skip") {
          taskState.status = "skipped";
          results.push({
            task,
            success: false,
            exitCode: -1,
            output: outputBuffer.length > 0 ? outputBuffer : output,
            outcome: "skipped",
          });
        } else if (controlAction === "background") {
          taskState.status = "backgrounded";

          // Register the background process for tracking
          if (proc.pid && sessionName) {
            await registerBackgroundProcess(
              proc.pid,
              task.command.join(" "),
              task.label,
              sessionName,
            );
          }

          results.push({
            task,
            success: true, // Consider backgrounded as success for flow purposes
            exitCode: 0,
            output: outputBuffer.length > 0 ? outputBuffer : output,
            outcome: "backgrounded",
          });
        } else if (wasInterrupted) {
          // Was interrupted but no specific action (shouldn't happen)
          taskState.status = "error";
          results.push({
            task,
            success: false,
            exitCode: -1,
            output: outputBuffer.length > 0 ? outputBuffer : output,
            error: "Command was interrupted",
            outcome: "error",
          });
        } else {
          // Normal completion
          const exitCode = await proc.exited;

          if (success && exitCode === 0) {
            taskState.status = "done";
            results.push({
              task,
              success: true,
              exitCode: 0,
              output: outputBuffer.length > 0 ? outputBuffer : output,
              outcome: "completed",
            });
          } else {
            taskState.status = "error";
            const errorMsg = fullOutput.trim() || `Command exited with code ${exitCode}`;
            results.push({
              task,
              success: false,
              exitCode,
              output: outputBuffer.length > 0 ? outputBuffer : output,
              error: errorMsg,
              outcome: "error",
            });
          }
        }

        // Final update with last output
        if (showOutput) {
          updateCommandRunner(
            renderer,
            taskStatuses,
            i,
            outputBuffer.length > 0 ? outputBuffer : output,
          );
        } else {
          updateCommandRunner(renderer, taskStatuses, i);
        }
      } catch (error) {
        currentProc = null;
        taskState.status = "error";
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          task,
          success: false,
          exitCode: 1,
          output: [],
          error: errorMsg,
          outcome: "error",
        });

        if (showOutput) {
          updateCommandRunner(renderer, taskStatuses, i, [errorMsg]);
        } else {
          updateCommandRunner(renderer, taskStatuses, i);
        }
      }
    }
  } finally {
    // Clean up keyboard listener
    if (footerHints.length > 0) {
      renderer.keyInput.off("keypress", keyHandler);
    }
  }

  // Clear current command indicator when done
  if (currentCommandText) {
    currentCommandText.content = "";
  }

  // Hide footer
  hideFooter(renderer);

  return results;
}
