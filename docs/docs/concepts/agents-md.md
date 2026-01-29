---
sidebar_position: 2
---

# AGENTS.md Files

AGENTS.md files provide context to AI coding assistants about your project. letmecook automatically discovers and manages these files across your workspace.

## Purpose

AGENTS.md files serve as instruction manuals for AI assistants, containing:

- **Project overview** - What the project does and its architecture
- **Coding conventions** - Style guides, patterns, and practices
- **Important context** - Key files, dependencies, and gotchas
- **Task-specific guidance** - Instructions for common operations

## File Location

AGENTS.md files can be placed at:

- Repository root - Applies to the entire repository
- Subdirectories - Applies to specific modules or features

## Example

```markdown
# Project Name

## Overview

Brief description of the project.

## Architecture

- `/src` - Source code
- `/tests` - Test files

## Conventions

- Use TypeScript strict mode
- Prefer functional patterns
```

## Discovery

letmecook automatically discovers AGENTS.md files when you add repositories to your session. These files are aggregated and provided as context to your AI assistant.
