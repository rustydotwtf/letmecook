import { rm } from "node:fs/promises";
import { join } from "node:path";

import type { RepoSpec } from "./types";

import { readProcessOutputWithBuffer } from "./utils/stream";

export interface CloneProgress {
  repo: RepoSpec;
  status: "pending" | "cloning" | "done" | "error";
  error?: string;
  outputLines?: string[]; // Last 5 lines of git output
}

export interface RefreshResult {
  repo: RepoSpec;
  status: "updated" | "up-to-date" | "skipped" | "error";
  reason?: string;
}

export type RefreshProgressStatus =
  | "refreshing"
  | "updated"
  | "up-to-date"
  | "skipped"
  | "error";

function buildCloneArgs(
  repo: RepoSpec,
  url: string,
  targetDir: string
): string[] {
  const baseArgs = [
    "git",
    "clone",
    "--depth",
    "1",
    "--single-branch",
    "--progress",
    url,
    targetDir,
  ];
  return repo.branch
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
    : baseArgs;
}

function processStreamLines(
  buffer: string,
  addLine: (line: string) => void
): string {
  const lines = buffer.split(/[\r\n]+/);
  const remainingBuffer = lines.pop() || "";

  for (const line of lines) {
    addLine(line);
  }

  return remainingBuffer;
}

async function readStreamWithBuffer(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  initialBuffer: string,
  addLine: (line: string) => void
): Promise<void> {
  let buffer = initialBuffer;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = processStreamLines(buffer, addLine);
  }
  if (buffer.trim()) {
    addLine(buffer);
  }
}

function createAddLineCallback(
  outputBuffer: string[],
  maxLines: number,
  onProgress?: (status: CloneProgress["status"], outputLines?: string[]) => void
) {
  return (line: string) => {
    const trimmed = line.trim();
    if (trimmed) {
      outputBuffer.push(trimmed);
      if (outputBuffer.length > maxLines) {
        outputBuffer.shift();
      }
      onProgress?.("cloning", [...outputBuffer]);
    }
  };
}

async function runCloneProcess(
  repo: RepoSpec,
  sessionPath: string,
  addLine: (line: string) => void
): Promise<number> {
  const url = `https://github.com/${repo.owner}/${repo.name}.git`;
  const targetDir = join(sessionPath, repo.dir);
  const args = buildCloneArgs(repo, url, targetDir);

  const proc = Bun.spawn(args, {
    stderr: "pipe",
    stdout: "pipe",
  });

  const decoder = new TextDecoder();
  const stderrReader = proc.stderr.getReader();
  const stdoutReader = proc.stdout.getReader();

  await Promise.all([
    readStreamWithBuffer(stderrReader, decoder, "", addLine),
    readStreamWithBuffer(stdoutReader, decoder, "", addLine),
  ]);

  const exitCode = await proc.exited;
  return exitCode;
}

function handleCloneError(
  repo: RepoSpec,
  error: unknown,
  onProgress?: (status: CloneProgress["status"], outputLines?: string[]) => void
): never {
  onProgress?.("error");
  throw new Error(
    `Failed to clone ${repo.owner}/${repo.name}: ${
      error instanceof Error ? error.message : String(error)
    }`,
    { cause: error }
  );
}

async function performCloneWithExitHandling(
  repo: RepoSpec,
  sessionPath: string,
  addLine: (line: string) => void,
  outputBuffer: string[],
  onProgress?: (status: CloneProgress["status"], outputLines?: string[]) => void
): Promise<void> {
  const exitCode = await runCloneProcess(repo, sessionPath, addLine);

  if (exitCode !== 0) {
    onProgress?.("error", [...outputBuffer]);
    throw new Error(`git clone exited with code ${exitCode}`);
  }

  onProgress?.("done", [...outputBuffer]);
}

export async function cloneRepo(
  repo: RepoSpec,
  sessionPath: string,
  onProgress?: (status: CloneProgress["status"], outputLines?: string[]) => void
): Promise<void> {
  onProgress?.("cloning");
  const outputBuffer: string[] = [];
  const MAX_LINES = 5;

  try {
    const addLine = createAddLineCallback(outputBuffer, MAX_LINES, onProgress);
    await performCloneWithExitHandling(
      repo,
      sessionPath,
      addLine,
      outputBuffer,
      onProgress
    );
  } catch (error) {
    handleCloneError(repo, error, onProgress);
  }
}

export async function recloneRepo(
  repo: RepoSpec,
  sessionPath: string,
  onProgress?: (status: CloneProgress["status"], outputLines?: string[]) => void
): Promise<void> {
  const repoPath = join(sessionPath, repo.dir);

  try {
    await rm(repoPath, { force: true, recursive: true });
    await cloneRepo(repo, sessionPath, onProgress);
  } catch (error) {
    onProgress?.("error");
    throw new Error(
      `Failed to reclone ${repo.owner}/${repo.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }
}

export async function cloneAllRepos(
  repos: RepoSpec[],
  sessionPath: string,
  onProgress?: (
    repoIndex: number,
    status: CloneProgress["status"],
    outputLines?: string[]
  ) => void
): Promise<void> {
  // Clone repos in parallel
  await Promise.all(
    repos.map(async (repo, index) => {
      await cloneRepo(repo, sessionPath, (status, outputLines) => {
        onProgress?.(index, status, outputLines);
      });
    })
  );
}

export async function hasUncommittedChanges(
  repoPath: string
): Promise<boolean> {
  const proc = Bun.spawn(["git", "status", "--porcelain"], {
    cwd: repoPath,
    stderr: "pipe",
    stdout: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return output.trim().length > 0;
}

export async function sessionHasUncommittedChanges(
  repos: RepoSpec[],
  sessionPath: string
): Promise<{ hasChanges: boolean; reposWithChanges: RepoSpec[] }> {
  const results = await Promise.all(
    repos.map(async (repo) => ({
      hasChanges: await hasUncommittedChanges(join(sessionPath, repo.dir)),
      repo,
    }))
  );
  const reposWithChanges = results
    .filter((r) => r.hasChanges)
    .map((r) => r.repo);
  return { hasChanges: reposWithChanges.length > 0, reposWithChanges };
}

function handleDirtyRepo(
  repo: RepoSpec,
  repoIndex: number,
  onProgress?: (
    repoIndex: number,
    status: RefreshProgressStatus,
    outputLines?: string[]
  ) => void
): RefreshResult {
  onProgress?.(repoIndex, "skipped", ["Skipped: uncommitted changes"]);
  return {
    reason: "uncommitted changes",
    repo,
    status: "skipped",
  };
}

async function runPullAndCheckStatus(
  repoPath: string,
  repoIndex: number,
  onProgress?: (
    repoIndex: number,
    status: RefreshProgressStatus,
    outputLines?: string[]
  ) => void
): Promise<{ fullOutput: string; output: string[]; success: boolean }> {
  const proc = Bun.spawn(
    ["git", "-C", repoPath, "pull", "--ff-only", "--depth", "1"],
    {
      stderr: "pipe",
      stdout: "pipe",
    }
  );

  const { fullOutput, output, success } = await readProcessOutputWithBuffer(
    proc,
    {
      maxBufferLines: 5,
      onBufferUpdate: (buffer) => onProgress?.(repoIndex, "refreshing", buffer),
    }
  );

  return { fullOutput, output, success };
}

function determineUpdateStatus(fullOutput: string): "up-to-date" | "updated" {
  const normalized = fullOutput.toLowerCase();
  const upToDate =
    normalized.includes("already up to date") ||
    normalized.includes("already up-to-date");

  return upToDate ? "up-to-date" : "updated";
}

function handlePullError(
  repo: RepoSpec,
  fullOutput: string,
  output: string[],
  repoIndex: number,
  onProgress?: (
    repoIndex: number,
    status: RefreshProgressStatus,
    outputLines?: string[]
  ) => void
): RefreshResult {
  const reason = fullOutput.trim() || "git pull exited with code 1";
  onProgress?.(repoIndex, "error", output.length > 0 ? [...output] : [reason]);
  return {
    reason,
    repo,
    status: "error",
  };
}

function createSuccessResult(
  repo: RepoSpec,
  output: string[],
  repoIndex: number,
  onProgress?: (
    repoIndex: number,
    status: RefreshProgressStatus,
    outputLines?: string[]
  ) => void
): RefreshResult {
  const updateStatus = determineUpdateStatus(output.join("\n"));
  onProgress?.(repoIndex, updateStatus, [...output]);

  return {
    repo,
    status: updateStatus,
  };
}

async function refreshSingleRepo(
  repo: RepoSpec,
  sessionPath: string,
  repoIndex: number,
  onProgress?: (
    repoIndex: number,
    status: RefreshProgressStatus,
    outputLines?: string[]
  ) => void
): Promise<RefreshResult> {
  const repoPath = join(sessionPath, repo.dir);
  const dirty = await hasUncommittedChanges(repoPath);

  if (dirty) {
    return handleDirtyRepo(repo, repoIndex, onProgress);
  }

  onProgress?.(repoIndex, "refreshing", [
    `Pulling ${repo.owner}/${repo.name}...`,
  ]);

  const { fullOutput, output, success } = await runPullAndCheckStatus(
    repoPath,
    repoIndex,
    onProgress
  );

  if (!success) {
    return handlePullError(repo, fullOutput, output, repoIndex, onProgress);
  }

  return createSuccessResult(repo, output, repoIndex, onProgress);
}

export async function refreshLatestRepos(
  repos: RepoSpec[],
  sessionPath: string,
  onProgress?: (
    repoIndex: number,
    status: RefreshProgressStatus,
    outputLines?: string[]
  ) => void
): Promise<RefreshResult[]> {
  const readOnlyRepos = repos.filter((repo) => repo.readOnly);
  if (readOnlyRepos.length === 0) {
    return [];
  }

  const results: RefreshResult[] = [];

  for (const [repoIndex, repo] of readOnlyRepos.entries()) {
    const result = await refreshSingleRepo(
      repo,
      sessionPath,
      repoIndex,
      onProgress
    );
    results.push(result);
  }

  return results;
}
