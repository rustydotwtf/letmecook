---
sidebar_position: 2
---

# Architecture

Overview of letmecook's internal architecture.

## Core Concepts

### Session Manager

The session manager handles:

- Creating and loading sessions
- Tracking session state
- Persisting session data

### Repository Manager

Manages repositories within a session:

- Adding and removing repositories
- Discovering AGENTS.md files
- Tracking repository metadata

### Context Aggregator

Combines context from multiple sources:

- AGENTS.md files from all repositories
- Enabled skills
- Project metadata

### TUI

Terminal user interface built with [@opentui/core](https://github.com/anthropics/opentui):

- Interactive session management
- Real-time status display
- Keyboard-driven navigation

## Data Flow

```
User Command
    │
    ▼
┌─────────┐
│   CLI   │
└────┬────┘
     │
     ▼
┌─────────────────┐
│ Session Manager │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────────────┐
│ Repos │ │ Context Agg.  │
└───────┘ └───────────────┘
```

## File Storage

All session data is stored in `.letmecook/`:

```
.letmecook/
├── session.json    # Session manifest
├── config.json     # Local configuration
├── context/        # Cached context
└── skills/         # Custom skills
```

## Extension Points

### Custom Skills

Skills are markdown files that provide additional context. See [Adding Skills](/guides/adding-skills).

### Configuration

Behavior can be customized via configuration files. See [Configuration](/reference/configuration).
