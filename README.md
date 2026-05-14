# @zenithbuild/language-server

Language Server Protocol implementation for Zenith editor integrations.

## Overview

This package provides the standalone language server used by Zenith editor
extensions and plain LSP clients such as Neovim.

Global install:

```bash
npm i -g @zenithbuild/language-server
```

Run over stdio:

```bash
zenith-language-server
```

The package bin defaults to stdio when no explicit LSP transport flag is passed,
which matches Neovim and other plain LSP client setups. Explicit transports such
as `--stdio`, `--node-ipc`, and `--socket=...` are still preserved.

## Features

- **Diagnostics**: Compiler-backed diagnostics plus static contract checks for `.zen`, `.zen.html`, and `.zenx` files.
- **Completion**: Limited doc-backed suggestions for Zenith syntax, canonical primitives, events, and HTML.
- **Hover Information**: Documentation for supported Zenith primitives, directives, router helpers, and local state/functions.
- **Code Actions**: DOM-safety and event-binding quick fixes where supported.
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
- `zenith.strictDomLints`
  - `false` (default): reports `ZEN-DOM-*` diagnostics as warnings.
  - `true`: reports `ZEN-DOM-*` diagnostics as errors.

## Neovim

Example Neovim setup:

```lua
vim.filetype.add({
  extension = {
    zen = "zenith",
    zenx = "zenith",
  },
  pattern = {
    [".*%.zen%.html"] = "zenith",
  },
})

vim.api.nvim_create_autocmd("FileType", {
  pattern = "zenith",
  callback = function()
    vim.lsp.start({
      name = "zenith-language-server",
      cmd = { "zenith-language-server" },
      root_dir = vim.fs.root(0, { "zenith.config.ts", "zenith.config.js", "package.json", ".git" }),
    })
  end,
})
```

Supported Neovim/editor features:
- compiler-backed diagnostics
- limited doc-backed hover and completion
- DOM-safety and event-binding code actions

Limitations:
- no full TypeScript semantic completion or typechecking
- no project-wide symbol index

Local editor smoke:

```bash
bun test test/neovim-smoke.spec.ts
```

The Neovim smoke prints `SKIP: nvim not installed` when Neovim is unavailable
and `SKIP: nvim >= 0.10 required` when the installed Neovim is too old for the
tested LSP client API.

## Architecture

The server is built with `vscode-languageserver` and is designed to be decoupled from the VS Code extension, allowing it to be reused in other IDEs or environments.

## Development

```bash
# Build the server
bun run build

# Build and run tests
bun run test

# Run in watch mode
bun run dev
```

## License

MIT


## Support Zenith

If this project is useful to you, consider sponsoring Zenith on GitHub: [Sponsor Zenith](https://github.com/sponsors/zenithbuild). Sponsorship helps fund ongoing work across the compiler, runtime, tooling, documentation, and long-term maintenance.
