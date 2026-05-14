# Manual Neovim Verification

Use this checklist against a real Zenith project, not only a temporary fixture.
It verifies the standalone language server path. Syntax highlighting and
filetype runtime files are owned by `@zenithbuild/language`.

## Install checks

```bash
command -v zenith-language-server
zenith-language-server --stdio
zenith-language-server
```

The no-argument command should start the server over stdio for package versions
that include the public stdio default. If an older installed package still needs
an explicit transport, configure Neovim temporarily with:

```lua
cmd = { "zenith-language-server", "--stdio" }
```

## Neovim setup

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

if vim.lsp.config then
  vim.lsp.config("zenith", {
    cmd = { "zenith-language-server" },
    filetypes = { "zenith" },
    root_markers = { "zenith.config.js", "zenith.config.ts", "package.json", ".git" },
  })
  vim.lsp.enable("zenith")
else
  vim.api.nvim_create_autocmd("FileType", {
    pattern = "zenith",
    callback = function()
      vim.lsp.start({
        name = "zenith-language-server",
        cmd = { "zenith-language-server" },
        root_dir = vim.fs.root(0, { "zenith.config.js", "zenith.config.ts", "package.json", ".git" }),
      })
    end,
  })
end
```

## Verify a real buffer

Open a real page:

```vim
:edit src/pages/index.zen
:set filetype?
:lua print(vim.inspect(vim.lsp.get_clients({ bufnr = 0 })))
:lua print(vim.inspect(vim.diagnostic.get(0)))
```

Expected:

- `filetype=zenith`
- one active `zenith-language-server` client for the buffer
- invalid `.zen` edits publish diagnostics with code, message, source, and range
- restoring valid content clears diagnostics
- `vim.lsp.buf.hover()` returns limited doc-backed hover where supported
- completion requests include documented Zenith items such as `on:click`

Current limitations:

- no full TypeScript semantic completion or typechecking
- no project-wide symbol index
- no semantic tokens
