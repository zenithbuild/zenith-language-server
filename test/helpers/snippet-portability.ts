/**
 * Guards LSP completion snippets against VS Code-only transform syntax that
 * Neovim's built-in vim.snippet parser cannot parse.
 */

import { LIFECYCLE_HOOKS, PLATFORM_PRIMITIVES } from '../../src/metadata/completion-metadata';

/** VS Code regex/transform placeholders — forbidden in portable LSP snippets. */
export const FORBIDDEN_SNIPPET_PATTERNS: Array<{ label: string; regex: RegExp }> = [
    { label: 'regex transform opener ${n/', regex: /\$\{\d+\// },
    { label: 'transform modifier :/capitalize', regex: /:\/capitalize/ },
    { label: 'transform modifier :/upcase', regex: /:\/upcase/ },
    { label: 'transform modifier :/downcase', regex: /:\/downcase/ },
    { label: 'nested regex transform ${n/(.*)/', regex: /\$\{\d+\/\(.*\)/ }
];

export function collectCatalogSnippets(): string[] {
    const snippets: string[] = [];
    for (const entry of LIFECYCLE_HOOKS) {
        snippets.push(entry.snippet);
    }
    for (const entry of PLATFORM_PRIMITIVES) {
        snippets.push(entry.snippet);
    }
    return snippets;
}

export function assertPortableSnippet(label: string, snippet: string): void {
    for (const { label: patternLabel, regex } of FORBIDDEN_SNIPPET_PATTERNS) {
        const match = regex.exec(snippet);
        if (match) {
            throw new Error(
                `${label} snippet contains VS Code-only syntax (${patternLabel}): ${JSON.stringify(match[0])}`
            );
        }
    }
}
