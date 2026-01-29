---
sidebar_position: 3
---

# Session Manifest

The session manifest (`session.json`) stores all metadata about a letmecook session.

## Location

The manifest is stored at `.letmecook/session.json` in your project root.

## Schema

```json
{
  "version": "1",
  "name": "my-session",
  "created": "2024-01-15T10:30:00Z",
  "repositories": [
    {
      "path": "/absolute/path/to/repo",
      "name": "repo-name",
      "addedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "skills": ["git", "testing"],
  "state": {
    "active": true,
    "startedAt": "2024-01-15T10:30:00Z"
  }
}
```

## Fields

### `version`

Manifest schema version.

- **Type:** `string`
- **Required:** Yes

### `name`

Session name.

- **Type:** `string`
- **Required:** Yes

### `created`

Session creation timestamp (ISO 8601).

- **Type:** `string`
- **Required:** Yes

### `repositories`

Array of repositories in the session.

- **Type:** `Repository[]`
- **Required:** Yes

#### Repository Object

| Field     | Type     | Description                 |
| --------- | -------- | --------------------------- |
| `path`    | `string` | Absolute path to repository |
| `name`    | `string` | Repository name             |
| `addedAt` | `string` | Timestamp when added        |

### `skills`

Array of enabled skill names.

- **Type:** `string[]`
- **Required:** No
- **Default:** `[]`

### `state`

Current session state.

- **Type:** `State`
- **Required:** Yes

#### State Object

| Field       | Type      | Description                   |
| ----------- | --------- | ----------------------------- |
| `active`    | `boolean` | Whether session is active     |
| `startedAt` | `string`  | When session was last started |
| `endedAt`   | `string`  | When session was last ended   |

## Manual Editing

While you can manually edit the manifest, it's recommended to use CLI commands to ensure consistency.
