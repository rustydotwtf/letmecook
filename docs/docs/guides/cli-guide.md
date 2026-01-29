---
sidebar_position: 2
---

# CLI Guide

The letmecook CLI provides all functionality through command-line commands.

## Basic Usage

```bash
letmecook <command> [options]
```

## Common Workflows

### Starting a New Project

```bash
# Initialize in current directory
letmecook init

# Start the session
letmecook start

# Add related repositories
letmecook add ../other-repo
```

### Daily Development

```bash
# Start your session
letmecook start

# Work with your AI assistant...

# End when done
letmecook end
```

### Managing Repositories

```bash
# List current repositories
letmecook list

# Add a repository
letmecook add /path/to/repo

# Remove a repository
letmecook remove repo-name
```

## Getting Help

```bash
# Show all commands
letmecook --help

# Help for specific command
letmecook <command> --help
```

See [CLI Commands Reference](/reference/cli-commands) for the complete command reference.
