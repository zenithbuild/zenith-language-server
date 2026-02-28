# @zenithbuild/language-server v0.6.0

## Summary

- ZEN-DOM-* diagnostics from compiler JSON; severity flips with `strictDomLints`
- Debounced diagnostics (150ms) + on-save validation; last edit wins
- Code actions for ZEN-DOM-QUERY, ZEN-DOM-LISTENER, ZEN-DOM-WRAPPER + window/document convenience

## Breaking Changes

None.

## Key Changes

- **Diagnostics:** Surface compiler `warnings` as LSP diagnostics; `strictDomLints` setting (warning → error)
- **Debounce:** 150ms idle before validation; immediate validation on save
- **Cancellation:** Only latest validation sends diagnostics
- **Code actions:** Suppress/ref for ZEN-DOM-QUERY; zenOn template for ZEN-DOM-LISTENER; zenWindow/zenDocument for ZEN-DOM-WRAPPER
- **Convenience:** "Replace with zenWindow()" / "Replace with zenDocument()" on identifier selection (no diagnostic required)
- **Completions:** zenMount, zenWindow, zenDocument, zenOn, zenResize, collectRefs, signal, ref; soft suggestions for window/document

## Diagnostics / UX Highlights

| Code | Default | strictDomLints: true |
|------|---------|---------------------|
| ZEN-DOM-QUERY | Warning | Error |
| ZEN-DOM-LISTENER | Warning | Error |
| ZEN-DOM-WRAPPER | Warning | Error |

## Upgrade Notes

Requires `@zenithbuild/compiler` with JSON `schemaVersion` and `warnings` (v0.6.0+).

## Verification Checklist

- [ ] Type `document.querySelector(` → ZEN-DOM-QUERY warning + quick fixes
- [ ] Toggle `zenith.strictDomLints` → severity flips to error
- [ ] Select `window` → "Replace with zenWindow()" code action
- [ ] Rapid typing does not spawn excessive compiler processes
