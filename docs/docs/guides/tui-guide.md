---
sidebar_position: 1
---

# TUI Guide

The letmecook TUI (Terminal User Interface) provides an interactive way to manage your sessions.

## Starting the TUI

```bash
letmecook tui
```

## Features

### Session Overview

The main view shows your current session status:

- Active repositories
- Session duration
- Context size

### Repository Management

- Add new repositories to the session
- Remove repositories
- View repository details and AGENTS.md content

### Session Controls

- Start/stop sessions
- Export session context
- View session history

## Keyboard Shortcuts

### Navigation

| Key     | Action                             |
| ------- | ---------------------------------- |
| `↑` `↓` | Navigate lists and options         |
| `Tab`   | Move between input fields/sections |
| `Enter` | Confirm/Select/Continue            |
| `Esc`   | Cancel/Back/Exit                   |

### Global Shortcuts (Main Menu & List)

| Key | Action                  |
| --- | ----------------------- |
| `n` | New session             |
| `d` | Delete selected session |
| `q` | Quit application        |

### Text Input

| Key     | Action                                 |
| ------- | -------------------------------------- |
| `↑` `↓` | Navigate history (when in input field) |
| `Tab`   | Autocomplete (when available)          |
| `Enter` | Submit input                           |
| `Esc`   | Cancel/clear input                     |

### Context-Specific Actions

The footer bar at the bottom of the screen always shows available actions for the current context. Common actions include:

- **Add Repos**: `l` Toggle Read-only
- **Session Settings**: `Tab` Switch sections, `l` Toggle Read-only, `a` Add repos, `+` Add skills, `x` Remove skill
- **Dialogs**: Use arrow keys to navigate options, `Enter` to select

## Customization

Configure TUI behavior in your session configuration. See [Configuration](/reference/configuration) for details.
