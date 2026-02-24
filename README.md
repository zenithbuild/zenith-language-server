# @zenithbuild/language-server ⚡

The Language Server Protocol (LSP) implementation for the Zenith framework.

## Overview

This package provides the "brains" for Zenith editor support. It implements the Language Server Protocol to provide features like autocomplete, hover information, diagnostics, and code actions across any supporting editor (VS Code, Vim, etc.).

## Features

- **Diagnostics**: Real-time error reporting and linting for `.zen` files.
- **Completion**: Context-aware suggestions for Zenith-specific syntax and standard HTML.
- **Hover Information**: Detailed documentation on hover for core components and hooks.
- **Document Symbols**: Outline and navigation support for complex components.
- **Contract Enforcement**:
  - `on:click={handler}` event syntax diagnostics + quick fixes for `onclick` / `@click`.
  - Component script policy (`zenith.componentScripts`: `forbid` | `allow`).
  - CSS import contract diagnostics for local precompiled CSS only.
- **Project Root Resolution**:
  - nearest `zenith.config.*`
  - nearest `package.json` with `@zenithbuild/cli`
  - workspace-aware fallback heuristics

## Settings

- `zenith.componentScripts`
  - `forbid` (default): components may not contain `<script>`.
  - `allow`: disables the component-script contract diagnostic.

## Architecture

The server is built with `vscode-languageserver` and is designed to be decoupled from the VS Code extension, allowing it to be reused in other IDEs or environments.

## Development

```bash
# Build the server
bun run build

# Run in watch mode
bun run dev
```

## License

MIT
