# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.15] - 2026-05-17

### Added

- Canonical `@zenithbuild/router` module metadata in
  `src/metadata/core-imports.ts` covering `createRouter`, `navigate`,
  `refreshCurrentRoute`, `back`, `forward`, `getCurrentPath`,
  `onRouteChange`, `on`, `off`, `setAdvisoryRoutePolicy`,
  `zenNavigationShell`, and `matchRoute`. The router subpath
  `@zenithbuild/router/ZenLink.zen` is also catalogued, with `ZenLink` props
  audited against `framework/packages/router/src/ZenLink.zen` (`href`,
  `class`, `target`, `rel`, `id`, `title`, `ariaLabel`, `ariaCurrent`,
  `ariaDisabled`, `elementRef`, `onClick`, `onHoverIn`, `onHoverOut`,
  `onFocus`, `onBlur`).
- `hasZenLinkImport()` helper in `src/imports.ts` and `ROUTER_FUNCTIONS` /
  `ZENLINK_PROPS` exports in `src/router.ts`. `src/imports.ts` now tracks
  `@zenithbuild/router` and its subpaths in `parseZenithImports()` and
  `getAllModules()`.
- Truth gates in `test/api-truth.spec.ts` that block re-introduction of
  React-style `children:` / `ReactNode` / `PropsWithChildren` / `className=`,
  legacy router hooks (`useRoute`, `useRouter`, `prefetch`, `isActive`,
  `getRoute`), the legacy `zenith/router` module id, and `<ZenLink to=...>`
  props on any LSP completion/hover surface or metadata catalog.
- End-to-end completion tests in `test/lsp-stdio.spec.ts` covering router
  programmatic surface (`navigate`, `createRouter`, …), `<ZenLink>`
  template completion with `href`, `<ZenLink>` attribute completion (no
  `to` / `preload` / `children`), generic tag attribute completion (no
  `children` / `className` injected when `Props` is absent), and import
  path completion (`@zenithbuild/router` present, `zenith/router` absent).
- Root `AGENTS.md` copied from the framework so future automation in this
  repo follows the same per-file 500-line cap and canonical-API constraints.

### Changed

- Removed the React-style `children` / `className` braced-expression
  heuristic in `src/project.ts`. Component prop inference now honors only
  the file's `interface Props { … }` or `type Props = { … }` declaration.
- Removed legacy `ROUTER_HOOKS`, `ROUTE_FIELDS`, and stale router functions
  (`prefetch`, `isActive`, `go`) from `src/router.ts`. The replacement
  `ROUTER_FUNCTIONS` catalog reflects the shipped `@zenithbuild/router`
  surface only.
- Refactored `src/server.ts` (1006 lines) downward into smaller modules to
  honor the 500-line cap:
  - `src/metadata/completion-metadata.ts` — `LIFECYCLE_HOOKS`,
    `PLATFORM_PRIMITIVES`, `HTML_ELEMENTS`, `HTML_ATTRIBUTES`, `DOM_EVENTS`.
  - `src/extractors.ts` — `getPositionContext`, `extractStates`,
    `extractFunctions`, `extractLoopVariables`, `getScriptContent`.
  - `src/completion.ts` — `provideCompletions(text, offset, graph)`.
  - `src/hover.ts` — `provideHover(text, offset, graph)`.
  - `src/server.ts` is now a thin LSP transport wiring layer.
- `<slot>` HTML element completion documentation now describes compile-time
  child injection and explicitly notes there is no `children` prop.
- ZenLink hover/completion now reflects the canonical `href` prop set and
  removes references to `to`, `preload`, `replace`, `activeClass`, and
  `children`.

## [0.7.14] - 2026-05-17

### 🐛 Bug Fixes

- ****lsp**: align completions and metadata with canonical Zenith API (0.7.13)** (89f6872)
  > Remove stale completions, teach signal via .get()/.set(), refresh metadata, and add API truth tests. Closes #4.

## [0.7.13] - 2026-05-17

### Changed

- Completion and hover items now teach only canonical Zenith API audited
  against the framework runtime (`packages/runtime/src/*`) and docs
  (`docs/documentation/**`):
  - `signal` completion snippet is `const count = signal(0); function
    incrementCount() { count.set(count.get() + 1); }` and the hover docs
    spell out `.get()` / `.set()` / `.subscribe(fn)`.
  - `state` completion is the declarative `state ${name} = ${initial}` form.
  - `ref` completion is `ref<HTMLElement>()`.
  - Platform primitive completions (`zenMount`, `zenEffect`, `zenWindow`,
    `zenDocument`, `zenOn`, `zenResize`, `collectRefs`) document the
    SSR-safety and `ctx.cleanup` contract.
  - Core module metadata for `zenith` and `zenith:server-contract` now
    matches the canonical `signal`, `state`, `ref`, `zenMount`, `zenEffect`,
    `zenWindow`, `zenDocument`, `zenOn`, `zenResize`, `collectRefs`,
    `allow`, `redirect`, `deny`, `data`, `invalid`, `json`, `text`,
    `download`, and `withMiddleware` surface.

### Removed

- Stale completion entries for `zenOnMount`, `zenOnDestroy`, `zenOnUpdate`,
  `zenRef`, `zenState` (React-tuple form), and `useFetch`. These names are
  not part of the current Zenith API and were teaching editor users
  framework-foreign idioms.
- The over-claim of “full IntelliSense” in the server source header. The
  package provides compiler-backed diagnostics, doc-backed completions, and
  limited hover content; syntax highlighting lives in
  `@zenithbuild/language`.

### Added

- API truth gates (`test/api-truth.spec.ts`) covering completion entries,
  core module metadata, and README canonical examples. Stale framework
  idioms such as Vue `.value`, React `useState`, Solid `createSignal`,
  Svelte `$:` and `{#if}/{#each}`, vanilla `onclick=`, React `onClick=`,
  and Vue `@click=` are blocked from editor-facing surfaces.
- End-to-end LSP stdio smoke tests that prove the patched language server
  surfaces canonical `signal` and `state` completions and never returns
  `count.value` (`test/lsp-stdio.spec.ts`).
- Pack-payload assertion script (`scripts/assert-pack-payload.mjs`) and a
  `verify:pack` npm script.
- `prepublishOnly` lifecycle that builds, runs the full test suite, and
  asserts the npm payload before publish.
- README header now points syntax highlighting users to
  `@zenithbuild/language`.

### Release

- CI release workflow publishes under `--tag next`. `latest` may only be
  promoted by a human after the Cursor and Neovim verification checklists
  pass on the published tarball.

## [0.7.12] - 2026-05-14

### Added

- Manual real-project Neovim verification checklist for installed language-server setup.
- Explicit npm package payload for the public bin, built language server, and checklist.

## [0.7.11] - 2026-05-14

### Added

- Public `zenith-language-server` bin entrypoint that defaults to stdio for plain LSP clients.
- Stdio LSP smoke coverage for initialization, diagnostics, hover, and completion.
- Headless Neovim smoke coverage with `nvim >= 0.10` gating.

### Changed

- Preserved explicit LSP transport arguments while defaulting no-arg launches to stdio.
- Updated README with Neovim setup and current language-server limitations.

## [0.6.0] - 2026-02-28

### Added

- `zenith.strictDomLints` setting: when `true`, ZEN-DOM-* diagnostics are errors; when `false`, hints
- Diagnostics from compiler JSON warnings (schemaVersion=1 contract)
- Debounce and cancellation for compile requests
- On-save validation
- Code actions for ZEN-DOM-* (querySelector → ref, addEventListener → zenOn)
- Code actions for window/document → zenWindow/zenDocument
- Completions for canonical primitives (ref, signal, state, zenOn, zenMount, etc.)

### Changed

- Requires @zenithbuild/compiler ^0.6.0 (schemaVersion + warnings contract)

## [0.2.8] - 2026-01-26

### 📝 Other Changes

- **** ()

## [0.2.1] - 2026-01-16

### 🐛 Bug Fixes

- **release**: use appendFileSync for GitHub Actions output (6804490)

### 📚 Documentation

- add comprehensive README and MIT license (deefb03)

### 📝 Other Changes

- 
0ce1eea203f4996a793e69bfcdbd698ed7f2df93 ()
- 
d7aa26a1ac00dec9f061e575118040e828ba4be5 ()
- 
b31fe125ca8732d21ee90c1ffef39df02bf1c2f0 ()
- 
1871b733741dc023b3bf5089189b89fa32cc7f1f ()
- 
ba3addf298e5752e0968e3a97f32ea99c35bfbaa ()
- removed node modules (8709b71)
- accidently uploaded node_modules (fa37f0f)
- 
02f92516f3aa5050189f284cf4c8293bca3e25a8 ()
- 
58acde512541446d1008d0dbb154aee69410be87 ()
-  ()
