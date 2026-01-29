---
sidebar_position: 0
---

# Philosophy

letmecook exists because of a simple observation: AI coding agents are remarkably good at problem-solving when you give them clean context and get out of their way.

## The Problem: Development Folder Traps

There's a common pattern where developers point their AI agent at their main development folder. It seems efficient - everything's right there. But that folder is often a minefield.

Consider what typically lives in a development folder:

- Abandoned experiments you never deleted
- Multiple versions of similar projects
- Outdated code with deprecated patterns
- Dependencies installed for projects you forgot about
- Config files from tools you no longer use

Here's a concrete example: you have a project called `api-client` from two years ago and a current project called `api-service`. Your agent is working on the new service, searches for "api" to understand patterns, and finds the old client. It starts pulling in patterns, function signatures, maybe even deprecated dependencies. By the time you notice, your agent has burned through context trying to reconcile two unrelated codebases. This is context rot - your agent's effective context window shrinking as it fills with irrelevant or contradictory information.

## The Solution: Ephemeral Context

letmecook takes a different approach: start clean every time.

1. **Clone** the repositories you actually need
2. **Add** skills that provide relevant context
3. **Work** with your preferred coding agent
4. **Nuke** the session when you're done

There's no accumulated cruft. No old experiments lurking in the background. No naming collisions waiting to derail your agent. Just the code you need for the task at hand.

Sessions can persist if you need to step away and come back, but the default mental model is ephemeral. Get in, do the work, get out.

## Why Simple Works

When people first see letmecook, a common reaction is "that's it?" Yes. That's the point.

The tool does a small number of things well:

- Sets up repositories in an isolated workspace
- Manages skills that provide context to your agent
- Gets out of your way

There's a temptation in the AI tooling space to build elaborate systems: complex rules, intricate constraints, sophisticated guardrails. The theory is that agents need to be controlled and directed carefully.

letmecook takes the opposite stance. Agents are good at problem-solving. They don't need micromanagement - they need clean context. Give them the right information, put them in a sandbox where they can't cause permanent damage, and let them cook.

This isn't a random claim. This approach has been tested across hundreds of sessions, solving problems that more elaborate setups couldn't touch. Sometimes the simplest tool is the most effective one.

## Tool Agnostic by Design

letmecook doesn't care what coding agent or editor you use. The interface is deliberately simple: if your tool can open a folder, it works.

```
<your-tool> <session-folder>
```

That's the entire integration point. opencode, Cursor, Claude Code, Codex, Gemini, VS Code, vim, emacs - whatever you prefer. letmecook handles the workspace setup; you bring the tool you're productive with.

This means you're never locked in. Try different agents for different tasks. Switch tools as the ecosystem evolves. Your workflow stays the same: create a session, open it with your preferred tool, work, nuke when done.
