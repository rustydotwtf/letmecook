import {
  type CliRenderer,
  TextRenderable,
  type Renderable,
  type KeyEvent,
} from "@opentui/core";

import { registerBackgroundProcess } from "../../process-registry";
import { readProcessOutputWithControl } from "../../utils/stream";
import { createBaseLayout, clearLayout } from "../renderer";
import { showFooter, hideFooter } from "./footer";
import { isAbort, isSkip, isBackground } from "./keyboard";

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

export type TaskOutcome =
  | "completed"
  | "error"
  | "aborted"
  | "skipped"
  | "backgrounded";

export interface CommandResult {
  task: CommandTask;
  success: boolean;
  exitCode: number;
  output: string[];
  error?: string;
  outcome: TaskOutcome;
}

// eslint-disable-next-line jest/require-hook -- Module-level state, not test hooks
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
    case "done": {
      return { color: "#22c55e", icon: "[✓]" };
    }
    case "running": {
      return { color: "#fbbf24", icon: "[~]" };
    }
    case "error": {
      return { color: "#ef4444", icon: "[✗]" };
    }
    case "aborted": {
      return { color: "#ef4444", icon: "[X]" };
    }
    case "skipped": {
      return { color: "#f59e0b", icon: "[>]" };
    }
    case "backgrounded": {
      return { color: "#38bdf8", icon: "[~]" };
    }
    default: {
      return { color: "#94a3b8", icon: "[ ]" };
    }
  }
}

function createTasksLabel(renderer: CliRenderer, content: Renderable): void {
  tasksLabel = new TextRenderable(renderer, {
    content: "Tasks",
    fg: "#e2e8f0",
    id: "tasks-label",
    marginBottom: 1,
    marginTop: 1,
  });
  content.add(tasksLabel);
}

function createTaskTexts(
  renderer: CliRenderer,
  content: Renderable,
  tasks: CommandTask[]
): void {
  for (const [i, task] of tasks.entries()) {
    const statusIcon = getStatusIcon("pending");
    const taskText = new TextRenderable(renderer, {
      content: `${statusIcon.icon} ${task.label}`,
      fg: statusIcon.color,
      id: `task-${i}`,
    });
    content.add(taskText);
    taskTexts.push(taskText);
  }
}

function createOutputSection(renderer: CliRenderer, content: Renderable): void {
  currentCommandText = new TextRenderable(renderer, {
    content: "",
    fg: "#64748b",
    id: "current-command",
    marginTop: 2,
  });
  content.add(currentCommandText);

  const separator = new TextRenderable(renderer, {
    content: "──────────────────────────────────────",
    fg: "#475569",
    id: "output-separator",
    marginTop: 0,
  });
  content.add(separator);

  outputText = new TextRenderable(renderer, {
    content: "",
    fg: "#64748b",
    id: "command-output",
    marginTop: 0,
  });
  content.add(outputText);
}

export function showCommandRunner(
  renderer: CliRenderer,
  options: CommandRunnerOptions
): {
  taskStatuses: { task: CommandTask; status: TaskStatus }[];
  content: Renderable;
} {
  clearLayout(renderer);
  taskTexts = [];

  const { title, tasks, showOutput = true } = options;

  const { content } = createBaseLayout(renderer, title);
  createTasksLabel(renderer, content);

  const taskStatuses = tasks.map((task) => ({
    status: "pending" as const,
    task,
  }));

  createTaskTexts(renderer, content, tasks);

  if (showOutput) {
    createOutputSection(renderer, content);
  }

  return { content, taskStatuses };
}

function updateTaskTexts(
  taskStatuses: { task: CommandTask; status: TaskStatus }[]
): void {
  for (const [i, item] of taskStatuses.entries()) {
    const text = taskTexts[i];
    if (text) {
      const statusIcon = getStatusIcon(item.status);
      text.content = `${statusIcon.icon} ${item.task.label}`;
      text.fg = statusIcon.color;
    }
  }
}

function updateCurrentCommand(
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  currentTaskIndex?: number
): void {
  if (
    currentCommandText &&
    currentTaskIndex !== undefined &&
    currentTaskIndex >= 0
  ) {
    const currentTask = taskStatuses[currentTaskIndex];
    if (currentTask) {
      const commandStr = currentTask.task.command.join(" ");
      currentCommandText.content = `Running: ${commandStr}`;
      currentCommandText.fg = "#38bdf8";
    }
  }
}

function updateOutputText(outputLines?: string[]): void {
  if (outputText && outputLines && outputLines.length > 0) {
    outputText.content = outputLines.map((line) => `  ${line}`).join("\n");
  } else if (outputText) {
    outputText.content = "";
  }
}

export function updateCommandRunner(
  renderer: CliRenderer,
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  currentTaskIndex?: number,
  outputLines?: string[]
): void {
  updateTaskTexts(taskStatuses);
  updateCurrentCommand(taskStatuses, currentTaskIndex);
  updateOutputText(outputLines);
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

interface CommandRunnerState {
  controlAction: ControlAction;
  abortAll: boolean;
  currentProc: ReturnType<typeof Bun.spawn> | null;
  backgroundResolve: (() => void) | null;
}

function buildFooterHints(options: CommandRunnerOptions): string[] {
  const hints: string[] = [];
  addAbortHint(options, hints);
  addSkipHint(options, hints);
  addBackgroundHint(options, hints);
  return hints;
}

function addAbortHint(options: CommandRunnerOptions, hints: string[]): void {
  if (!options.allowAbort) {
    return;
  }
  hints.push(options.tasks.length > 1 ? "a Abort All" : "a Abort");
}

function addSkipHint(options: CommandRunnerOptions, hints: string[]): void {
  if (options.allowSkip && options.tasks.length > 1) {
    hints.push("s Skip");
  }
}

function addBackgroundHint(
  options: CommandRunnerOptions,
  hints: string[]
): void {
  if (options.allowBackground) {
    hints.push("b Background");
  }
}

function createKeyHandler(
  state: CommandRunnerState,
  options: CommandRunnerOptions
): (key: KeyEvent) => void {
  return (key: KeyEvent) => {
    const { allowAbort, allowSkip, allowBackground, tasks } = options;

    if (allowAbort && isAbort(key)) {
      handleAbortKey(state);
    } else if (allowSkip && tasks.length > 1 && isSkip(key)) {
      handleSkipKey(state);
    } else if (allowBackground && isBackground(key)) {
      handleBackgroundKey(state);
    }
  };
}

function handleAbortKey(state: CommandRunnerState): void {
  state.controlAction = "abort";
  state.abortAll = true;
  if (state.currentProc) {
    state.currentProc.kill("SIGTERM");
  }
}

function handleSkipKey(state: CommandRunnerState): void {
  state.controlAction = "skip";
  if (state.currentProc) {
    state.currentProc.kill("SIGTERM");
  }
}

function handleBackgroundKey(state: CommandRunnerState): void {
  state.controlAction = "background";
  if (state.backgroundResolve) {
    state.backgroundResolve();
    state.backgroundResolve = null;
  }
}

function handleAbortResult(
  task: CommandTask,
  outputBuffer: string[],
  output: string[]
): CommandResult {
  return {
    exitCode: -1,
    outcome: "aborted",
    output: outputBuffer.length > 0 ? outputBuffer : output,
    success: false,
    task,
  };
}

function handleSkipResult(
  task: CommandTask,
  outputBuffer: string[],
  output: string[]
): CommandResult {
  return {
    exitCode: -1,
    outcome: "skipped",
    output: outputBuffer.length > 0 ? outputBuffer : output,
    success: false,
    task,
  };
}

function handleBackgroundResult(
  task: CommandTask,
  _proc: ReturnType<typeof Bun.spawn>,
  _sessionName: string | undefined,
  outputBuffer: string[],
  output: string[]
): CommandResult {
  return {
    exitCode: 0,
    outcome: "backgrounded",
    output: outputBuffer.length > 0 ? outputBuffer : output,
    success: true,
    task,
  };
}

function handleCompletedResult(
  task: CommandTask,
  exitCode: number,
  outputBuffer: string[],
  output: string[],
  fullOutput: string
): CommandResult {
  return {
    exitCode,
    outcome: exitCode === 0 ? "completed" : "error",
    output: outputBuffer.length > 0 ? outputBuffer : output,
    success: exitCode === 0,
    task,
    ...(exitCode !== 0 && {
      error: fullOutput.trim() || `Command exited with code ${exitCode}`,
    }),
  };
}

function handleErrorResult(task: CommandTask, error: unknown): CommandResult {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return {
    error: errorMsg,
    exitCode: 1,
    outcome: "error",
    output: [],
    success: false,
    task,
  };
}

function processTaskResult(
  task: CommandTask,
  taskState: { status: TaskStatus },
  outcome: CommandResult,
  controlAction: ControlAction,
  _abortAll: boolean
): void {
  switch (controlAction) {
    case "abort": {
      taskState.status = "aborted";
      break;
    }
    case "skip": {
      taskState.status = "skipped";
      break;
    }
    case "background": {
      taskState.status = "backgrounded";
      break;
    }
    default: {
      taskState.status = outcome.success ? "done" : "error";
    }
  }
}

interface TaskExecutionResult {
  result: CommandResult;
  outputBuffer: string[];
  output: string[];
}

async function executeTask(
  renderer: CliRenderer,
  task: CommandTask,
  taskState: { status: TaskStatus },
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  taskIndex: number,
  outputLines: number,
  showOutput: boolean,
  sessionName: string | undefined,
  state: CommandRunnerState
): Promise<TaskExecutionResult> {
  taskState.status = "running";
  updateCommandRunner(renderer, taskStatuses, taskIndex, []);

  const proc = spawnProcess(task, state);
  const outputBuffer: string[] = [];

  const raceResult = await raceTaskCompletion(
    renderer,
    proc,
    outputBuffer,
    taskStatuses,
    taskIndex,
    outputLines,
    showOutput,
    state
  );

  state.backgroundResolve = null;
  state.currentProc = null;

  const { success, output, fullOutput, wasInterrupted } = extractStreamResult(
    raceResult,
    outputBuffer
  );

  const result = await determineTaskResult(
    task,
    proc,
    sessionName,
    state,
    success,
    output,
    outputBuffer,
    fullOutput,
    wasInterrupted
  );

  return { output, outputBuffer, result };
}

async function raceTaskCompletion(
  renderer: CliRenderer,
  proc: ReturnType<typeof Bun.spawn>,
  outputBuffer: string[],
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  taskIndex: number,
  outputLines: number,
  showOutput: boolean,
  state: CommandRunnerState
) {
  const backgroundPromise = createBackgroundPromise(state);
  const streamPromise = createStreamPromise(
    renderer,
    proc,
    outputBuffer,
    taskStatuses,
    taskIndex,
    outputLines,
    showOutput,
    state
  );

  return await Promise.race([
    streamPromise.then((r) => ({ type: "stream" as const, ...r })),
    backgroundPromise.then(() => ({ type: "background" as const })),
  ]);
}

function spawnProcess(
  task: CommandTask,
  state: CommandRunnerState
): ReturnType<typeof Bun.spawn> {
  const proc = Bun.spawn(task.command, {
    cwd: task.cwd,
    stderr: "pipe",
    stdout: "pipe",
  });
  state.currentProc = proc;
  return proc;
}

function createBackgroundPromise(
  state: CommandRunnerState
): Promise<"background"> {
  return new Promise<"background">((resolve) => {
    // eslint-disable-next-line promise/avoid-new -- Needed for external resolve pattern
    state.backgroundResolve = () => resolve("background");
  });
}

function createStreamPromise(
  renderer: CliRenderer,
  proc: ReturnType<typeof Bun.spawn>,
  outputBuffer: string[],
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  taskIndex: number,
  outputLines: number,
  showOutput: boolean,
  state: CommandRunnerState
) {
  return readProcessOutputWithControl(proc, {
    maxBufferLines: outputLines,
    onBufferUpdate: (buffer) => {
      outputBuffer.push(...buffer);
      if (showOutput) {
        updateCommandRunner(renderer, taskStatuses, taskIndex, buffer);
      }
    },
    shouldStop: () =>
      state.controlAction !== null && state.controlAction !== "background",
  });
}

function extractStreamResult(
  raceResult: { type: string } & Record<string, unknown>,
  outputBuffer: string[]
): {
  success: boolean;
  output: string[];
  fullOutput: string;
  wasInterrupted: boolean;
} {
  if (raceResult.type === "stream") {
    const rr = raceResult as unknown as {
      success: boolean;
      output: string[];
      fullOutput: string;
      wasInterrupted: boolean;
    };
    return {
      fullOutput: rr.fullOutput,
      output: rr.output,
      success: rr.success,
      wasInterrupted: rr.wasInterrupted,
    };
  }
  return {
    fullOutput: "",
    output: outputBuffer,
    success: true,
    wasInterrupted: false,
  };
}

async function determineTaskResult(
  task: CommandTask,
  proc: ReturnType<typeof Bun.spawn>,
  sessionName: string | undefined,
  state: CommandRunnerState,
  _success: boolean,
  output: string[],
  outputBuffer: string[],
  fullOutput: string,
  _wasInterrupted: boolean
): Promise<CommandResult> {
  if (state.controlAction === "abort" || state.abortAll) {
    return handleAbortResult(task, outputBuffer, output);
  }
  if (state.controlAction === "skip") {
    return handleSkipResult(task, outputBuffer, output);
  }
  if (state.controlAction === "background") {
    if (proc.pid && sessionName) {
      await registerBackgroundProcess(
        proc.pid,
        task.command.join(" "),
        task.label,
        sessionName
      );
    }
    return handleBackgroundResult(
      task,
      proc,
      sessionName,
      outputBuffer,
      output
    );
  }
  const exitCode = await proc.exited;
  return handleCompletedResult(
    task,
    exitCode,
    outputBuffer,
    output,
    fullOutput
  );
}

export async function runCommands(
  renderer: CliRenderer,
  options: CommandRunnerOptions
): Promise<CommandResult[]> {
  const { tasks, showOutput = true, outputLines = 5, sessionName } = options;

  const { taskStatuses, content } = showCommandRunner(renderer, options);
  const state: CommandRunnerState = {
    abortAll: false,
    backgroundResolve: null,
    controlAction: null,
    currentProc: null,
  };

  const footerHints = buildFooterHints(options);
  const keyHandler = createKeyHandler(state, options);

  setupCommandRunnerUI(renderer, content, footerHints, keyHandler);

  try {
    const results = await executeTasks(
      renderer,
      tasks,
      taskStatuses,
      outputLines,
      showOutput,
      sessionName,
      state
    );
    return results;
  } finally {
    cleanupCommandRunner(renderer, footerHints, keyHandler);
  }
}

function setupCommandRunnerUI(
  renderer: CliRenderer,
  content: Renderable,
  footerHints: string[],
  keyHandler: (key: KeyEvent) => void
): void {
  if (footerHints.length > 0) {
    showFooter(renderer, content, {
      back: false,
      custom: footerHints,
      navigate: false,
      select: false,
    });
    renderer.requestRender();
    renderer.keyInput.on("keypress", keyHandler);
  }
}

function cleanupCommandRunner(
  renderer: CliRenderer,
  footerHints: string[],
  keyHandler: (key: KeyEvent) => void
): void {
  if (footerHints.length > 0) {
    renderer.keyInput.off("keypress", keyHandler);
  }
  if (currentCommandText) {
    currentCommandText.content = "";
  }
  hideFooter(renderer);
}

async function executeTasks(
  renderer: CliRenderer,
  tasks: CommandTask[],
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  outputLines: number,
  showOutput: boolean,
  sessionName: string | undefined,
  state: CommandRunnerState
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];

  for (let i = 0; i < tasks.length; i += 1) {
    const result = await processTaskAtIndex(
      renderer,
      tasks,
      taskStatuses,
      i,
      outputLines,
      showOutput,
      sessionName,
      state,
      results
    );
    if (result) {
      results.push(result);
    }
  }

  return results;
}

async function processTaskAtIndex(
  renderer: CliRenderer,
  tasks: CommandTask[],
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  index: number,
  outputLines: number,
  showOutput: boolean,
  sessionName: string | undefined,
  state: CommandRunnerState,
  _results: CommandResult[]
): Promise<CommandResult | null> {
  const task = tasks[index];
  const taskState = taskStatuses[index];

  if (!task || !taskState) {
    return null;
  }

  if (state.abortAll) {
    markTaskAsAborted(renderer, task, taskState, taskStatuses, index);
    return handleAbortedResult(task);
  }

  state.controlAction = null;

  return await executeSingleTask(
    renderer,
    task,
    taskState,
    taskStatuses,
    index,
    outputLines,
    showOutput,
    sessionName,
    state
  );
}

function markTaskAsAborted(
  renderer: CliRenderer,
  task: CommandTask,
  taskState: { status: TaskStatus },
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  index: number
): void {
  taskState.status = "aborted";
  updateCommandRunner(renderer, taskStatuses, index, []);
}

function handleAbortedResult(task: CommandTask): CommandResult {
  return {
    exitCode: -1,
    outcome: "aborted",
    output: [],
    success: false,
    task,
  };
}

async function executeSingleTask(
  renderer: CliRenderer,
  task: CommandTask,
  taskState: { status: TaskStatus },
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  taskIndex: number,
  outputLines: number,
  showOutput: boolean,
  sessionName: string | undefined,
  state: CommandRunnerState
): Promise<CommandResult> {
  try {
    const { result, outputBuffer, output } = await executeTask(
      renderer,
      task,
      taskState,
      taskStatuses,
      taskIndex,
      outputLines,
      showOutput,
      sessionName,
      state
    );

    processTaskResult(
      task,
      taskState,
      result,
      state.controlAction,
      state.abortAll
    );

    updateTaskOutput(
      renderer,
      taskStatuses,
      taskIndex,
      showOutput,
      outputBuffer,
      output
    );

    return result;
  } catch (error) {
    taskState.status = "error";
    const result = handleErrorResult(task, error);
    updateCommandRunner(renderer, taskStatuses, taskIndex, [
      result.error ?? "",
    ]);
    return result;
  }
}

function updateTaskOutput(
  renderer: CliRenderer,
  taskStatuses: { task: CommandTask; status: TaskStatus }[],
  taskIndex: number,
  showOutput: boolean,
  outputBuffer: string[],
  output: string[]
): void {
  if (showOutput) {
    updateCommandRunner(
      renderer,
      taskStatuses,
      taskIndex,
      outputBuffer.length > 0 ? outputBuffer : output
    );
  } else {
    updateCommandRunner(renderer, taskStatuses, taskIndex);
  }
}
