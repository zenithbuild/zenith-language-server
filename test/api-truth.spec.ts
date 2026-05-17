/**
 * API truth gates for the Zenith language server.
 *
 * Scope (context-aware, NOT repo-wide):
 *   - Completion item snippets / labels / docs surfaced to editors
 *   - Hover content surfaced to editors
 *   - Core module metadata served via the LSP imports module
 *   - README markdown (excluding fenced "forbidden" / "legacy" examples)
 *
 * Purpose:
 *   - Prove completion and hover responses only teach the current canonical
 *     Zenith API (signal().get() / .set(), state x = 0, ref<T>(), zenMount,
 *     zenOn, zenWindow, zenDocument, etc.).
 *   - Block re-introduction of stale framework idioms (Vue .value, React
 *     hooks, Solid createSignal, Svelte $:, Svelte {#if}, vanilla onclick=,
 *     etc.).
 *
 * Source-of-truth audit:
 *   - signal: framework/packages/runtime/src/signal.ts (.get()/.set(), no .value)
 *   - state:  framework/docs/documentation/reactivity/reactivity-model.md
 *             framework/packages/runtime/src/state.ts (state({...}) object store)
 *   - events: framework/docs/documentation/syntax/events.md (on:click={handler})
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { CORE_MODULES } from '../src/metadata/core-imports';

const ROOT = path.resolve(__dirname, '..');
const SERVER_SOURCE_PATH = path.join(ROOT, 'src', 'server.ts');
const README_PATH = path.join(ROOT, 'README.md');

const STALE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
    { label: 'Vue-style `.value` access', regex: /\.value\b/ },
    { label: 'React `useState(` hook', regex: /\buseState\s*\(/ },
    { label: 'React namespace `React.`', regex: /\bReact\./ },
    { label: 'Solid `createSignal(`', regex: /\bcreateSignal\s*\(/ },
    { label: 'Vue `computed(`', regex: /\bcomputed\s*\(/ },
    { label: 'Vue `watch(` reactive', regex: /\bwatch\s*\(/ },
    { label: 'Svelte `$:` reactive statement', regex: /(^|\s)\$:\s/ },
    { label: 'Svelte `{#if` / `{#each` / `{:else}` templates', regex: /\{(#if|#each|:else|\/if|\/each)\b/ },
    { label: 'HTML `onclick=` inline handler', regex: /\bonclick\s*=/ },
    { label: 'React `onClick=` handler', regex: /\bonClick\s*=/ },
    { label: 'Vue `@click=` handler', regex: /@click\s*=/ },
    { label: 'Legacy `zenOnMount` name', regex: /\bzenOnMount\b/ },
    { label: 'Legacy `zenOnDestroy` name', regex: /\bzenOnDestroy\b/ },
    { label: 'Legacy `zenOnUpdate` name', regex: /\bzenOnUpdate\b/ },
    { label: 'Legacy `zenRef` name', regex: /\bzenRef\b/ },
    { label: 'Phantom `useFetch(` API', regex: /\buseFetch\s*\(/ }
];

function assertNoStalePatterns(label: string, text: string): void {
    for (const { label: patternLabel, regex } of STALE_PATTERNS) {
        const match = regex.exec(text);
        if (match) {
            throw new assert.AssertionError({
                message: `${label} contains stale pattern (${patternLabel}). Offending match: ${JSON.stringify(match[0])}`,
                actual: match[0],
                expected: 'no stale pattern',
                operator: 'no-stale-pattern'
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Server source: scoped extraction of canonical completion arrays
// ---------------------------------------------------------------------------

function extractBlock(source: string, startMarker: RegExp): string {
    const startMatch = startMarker.exec(source);
    if (!startMatch) {
        throw new Error(`Cannot find block starting with ${startMarker}`);
    }
    const startIndex = startMatch.index + startMatch[0].length;
    let depth = 1;
    let i = startIndex;
    while (i < source.length && depth > 0) {
        const ch = source[i];
        if (ch === '[') depth += 1;
        else if (ch === ']') depth -= 1;
        i += 1;
    }
    if (depth !== 0) {
        throw new Error(`Unterminated block for ${startMarker}`);
    }
    return source.slice(startIndex, i - 1);
}

/**
 * Extract literal string values for a given field (`snippet:` or `signature:`).
 *
 * Only typed-into-code surfaces are scanned for forbidden patterns. Description
 * / doc text is allowed to explain that, e.g., `.value` is not the API.
 */
function extractFieldStrings(block: string, field: string): string[] {
    const re = new RegExp(`${field}:\\s*(['\`])((?:\\\\.|(?!\\1).)*)\\1`, 'g');
    const strings: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(block)) !== null) {
        strings.push(match[2]);
    }
    return strings;
}

const serverSource = fs.readFileSync(SERVER_SOURCE_PATH, 'utf8');
const lifecycleBlock = extractBlock(serverSource, /const LIFECYCLE_HOOKS\s*=\s*\[/);
const platformBlock = extractBlock(serverSource, /const PLATFORM_PRIMITIVES\s*=\s*\[/);

function assertCompletionEntriesAreClean(label: string, block: string): void {
    for (const snippet of extractFieldStrings(block, 'snippet')) {
        assertNoStalePatterns(`${label} snippet`, snippet);
    }
    for (const labelText of extractFieldStrings(block, 'name')) {
        assertNoStalePatterns(`${label} entry name "${labelText}"`, labelText);
    }
}

test('LIFECYCLE_HOOKS only exposes canonical reactivity entries', () => {
    assertCompletionEntriesAreClean('LIFECYCLE_HOOKS', lifecycleBlock);
    assert.match(lifecycleBlock, /name:\s*'state'/, 'must surface declarative `state`');
    assert.match(lifecycleBlock, /name:\s*'zenMount'/, 'must surface `zenMount`');
    assert.match(lifecycleBlock, /name:\s*'zenEffect'/, 'must surface `zenEffect`');
});

test('PLATFORM_PRIMITIVES only exposes canonical platform/runtime entries', () => {
    assertCompletionEntriesAreClean('PLATFORM_PRIMITIVES', platformBlock);
    for (const name of ['signal', 'ref', 'zenWindow', 'zenDocument', 'zenOn', 'zenResize', 'collectRefs']) {
        assert.match(platformBlock, new RegExp(`name:\\s*'${name}'`), `must surface \`${name}\``);
    }
});

test('signal completion snippet teaches canonical `.get()` / `.set()` API', () => {
    const snippets = extractFieldStrings(platformBlock, 'snippet');
    const signalSnippet = snippets.find((s) => /signal\(/.test(s));
    assert.ok(signalSnippet, 'signal completion must have a snippet');
    assert.match(signalSnippet!, /\.set\(/, 'signal snippet must teach `.set(...)`');
    assert.match(signalSnippet!, /\.get\(\)/, 'signal snippet must teach `.get()`');
});

test('ref completion snippet uses canonical `ref<T>()` form', () => {
    const snippets = extractFieldStrings(platformBlock, 'snippet');
    const refSnippet = snippets.find((s) => /^ref</.test(s));
    assert.ok(refSnippet, 'ref completion must have a snippet');
    assert.match(refSnippet!, /^ref<\$\{1:HTMLElement\}>\(\)$/, 'ref snippet must be `ref<HTMLElement>()`');
});

test('state completion snippet uses declarative `state name = initial` form', () => {
    const snippets = extractFieldStrings(lifecycleBlock, 'snippet');
    const stateSnippet = snippets.find((s) => /^state\s+\$\{1:name\}/.test(s));
    assert.ok(stateSnippet, 'state completion must have a declarative snippet');
});

// ---------------------------------------------------------------------------
// Core module metadata: zenith and zenith:server-contract
// ---------------------------------------------------------------------------

test('zenith core module metadata describes canonical signal/state/ref API', () => {
    const zenith = CORE_MODULES['zenith'];
    assert.ok(zenith, 'zenith core module metadata must exist');

    const names = zenith.exports.map((e) => e.name);
    for (const expected of [
        'signal', 'state', 'ref', 'zenEffect', 'zenMount',
        'zenWindow', 'zenDocument', 'zenOn', 'zenResize', 'collectRefs'
    ]) {
        assert.ok(
            names.includes(expected),
            `zenith core metadata must surface \`${expected}\``
        );
    }

    const stale = ['zenOnMount', 'zenOnDestroy', 'zenOnUpdate', 'zenRef', 'zenState', 'useFetch'];
    for (const name of stale) {
        assert.ok(
            !names.includes(name),
            `zenith core metadata must NOT surface stale \`${name}\``
        );
    }

    const signalExport = zenith.exports.find((e) => e.name === 'signal');
    assert.ok(signalExport, 'signal export must exist');
    assert.match(signalExport!.description, /\.get\(\)/);
    assert.match(signalExport!.description, /\.set\(/);
    // Description prose may explain that `.value` is NOT the API; the signature
    // (typed-into-code surface) is the authoritative gate against teaching it.
    assert.match(signalExport!.signature!, /get\(\):\s*T/);
    assert.match(signalExport!.signature!, /set\(/);
    assert.doesNotMatch(signalExport!.signature!, /\.value/);
});

test('zenith:server-contract module metadata surfaces canonical result helpers', () => {
    const sc = CORE_MODULES['zenith:server-contract'];
    assert.ok(sc, 'zenith:server-contract metadata must exist');

    const names = sc.exports.map((e) => e.name);
    for (const expected of ['allow', 'redirect', 'deny', 'data', 'withMiddleware']) {
        assert.ok(
            names.includes(expected),
            `server-contract metadata must surface \`${expected}\``
        );
    }
});

test('all core module export names/signatures are free of stale framework syntax', () => {
    // Signatures get inserted into TS type tooltips/snippets; descriptions are
    // free prose and may explain that, e.g., `.value` is NOT the Zenith API.
    for (const [moduleName, meta] of Object.entries(CORE_MODULES)) {
        for (const exp of meta.exports) {
            const typedBlob = `${exp.name}\n${exp.signature ?? ''}`;
            assertNoStalePatterns(
                `core export ${moduleName}::${exp.name} (name/signature)`,
                typedBlob
            );
        }
    }
});

// ---------------------------------------------------------------------------
// README: canonical fenced examples must not teach stale syntax
// ---------------------------------------------------------------------------

interface FencedBlock {
    info: string;
    startLine: number;
    body: string;
}

function extractFencedExamples(markdown: string): FencedBlock[] {
    const blocks: FencedBlock[] = [];
    const lines = markdown.split('\n');
    let inFence = false;
    let fenceInfo = '';
    let buffer: string[] = [];
    let blockStartLine = 0;

    lines.forEach((line, idx) => {
        const fenceMatch = /^```(.*)$/.exec(line);
        if (fenceMatch) {
            if (!inFence) {
                inFence = true;
                fenceInfo = fenceMatch[1].trim().toLowerCase();
                buffer = [];
                blockStartLine = idx + 1;
            } else {
                blocks.push({ info: fenceInfo, startLine: blockStartLine, body: buffer.join('\n') });
                inFence = false;
            }
            return;
        }
        if (inFence) {
            buffer.push(line);
        }
    });

    return blocks;
}

function isExplicitlyLegacyBlock(info: string): boolean {
    return /(legacy|invalid|forbidden|wrong|bad|do-?not|never|invalid-)/i.test(info);
}

test('README canonical examples do not teach stale framework syntax', { skip: !fs.existsSync(README_PATH) }, () => {
    const readme = fs.readFileSync(README_PATH, 'utf8');
    const blocks = extractFencedExamples(readme);
    for (const block of blocks) {
        if (isExplicitlyLegacyBlock(block.info)) continue;
        assertNoStalePatterns(
            `README fenced block starting at line ${block.startLine} (info="${block.info}")`,
            block.body
        );
    }
});
