---
sidebar_position: 3
---

# Multi-repo Workspaces

letmecook excels at managing workspaces that span multiple repositories, providing a unified context for AI coding sessions.

## Why Multi-repo?

Modern projects often consist of multiple repositories:

- **Monorepo dependencies** - Shared libraries, packages
- **Microservices** - Related services that work together
- **Full-stack projects** - Frontend and backend in separate repos

## Adding Repositories

Add repositories to your session:

```bash
letmecook add /path/to/repo
```

Or add multiple at once:

```bash
letmecook add /path/to/frontend /path/to/backend /path/to/shared
```

## Repository Context

When repositories are added to a session, letmecook:

1. Discovers AGENTS.md files in each repository
2. Analyzes project structure and dependencies
3. Creates a unified context for AI assistants

## Working Across Repos

With multi-repo workspaces, AI assistants can:

- Understand relationships between repositories
- Make coordinated changes across codebases
- Reference code and patterns from related projects
