---
sidebar_position: 3
---

# Managing Sessions

Learn how to effectively manage your letmecook sessions.

## Session Basics

### Creating a Session

```bash
letmecook init
```

This creates a `.letmecook` directory with session configuration.

### Starting and Stopping

```bash
# Start the session
letmecook start

# End the session
letmecook end
```

## Session State

Sessions maintain state including:

- **Repositories** - Added repos and their configurations
- **Context** - Aggregated AGENTS.md and other context
- **History** - Actions taken during the session

## Exporting Context

Export your session context for use with AI assistants:

```bash
letmecook export
```

This outputs the aggregated context suitable for pasting into an AI chat.

## Session Cleanup

Remove old session data:

```bash
letmecook clean
```

## Best Practices

1. **Keep sessions focused** - One session per logical task or feature
2. **Update AGENTS.md** - Keep context files current as your project evolves
3. **End sessions properly** - Use `letmecook end` rather than just closing the terminal
