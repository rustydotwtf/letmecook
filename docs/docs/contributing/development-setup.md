---
sidebar_position: 1
---

# Development Setup

Get letmecook running locally for development.

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- Git

## Clone the Repository

```bash
git clone https://github.com/rustydotwtf/letmecook.git
cd letmecook
```

## Install Dependencies

```bash
bun install
```

## Run Locally

```bash
# Run the CLI directly
bun run index.ts

# Or use the bin entry point
bun run bin.js
```

## Running Tests

```bash
bun test
```

## Linting and Formatting

```bash
# Check for issues
bun run check

# Auto-fix issues
bun run fix
```

## Project Structure

```
letmecook/
├── src/           # Source code
├── docs/          # Documentation (Docusaurus)
├── index.ts       # Main entry point
├── bin.js         # CLI entry point
└── package.json
```

## Making Changes

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

See [Architecture](/contributing/architecture) for details on the codebase structure.
