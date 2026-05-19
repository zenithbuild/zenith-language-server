/**
 * Branded completion metadata for Zenith-owned LSP items.
 *
 * Ranking uses early `sortText` / `preselect` only for prefix-relevant items so
 * unrelated primitives do not dominate unrelated contexts.
 */

import { MarkupKind } from 'vscode-languageserver/node';
import type { MarkupContent } from 'vscode-languageserver/node';

/** Canonical doc paths from framework editor-integration contract (text only). */
export const DOC_PATHS = {
    reactivity: 'docs/documentation/reactivity/reactivity-model.md',
    effectsVsMount: 'docs/documentation/reactivity/effects-vs-mount.md',
    domEnv: 'docs/documentation/reactivity/dom-and-environment.md',
    events: 'docs/documentation/syntax/events.md'
} as const;

/**
 * Lexicographically early sort key. Lower `rank` sorts earlier among Zenith items.
 */
export function zenithSortText(rank: number, label: string): string {
    return `!${String(rank).padStart(2, '0')}_${label}`;
}

export function zenithDetail(surface: string, signature: string): string {
    return `Zenith ${surface}: ${signature}`;
}

export function withDocsLine(body: string, docPath: string): string {
    const trimmed = body.trimEnd();
    return `${trimmed}\n\n**Docs:** \`${docPath}\``;
}

export function markdownDoc(body: string, docPath?: string): MarkupContent {
    const value = docPath ? withDocsLine(body, docPath) : body;
    return { kind: MarkupKind.Markdown, value };
}

/** Preselect `signal` when the user is typing a `sig` prefix (not bare `s`). */
export function shouldPreselectSignal(currentWord: string): boolean {
    const w = currentWord.toLowerCase();
    return w.length >= 2 && w.startsWith('sig');
}

/** Preselect declarative `state` keyword when prefix is `s`/`st`/`sta` but not `sig`. */
export function shouldPreselectDeclarativeState(currentWord: string): boolean {
    const w = currentWord.toLowerCase();
    if (!w || w.startsWith('sig')) {
        return false;
    }
    return w === 's' || w.startsWith('st') || w.startsWith('sta');
}

/** Member items in receiver context: always rank early (only Zenith members returned). */
export function memberSortText(index: number, label: string): string {
    return zenithSortText(index, label);
}

export function memberPreselect(label: string, memberPrefix: string): boolean {
    const p = memberPrefix.toLowerCase();
    if (!p) {
        return label === 'get';
    }
    return label.toLowerCase().startsWith(p);
}
