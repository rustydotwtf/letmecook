# letmecook

Ephemeral workspaces for AI coding sessions.

## Why

There's a common practice where developers point their AI coding agent at their development folder. This seems convenient, but that folder is often full of traps: outdated code, abandoned experiments, multiple versions of similar projects, and naming collisions that send agents down rabbit holes until they hit context limits.

You have to know every file you have, which ones matter, and which ones to avoid. It's too much overhead, and your agent pays the price.

**letmecook takes a different approach.** Instead of trying to control your agent with elaborate rules and constraints, give it clean context and get out of its way. Clone the repos you need, add your skills, do the work, and nuke the session when you're done.

This tool is intentionally simple. It sets up repositories, skills, and soon MCP servers - then hands off to your preferred coding agent. That's it. The philosophy is that agents are good at problem-solving when you give them what they need and let them cook.

**Works with any tool that can open a folder.** If your editor or agent supports `<cmd> <folder>`, it works with letmecook. opencode, Cursor, Claude Code, Codex, Gemini, VS Code, vim - whatever you prefer.

[Read more about the philosophy behind letmecook](/docs/docs/concepts/philosophy.md)

## Features

- **Interactive TUI** - User-friendly guided experience built with [OpenTUI](https://github.com/sst/opentui)
- **Agent transparency** - See exactly what the agent plans to do before execution
- **Real-time progress** - Live updates showing cloning and preparation
- **Manual Setup Prompt** - Run custom setup commands (e.g., `npm install`) before starting
- **Session-based workflows** - Workspaces persist until you explicitly nuke them
- **AI-generated session names** - Memorable names based on repos and your goal
- **Multi-repo support** - Clone multiple repos with optional branch specification
- **AGENTS.md generation** - Auto-generated context file for AI agents
- **100% backward compatible** - All existing CLI commands continue to work

## Installation

```bash
bun install
bun link
```

## Setup

Create a `.env` file with your AI Gateway API key (for session naming):

```bash
AI_GATEWAY_API_KEY=your-key-here
```

## Usage

### Interactive Mode (Recommended)

Launch the user-friendly TUI interface:

```bash
letmecook
```

The TUI guides you through:

1. **Adding repositories** - Interactive repo collection
2. **Session goal** - Describe what you want to work on
3. **Agent proposal transparency** - See exactly what the agent plans to do
4. **Real-time progress** - Live updates showing cloning progress
5. **Manual Setup** - Option to run commands like `npm install` before launching
6. **Interactive CLI** - Enter opencode with full context

### CLI Mode (Backward Compatible)

All existing commands continue to work exactly as before:

```bash
# Single repo
letmecook microsoft/playwright

# Multiple repos
letmecook microsoft/playwright openai/agents

# With specific branches
letmecook facebook/react:experimental vercel/next.js:canary

# Explicit TUI mode
letmecook --tui
```

### Manage sessions

```bash
# List all sessions (interactive)
letmecook --list

# Resume a specific session
letmecook --resume <session-name>

# Delete a session
letmecook --nuke <session-name>

# Delete all sessions
letmecook --nuke-all
```

### Session persistence

When you exit opencode, you're prompted to keep or nuke the session. Sessions are kept by default - just press Enter.

To resume later:

```bash
letmecook --resume <session-name>
```

## Session Structure

```
~/.letmecook/sessions/<session-name>/
├── manifest.json     # Session metadata
├── AGENTS.md         # Context for AI agents
├── repo1/            # Cloned repository
└── repo2/            # Another cloned repository
```

## Requirements

- [Bun](https://bun.sh)
- [opencode](https://opencode.ai) - must be in PATH
- [Zig](https://ziglang.org) - required by OpenTUI
- `AI_GATEWAY_API_KEY` environment variable (for AI naming)

## Development

```bash
# Run directly
bun run index.ts microsoft/playwright

# Type check
bun run tsc --noEmit
```
