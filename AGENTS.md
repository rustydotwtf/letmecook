# letmecook

Ephemeral workspaces for AI coding sessions.

## Philosophy

**Agents are good at problem-solving when you give them clean context and get out of their way.**

This tool exists because of a simple observation: developers often point AI agents at their cluttered development folders, which are full of abandoned experiments, outdated code, and naming collisions that send agents down rabbit holes until they hit context limits.

**letmecook takes a different approach:**

1. **Clone** the repositories you actually need
2. **Add** skills that provide relevant context
3. **Work** with your preferred coding agent
4. **Nuke** the session when you're done

No accumulated cruft. No old experiments lurking. No naming collisions. Just the code you need for the task at hand.

## What This Tool Is

**letmecook is a pre-chat context preparation tool.** It is NOT an AI coding agent itself. It is the setup phase that happens BEFORE you start a chat session with OpenCode, Claude Code, Cursor, or any other AI agent.

The workflow:

- **Pre-chat:** Use letmecook to gather repos, define your goal, and prepare a clean workspace
- **Chat:** Open the workspace with your preferred AI agent and work
- **Post-chat:** Nuke or resume the session as needed

This separation is intentional. letmecook handles workspace setup so your AI agent can focus entirely on problem-solving.

## The Meta Nature

**You're working on a tool that creates workspaces for AI agents.** When you edit `src/agents-md.ts`, you're editing code that generates the instructions that guide... future AI agents working in those workspaces.

Keep this in mind:

- The AGENTS.md we generate becomes the context for other AI agents
- Changes here affect how effectively other agents can work
- This codebase is the foundation, not the session

## Architecture Overview

**Three Entry Points:**

- **TUI Mode** (default) - Interactive terminal UI for guided session creation
- **CLI Mode** (`--cli`) - Command-line interface for scripting
- **Chat Mode** - AI-powered natural language session setup

**Core Flows** (`src/flows/`):

- `new-session.ts` - Creates session, clones repos, installs skills, generates AGENTS.md
- `chat-to-config.ts` - LLM conversation that translates natural language into session config
- `resume-session.ts`, `edit-session.ts` - Session lifecycle management

**Session Structure** (in `~/.letmecook/sessions/<name>/`):

```
session-name/
├── manifest.json     # Session metadata (repos, goal, skills)
├── AGENTS.md         # Auto-generated AI context file
├── CLAUDE.md         # Symlink to AGENTS.md
└── repo1/            # Cloned repository
```

## Key Patterns

**Bun-First:** This is a 100% Bun codebase. No Node.js compatibility needed.

- Use `Bun.serve()` instead of Express
- Use `bun:sqlite` instead of better-sqlite3
- Use `Bun.file()` and `Bun.write()` instead of node:fs
- Use `bun:test` for testing

**TUI with OpenTUI:** The terminal UI is built with `@opentui/core`. Components in `src/ui/` render real-time interfaces with:

- Progress indicators for git cloning
- Chat interfaces with streaming responses
- Interactive menus and forms

**Skills System:** Skills are context modules installed via `bunx skills`. They provide domain-specific knowledge to AI agents and are managed in `src/skills.ts`.

**Session Persistence:** Sessions are stored in `~/.letmecook/sessions/` and can be resumed later. The manifest tracks repos, goal, and metadata. AGENTS.md is regenerated when session settings change.

## Common Foot Guns

**1. Confusing the Tool with the Agent**

- letmecook PREPARES the workspace
- The AI agent (OpenCode, Claude Code, etc.) WORKS in the workspace
- Don't try to make letmecook do the agent's job

**2. Session vs. This Codebase**

- You're editing the tool that creates sessions
- Sessions are in `~/.letmecook/sessions/`, not in this repo
- Changes here affect future sessions, not existing ones

**3. Bun APIs vs Node.js**

- Always prefer Bun-native APIs
- The codebase is Bun-only; Node.js compatibility is not a goal
- Check `CLAUDE.md` for the full Bun API reference

**4. TUI Rendering**

- OpenTUI components are terminal-based, not web-based
- Rendering happens in real-time via `renderer.requestRender()`
- Don't confuse this with React or web UI patterns

**5. AGENTS.md Generation**

- `src/agents-md.ts` generates the context file for sessions
- Changes here affect what future AI agents see
- The symlink to CLAUDE.md is for Claude Code compatibility

## Development Notes

**Testing:** `bun test` (uses bun:test, not jest/vitest)

**Linting:** `bun run lint` (uses oxlint)

**Type Checking:** `bun run typecheck` (uses tsc --noEmit)

**Documentation:** Docusaurus site in `docs/` directory

## Remember

**The goal is clean context.** Every feature should make it easier to set up a workspace where an AI agent can work effectively. If a feature adds complexity without improving context quality, it doesn't belong here.

Keep it simple. Give agents what they need. Let them cook.

## Linting Rules (Ultracite)

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)

### Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

### When Ultracite Can't Help

Ultracite's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Ultracite can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

Most formatting and common issues are automatically fixed by Ultracite. Run `bun ultracite fix` before committing to ensure compliance.
