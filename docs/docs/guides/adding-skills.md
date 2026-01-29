---
sidebar_position: 4
---

# Adding Skills

Skills extend letmecook's capabilities by providing specialized context and instructions for AI assistants.

## What are Skills?

Skills are modular context providers that give AI assistants domain-specific knowledge and instructions. They're similar to AGENTS.md files but are reusable across projects.

## Built-in Skills

letmecook includes built-in skills for common tasks:

- **git** - Git operations and best practices
- **testing** - Test writing patterns
- **docs** - Documentation generation

## Using Skills

Enable a skill for your session:

```bash
letmecook skill add git
```

List available skills:

```bash
letmecook skill list
```

## Creating Custom Skills

Create a skill file in your project:

```markdown
<!-- .letmecook/skills/my-skill.md -->

# My Custom Skill

## Instructions

Provide instructions for the AI assistant here.

## Examples

Show examples of desired behavior.
```

Register the skill:

```bash
letmecook skill add ./my-skill.md
```

## Skill Best Practices

1. **Keep skills focused** - One skill per domain or task type
2. **Include examples** - Show the AI what good output looks like
3. **Test skills** - Verify they produce the desired behavior
