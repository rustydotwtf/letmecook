import { rm } from "node:fs/promises";
import { join } from "node:path";

import  { type RepoSpec } from "./types";

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

export async function cloneRepo(
  repo: RepoSpec,
  sessionPath: string,
  onProgress?: (status: CloneProgress["status"], outputLines?: string[]) => void
): Promise<void> {
  const url = `https://github.com/${repo.owner}/${repo.name}.git`;
  const targetDir = join(sessionPath, repo.dir);
  onProgress?.("cloning");

  try {
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
      : [
          "git",
          "clone",
          "--depth",
          "1",
          "--single-branch",
          "--progress",
          url,
          targetDir,
        ];

    const proc = Bun.spawn(args, {
      stderr: "pipe",
      stdout: "pipe",
    });

    // Buffer to collect output lines
    const outputBuffer: string[] = [];
    const MAX_LINES = 5;

    // Helper to add line to buffer and notify
    const addLine = (line: string) => {
      const trimmed = line.trim();
      if (trimmed) {
        outputBuffer.push(trimmed);
        if (outputBuffer.length > MAX_LINES) {
          outputBuffer.shift();
        }
        onProgress?.("cloning", [...outputBuffer]);
      }
    };

    // Read stderr (git clone sends progress to stderr)
    const stderrReader = proc.stderr.getReader();
    const decoder = new TextDecoder();
    let stderrBuffer = "";

    const readStderr = async () => {
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) {break;}
        stderrBuffer += decoder.decode(value, { stream: true });

        // Process lines (split on newline or carriage return for progress updates)
        const lines = stderrBuffer.split(/[\r\n]+/);
        stderrBuffer = lines.pop() || "";

        for (const line of lines) {
          addLine(line);
        }
      }
      // Process remaining buffer
      if (stderrBuffer.trim()) {
        addLine(stderrBuffer);
      }
    };

    // Read stdout as well
    const stdoutReader = proc.stdout.getReader();
    let stdoutBuffer = "";

    const readStdout = async () => {
      while (true) {
        const { done, value } = await stdoutReader.read();
        if (done) {break;}
        stdoutBuffer += decoder.decode(value, { stream: true });

        const lines = stdoutBuffer.split(/[\r\n]+/);
        stdoutBuffer = lines.pop() || "";

        for (const line of lines) {
          addLine(line);
        }
      }
      if (stdoutBuffer.trim()) {
        addLine(stdoutBuffer);
      }
    };

    // Read both streams and wait for process
    await Promise.all([readStderr(), readStdout()]);
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      onProgress?.("error", [...outputBuffer]);
      throw new Error(`git clone exited with code ${exitCode}`);
    }

    onProgress?.("done", [...outputBuffer]);
  } catch (error) {
    onProgress?.("error");
    throw new Error(
      `Failed to clone ${repo.owner}/${repo.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
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
  if (readOnlyRepos.length === 0) {return [];}

  const results: RefreshResult[] = [];

  for (const [repoIndex, repo] of readOnlyRepos.entries()) {
    const repoPath = join(sessionPath, repo.dir);
    const dirty = await hasUncommittedChanges(repoPath);

    if (dirty) {
      results.push({
        reason: "uncommitted changes",
        repo,
        status: "skipped",
      });
      onProgress?.(repoIndex, "skipped", ["Skipped: uncommitted changes"]);
      continue;
    }

    onProgress?.(repoIndex, "refreshing", [
      `Pulling ${repo.owner}/${repo.name}...`,
    ]);

    const proc = Bun.spawn(
      ["git", "-C", repoPath, "pull", "--ff-only", "--depth", "1"],
      {
        stderr: "pipe",
        stdout: "pipe",
      }
    );

    const { success, output, fullOutput } = await readProcessOutputWithBuffer(
      proc,
      {
        maxBufferLines: 5,
        onBufferUpdate: (buffer) =>
          onProgress?.(repoIndex, "refreshing", buffer),
      }
    );
    const exitCode = success ? 0 : 1;

    if (exitCode !== 0) {
      const reason =
        fullOutput.trim() || `git pull exited with code ${exitCode}`;
      results.push({
        reason,
        repo,
        status: "error",
      });
      onProgress?.(
        repoIndex,
        "error",
        output.length > 0 ? [...output] : [reason]
      );
      continue;
    }

    const normalized = fullOutput.toLowerCase();
    const upToDate =
      normalized.includes("already up to date") ||
      normalized.includes("already up-to-date");

    results.push({
      repo,
      status: upToDate ? "up-to-date" : "updated",
    });
    onProgress?.(repoIndex, upToDate ? "up-to-date" : "updated", [...output]);
  }

  return results;
}
