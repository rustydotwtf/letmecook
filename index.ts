#!/usr/bin/env bun

import { loadEnv } from "./src/env";

// Load env files from ~/.letmecook/.env and ./.env
loadEnv();

import pkg from "./package.json";
import { handleCLIMode } from "./src/cli-mode";
import { handleTUIMode } from "./src/tui-mode";

const block = (r: number, g: number, b: number): string =>
  `\u001B[48;2;${r};${g};${b}m  \u001B[0m`;

function printUsage(): void {
  console.log(`
letmecook - Multi-repo workspace manager for AI coding sessions

Usage:
  letmecook                                    Launch interactive TUI (default)
  letmecook --tui                              Launch interactive TUI explicitly
  letmecook --cli <owner/repo> [...]           Create or resume a session (CLI mode)
  letmecook --cli --list                       List all sessions
  letmecook --cli --resume <session-name>      Resume a session
  letmecook --cli --delete <session-name>      Delete a session
  letmecook --cli --nuke [--yes]               Nuke everything
  letmecook --why                              Show why this tool exists
  letmecook --help                             Show this help
  letmecook --version                          Show version

Examples:
  # Interactive mode (default, recommended)
  letmecook

  # CLI mode (requires --cli prefix)
  letmecook --cli microsoft/playwright
  letmecook --cli facebook/react openai/agents
  letmecook --cli --resume playwright-agent-tests
  `);
}

function printWhy(): void {
  const palette: Record<string, string> = {
    ".": "  ",
    s: block(200, 200, 200), // steam
    d: block(88, 62, 52), // dark brown
    l: block(121, 85, 72), // light brown (crust)
    r: block(214, 64, 36), // red (pepperoni)
    o: block(245, 124, 0), // orange
    y: block(255, 193, 7), // yellow (cheese)
    Y: block(255, 220, 80), // bright yellow (cheese highlight)
    g: block(76, 175, 80), // green (basil)
    k: block(20, 20, 20), // black (nori)
    w: block(236, 236, 236), // white (rice)
    b: block(79, 118, 170), // blue (fish)
  };
  const arts = [
    // Pizza slice (7x7)
    [
      "..yy...",
      ".yyyy..",
      ".yryry.",
      "yyyyyyy",
      "yygyrry",
      "lllllll",
      "ddddddd",
    ],
    // Burger (7x7)
    [
      ".yyyyy.",
      "ggggggg",
      "rrrrrrr",
      "ddddddd",
      "ggggggg",
      "ooooooo",
      ".yyyyy.",
    ],
    // Fried egg (7x7)
    [
      "..www..",
      ".wwwww.",
      "wwwyyww",
      "wwyyyyw",
      "wwwyyww",
      ".wwwww.",
      "..www..",
    ],
  ];
  const defaultArt = arts[0] ?? [".", ".", ".", ".", ".", ".", "."];
  const artRows = arts[Math.floor(Math.random() * arts.length)] ?? defaultArt;
  const art = artRows
    .map((row) => [...row].map((cell) => palette[cell] ?? "  ").join(""))
    .join("\n");
  console.log(`
${art}

Your dev folder is full of traps: outdated code, abandoned experiments, naming
collisions that send agents down rabbit holes until they hit context limits.

letmecook gives your agent clean context. Clone what you need, cook, nuke when done.

Agents are good at problem-solving when you give them what they need and let them cook.
  `);
}

console.clear();
const args = process.argv.slice(2);
const [firstArg] = args;

// Version flag
if (firstArg === "--version" || firstArg === "-v") {
  console.log(`letmecook v${pkg.version}`);
  process.exit(0);
}

// Why flag
if (firstArg === "--why") {
  printWhy();
  process.exit(0);
}

// Help flag
if (firstArg === "--help" || firstArg === "-h") {
  printUsage();
  process.exit(0);
}

// CLI mode with --cli prefix
if (firstArg === "--cli") {
  const cliArgs = args.slice(1);
  await handleCLIMode(cliArgs);
  process.exit(0);
}

// Explicit TUI mode
if (firstArg === "--tui") {
  await handleTUIMode();
  process.exit(0);
}

// Default: TUI mode (no args)
if (args.length === 0) {
  await handleTUIMode();
  process.exit(0);
}

// Catch bare repo args without --cli prefix
if (firstArg && !firstArg.startsWith("-") && firstArg.includes("/")) {
  console.error(`Error: Repo arguments require --cli prefix.`);
  console.log(`\nUsage: letmecook --cli ${args.join(" ")}`);
  console.log(`\nOr launch the interactive TUI: letmecook`);
  process.exit(1);
}

// Unknown flag
if (firstArg?.startsWith("-")) {
  console.error(`Unknown option: ${firstArg}`);
  printUsage();
  process.exit(1);
}

// Unknown positional argument that's not a repo
console.error(`Unknown argument: ${firstArg}`);
printUsage();
process.exit(1);
