#!/usr/bin/env bun

/**
 * Lint Agent Fix - Automated lint fixing loop with AI
 *
 * Runs lint:agent command in a loop. If errors are found,
 * injects the output into an AI agent prompt to fix them.
 * Continues until all lint errors are resolved.
 */

const MODEL = process.env.LINT_MODEL || "opencode/kimi-k2.5";
const MAX_ITERATIONS = Number.parseInt(process.env.MAX_ITERATIONS || "20", 10);
const DRY_RUN = process.argv.includes("--dry-run");

interface LintResult {
  exitCode: number;
  output: string;
}

async function runLintAgent(): Promise<LintResult> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "lint:agent"],
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  // Only use stdout - stderr is just bun's script runner noise
  return {
    exitCode: proc.exitCode ?? 1,
    output: stdout.trim(),
  };
}

async function showLastCommit(): Promise<void> {
  console.log("\n📜 Last commit:");
  console.log("─".repeat(50));

  const proc = Bun.spawn({
    cmd: ["git", "show", "--stat", "--oneline"],
    stdout: "inherit",
    stderr: "inherit",
  });

  await proc.exited;
  console.log("─".repeat(50));
}

async function runOpenCodeFix(lintOutput: string): Promise<number> {
  const prompt = `Fix the following lint error(s). After fixing, run \`bun run lint:agent\` to verify the fix worked and didn't introduce new issues. Commit the changes when complete.

Lint output:
${lintOutput}`;

  console.log("\n📝 Prompt being sent to agent:");
  console.log("─".repeat(50));
  console.log(prompt);
  console.log("─".repeat(50));

  if (DRY_RUN) {
    console.log("\n🔍 Dry run - would run opencode with this prompt");
    return 0;
  }

  const proc = Bun.spawn({
    cmd: ["opencode", "run", prompt, "--model", MODEL],
    stdout: "inherit",
    stderr: "inherit",
  });

  await proc.exited;
  return proc.exitCode ?? 1;
}

async function main(): Promise<void> {
  console.log("🍳 Lint Agent Fix Loop");
  console.log(`   Model: ${MODEL}`);
  console.log(`   Max iterations: ${MAX_ITERATIONS}`);
  if (DRY_RUN) {
    console.log("   Mode: DRY RUN (will not call AI)");
  }
  console.log("");

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n═══ Iteration ${iteration}/${MAX_ITERATIONS} ═══\n`);

    // Run lint check
    console.log("🔍 Running lint:agent...");
    const lintResult = await runLintAgent();

    // If lint passes, we're done!
    if (lintResult.exitCode === 0) {
      console.log("\n✅ All lint errors fixed!");
      console.log(`   Completed in ${iteration} iteration(s)`);
      process.exit(0);
      return;
    }

    // Show lint output
    console.log("\n📋 Lint errors found:");
    console.log(lintResult.output);

    // Run AI fix
    console.log("\n🤖 Calling AI agent to fix...");
    const fixExitCode = await runOpenCodeFix(lintResult.output);

    if (fixExitCode !== 0) {
      console.error(`\n⚠️  AI agent exited with code ${fixExitCode}`);
      // Continue anyway - maybe partial fix worked
    }

    // Show what was committed
    if (!DRY_RUN) {
      await showLastCommit();
    }
  }

  // If we get here, we hit max iterations
  console.error(
    `\n❌ Max iterations (${MAX_ITERATIONS}) reached without fixing all errors`
  );
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error("Error in lint-agent-fix:", error);
  process.exit(1);
});
