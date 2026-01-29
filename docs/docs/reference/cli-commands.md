---
sidebar_position: 1
---

# CLI Commands

Complete reference for all letmecook CLI commands.

## Global Options

These options are available for all commands:

| Option            | Description           |
| ----------------- | --------------------- |
| `--help`, `-h`    | Show help information |
| `--version`, `-v` | Show version number   |
| `--verbose`       | Enable verbose output |

## Commands

### `init`

Initialize a new letmecook session in the current directory.

```bash
letmecook init [options]
```

**Options:**

| Option   | Description  |
| -------- | ------------ |
| `--name` | Session name |

### `start`

Start the current session.

```bash
letmecook start
```

### `end`

End the current session.

```bash
letmecook end
```

### `add`

Add a repository to the current session.

```bash
letmecook add <path> [paths...]
```

**Arguments:**

| Argument | Description               |
| -------- | ------------------------- |
| `path`   | Path to repository to add |

### `remove`

Remove a repository from the current session.

```bash
letmecook remove <name>
```

### `list`

List repositories in the current session.

```bash
letmecook list
```

### `export`

Export session context.

```bash
letmecook export [options]
```

**Options:**

| Option           | Description                |
| ---------------- | -------------------------- |
| `--format`       | Output format (text, json) |
| `--output`, `-o` | Output file path           |

### `tui`

Open the interactive terminal UI.

```bash
letmecook tui
```

### `skill`

Manage skills.

```bash
letmecook skill <subcommand>
```

**Subcommands:**

| Subcommand      | Description                     |
| --------------- | ------------------------------- |
| `list`          | List available skills           |
| `add <name>`    | Add a skill to the session      |
| `remove <name>` | Remove a skill from the session |

### `clean`

Clean up session data.

```bash
letmecook clean [options]
```

**Options:**

| Option  | Description             |
| ------- | ----------------------- |
| `--all` | Remove all session data |
