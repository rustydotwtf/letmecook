import { $ } from "bun";
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Project root is two levels up from tests/integration/
const PROJECT_ROOT = resolve(import.meta.dir, "../..");

// Use a temporary directory for test sessions to avoid affecting real data
let testDir: string;

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), "letmecook-test-"));
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("CLI commands", () => {
  const runCLI = async (args: string[], env?: Record<string, string>) => {
    const result = await $`bun run index.ts ${args}`
      .cwd(PROJECT_ROOT)
      .env({
        ...process.env,
        LETMECOOK_DIR: testDir,
        ...env,
      })
      .nothrow()
      .quiet();

    return {
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
      exitCode: result.exitCode,
    };
  };

  test("--version prints version and exits 0", async () => {
    const { stdout, exitCode } = await runCLI(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/letmecook v\d+\.\d+\.\d+/);
  });

  test("-v prints version and exits 0", async () => {
    const { stdout, exitCode } = await runCLI(["-v"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/letmecook v\d+\.\d+\.\d+/);
  });

  test("--help prints help and exits 0", async () => {
    const { stdout, exitCode } = await runCLI(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("letmecook");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("--cli");
  });

  test("-h prints help and exits 0", async () => {
    const { stdout, exitCode } = await runCLI(["-h"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
  });

  test("--why prints philosophy and exits 0", async () => {
    const { stdout, exitCode } = await runCLI(["--why"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("clean context");
    expect(stdout).toContain("let them cook");
  });

  test("--cli with no args prints CLI usage and exits 0", async () => {
    const { stdout, exitCode } = await runCLI(["--cli"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("CLI mode");
    expect(stdout).toContain("--list");
  });

  test("--cli --delete nonexistent errors with session not found", async () => {
    const { stderr, exitCode } = await runCLI([
      "--cli",
      "--delete",
      "nonexistent-session",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Session not found: nonexistent-session");
  });

  test("--cli --resume nonexistent errors with session not found", async () => {
    const { stderr, exitCode } = await runCLI([
      "--cli",
      "--resume",
      "nonexistent-session",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Session not found: nonexistent-session");
  });

  test("--cli --nuke --yes handles nuke operation", async () => {
    const { stdout, exitCode } = await runCLI(["--cli", "--nuke", "--yes"]);
    expect(exitCode).toBe(0);
    // Either "Nothing to nuke" or "Nuked N session(s)" is valid
    expect(stdout).toMatch(/Nothing to nuke|Nuked \d+ session/);
  });

  test("bare repo args without --cli shows error", async () => {
    const { stderr, stdout, exitCode } = await runCLI(["owner/repo"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Repo arguments require --cli prefix");
    // The usage hint may go to stdout or stderr depending on implementation
    const combined = stdout + stderr;
    expect(combined).toContain("letmecook --cli owner/repo");
  });

  test("unknown flag shows error", async () => {
    const { stderr, exitCode } = await runCLI(["--unknown-flag"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown option: --unknown-flag");
  });

  test("--cli with unknown flag shows error", async () => {
    const { stderr, exitCode } = await runCLI(["--cli", "--unknown-flag"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown CLI option: --unknown-flag");
  });

  test("--cli --delete without session name shows error", async () => {
    const { stderr, exitCode } = await runCLI(["--cli", "--delete"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Missing session name");
  });

  test("--cli --resume without session name shows error", async () => {
    const { stderr, exitCode } = await runCLI(["--cli", "--resume"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Missing session name");
  });
});
