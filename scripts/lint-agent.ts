#!/usr/bin/env bun

/**
 * Lint Agent - Concise markdown output for AI agents
 *
 * Runs oxlint with JSON output and reformats to compact markdown
 * to avoid exploding AI context windows with full source dumps.
 */

const SHOW_ALL = process.argv.includes("--all");

interface Diagnostic {
  message: string;
  code: string;
  severity: "error" | "warning";
  filename: string;
  labels: Array<{
    span: {
      line: number;
    };
  }>;
}

interface OxlintOutput {
  diagnostics: Diagnostic[];
}

function shortenMessage(message: string): string {
  // Take first sentence or up to 100 chars
  const firstSentence = message.split(/\.[\s\n]/)[0];
  if (firstSentence && firstSentence.length <= 100) {
    return firstSentence + (message.length > firstSentence.length ? "." : "");
  }
  return message.slice(0, 97) + "...";
}

function formatRuleName(code: string): string {
  // Keep full rule names as requested
  return code;
}

function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const groups = new Map<string, Diagnostic[]>();

  for (const diag of diagnostics) {
    const list = groups.get(diag.filename) || [];
    list.push(diag);
    groups.set(diag.filename, list);
  }

  // Sort files alphabetically
  return new Map(
    [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );
}

async function runLint(): Promise<void> {
  const proc = Bun.spawn({
    cmd: ["bunx", "oxlint", "--format", "json"],
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  if (stderr) {
    console.error(stderr);
  }

  let result: OxlintOutput;
  try {
    result = JSON.parse(output);
  } catch {
    // If JSON parsing fails, oxlint might have crashed or output non-JSON
    console.error("Failed to parse oxlint output");
    process.exit(proc.exitCode ?? 1);
    return;
  }

  // Filter by severity if not showing all
  let diagnostics = result.diagnostics;
  if (!SHOW_ALL) {
    diagnostics = diagnostics.filter((d: Diagnostic) => d.severity === "error");
  }

  if (diagnostics.length === 0) {
    console.log(
      "✓ No lint errors" + (SHOW_ALL ? "" : " (use --all to include warnings)")
    );
    process.exit(0);
    return;
  }

  // Group by file (already sorted alphabetically)
  const grouped = groupByFile(diagnostics);
  const files = [...grouped.entries()];
  const totalFiles = files.length;

  if (totalFiles === 0) {
    console.log(
      "✓ No lint errors" + (SHOW_ALL ? "" : " (use --all to include warnings)")
    );
    process.exit(0);
    return;
  }

  // Show only the first file to prevent context overload
  const firstFile = files[0]!;
  const filename = firstFile[0];
  const issues = firstFile[1];
  const errorCount = issues.filter(
    (i: Diagnostic) => i.severity === "error"
  ).length;
  const warningCount = issues.filter(
    (i: Diagnostic) => i.severity === "warning"
  ).length;

  let countStr = "";
  if (errorCount > 0 && warningCount > 0) {
    countStr = `${errorCount} errors, ${warningCount} warnings`;
  } else if (errorCount > 0) {
    countStr = `${errorCount} error${errorCount !== 1 ? "s" : ""}`;
  } else {
    countStr = `${warningCount} warning${warningCount !== 1 ? "s" : ""}`;
  }

  console.log("- `" + filename + "` (" + countStr + ")");

  // Sort by line number
  const sorted = issues.sort((a: Diagnostic, b: Diagnostic) => {
    const lineA = a.labels[0]?.span?.line ?? 0;
    const lineB = b.labels[0]?.span?.line ?? 0;
    return lineA - lineB;
  });

  for (const issue of sorted) {
    const line = issue.labels[0]?.span?.line ?? "?";
    const rule = formatRuleName(issue.code);
    const msg = shortenMessage(issue.message);
    const severity = issue.severity === "warning" ? " (warn)" : "";

    console.log("  - L" + line + ": `" + rule + "` - " + msg + severity);
  }

  // Calculate total counts across all files
  const totalErrors = diagnostics.filter(
    (d: Diagnostic) => d.severity === "error"
  ).length;
  const totalWarnings = diagnostics.filter(
    (d: Diagnostic) => d.severity === "warning"
  ).length;

  // Show summary
  console.log("");
  let summaryParts = [];
  if (totalErrors > 0) {
    summaryParts.push(`${totalErrors} error${totalErrors !== 1 ? "s" : ""}`);
  }
  if (totalWarnings > 0) {
    summaryParts.push(
      `${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}`
    );
  }
  const totalSummary = summaryParts.join(", ");

  if (totalFiles > 1) {
    console.log(
      `Total: ${totalSummary} across ${totalFiles} files (showing first file only)`
    );
  } else {
    console.log(`Total: ${totalSummary}`);
  }

  // Exit with error code if there are errors
  process.exit(totalErrors > 0 ? 1 : 0);
}

runLint().catch((error: unknown) => {
  console.error("Error running lint agent:", error);
  process.exit(1);
});
