---
sidebar_position: 2
---

# Configuration

letmecook can be configured through files and environment variables.

## Configuration File

Create a `.letmecook/config.json` file in your project root:

```json
{
  "defaultSkills": ["git"],
  "excludePatterns": ["node_modules", ".git", "dist"],
  "contextLimit": 100000
}
```

## Configuration Options

### `defaultSkills`

Skills to enable by default for new sessions.

- **Type:** `string[]`
- **Default:** `[]`

### `excludePatterns`

Glob patterns for files and directories to exclude from context.

- **Type:** `string[]`
- **Default:** `["node_modules", ".git", "dist", "build"]`

### `contextLimit`

Maximum context size in characters.

- **Type:** `number`
- **Default:** `100000`

### `tui`

TUI-specific configuration.

```json
{
  "tui": {
    "theme": "dark",
    "refreshInterval": 1000
  }
}
```

## Environment Variables

| Variable           | Description                |
| ------------------ | -------------------------- |
| `LETMECOOK_CONFIG` | Path to configuration file |
| `LETMECOOK_DEBUG`  | Enable debug logging       |

## Per-Repository Configuration

Override configuration for specific repositories by creating `.letmecook/config.json` in the repository root.
