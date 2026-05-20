# 🚀 @zenithbuild/language-server v0.9.1

## [0.9.1] - 2026-05-20

### Fixed

- Removed the stale component-script blanket diagnostic and
  `zenith.componentScripts` setting from the standalone language server.
- Kept script-mode policy out of the LSP; compiler-backed diagnostics remain
  the source of truth when the compiler is available.
- Added controlled compiler-unavailable diagnostics with code
  `ZENITH-COMPILER-UNAVAILABLE` and no raw Node module/stack leakage.
- Added precise `zenith:runtime` guidance and a quick fix to rewrite the import
  specifier to `zenith`.
- Preserved existing event binding, DOM, CSS import, import/plugin, and
  compiler-backed diagnostics.

### Verified

- `bun run build`
- `bun run test` — 104 tests pass.
- `npm run verify:pack`
- `npm pack --dry-run`
- `git diff --check`

## 📦 Installation

```bash
bun add @zenithbuild/language-server@0.9.1
```

*or with npm:*

```bash
npm install @zenithbuild/language-server@0.9.1
```

---
*Prepared for next-only publish*
