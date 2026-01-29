---
sidebar_position: 1
---

# Sessions

Sessions are the core concept in letmecook. A session represents a working context for an AI coding assistant, including all relevant repositories and their configurations.

## What is a Session?

A session encapsulates:

- **Workspace configuration** - Which repositories to include
- **AI context** - AGENTS.md files and other context providers
- **State** - Current working state across repositories

## Session Lifecycle

1. **Create** - Initialize a new session with `letmecook init`
2. **Start** - Activate the session with `letmecook start`
3. **Work** - Make changes, add repositories, update context
4. **End** - Complete the session with `letmecook end`

## Session Storage

Sessions are stored in the `.letmecook` directory in your project root. The session manifest (`session.json`) contains all session metadata.
