/** Completion/hover/core-metadata truth gates (scoped). See framework runtime + AGENTS.md. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { CORE_MODULES } from '../src/metadata/core-imports';
import {
    HTML_ATTRIBUTES,
    HTML_ELEMENTS,
    LIFECYCLE_HOOKS,
    PLATFORM_PRIMITIVES
} from '../src/metadata/completion-metadata';
import { ROUTER_FUNCTIONS, ZENLINK_PROPS } from '../src/router';
import { membersForReceiver } from '../src/metadata/receiver-members';
import {
    assertPortableSnippet,
    collectCatalogSnippets
} from './helpers/snippet-portability';

const ROOT = path.resolve(__dirname, '..');
const COMPLETION_METADATA_PATH = path.join(ROOT, 'src', 'metadata', 'completion-metadata.ts');
const COMPLETION_SOURCE_PATH = path.join(ROOT, 'src', 'completion.ts');
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
    { label: 'Phantom `useFetch(` API', regex: /\buseFetch\s*\(/ },
    { label: 'React `children:` prop', regex: /\bchildren\s*:/ },
    { label: 'React `ReactNode` type', regex: /\bReactNode\b/ },
    { label: 'React `PropsWithChildren` helper', regex: /\bPropsWithChildren\b/ },
    { label: 'React `className=` attribute', regex: /\bclassName\s*=/ },
    { label: 'Legacy router hook `useRoute(`', regex: /\buseRoute\s*\(/ },
    { label: 'Legacy router hook `useRouter(`', regex: /\buseRouter\s*\(/ },
    { label: 'Stale router function `prefetch(`', regex: /\bprefetch\s*\(/ },
    { label: 'Stale router function `isActive(`', regex: /\bisActive\s*\(/ },
    { label: 'Stale router function `getRoute(`', regex: /\bgetRoute\s*\(/ },
    { label: 'Legacy router module id `zenith/router`', regex: /['"]zenith\/router['"]/ }
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

const completionMetadataSource = fs.readFileSync(COMPLETION_METADATA_PATH, 'utf8');
const lifecycleBlock = extractBlock(completionMetadataSource, /const LIFECYCLE_HOOKS\s*:[^\n]*=\s*\[/);
const platformBlock = extractBlock(completionMetadataSource, /const PLATFORM_PRIMITIVES\s*:[^\n]*=\s*\[/);

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
    const required = [
        'signal',
        'state',
        'ref',
        'zeneffect',
        'effect',
        'mount',
        'zenPresence',
        'presence',
        'hydrate',
        'zenWindow',
        'zenDocument',
        'zenOn',
        'zenResize',
        'collectRefs'
    ];
    for (const name of required) {
        assert.match(platformBlock, new RegExp(`name:\\s*'${name}'`), `must surface \`${name}\``);
    }
});

test('signal completion snippet teaches canonical `.get()` / `.set()` API', () => {
    const snippets = extractFieldStrings(platformBlock, 'snippet');
    const signalSnippet = snippets.find((s) => /signal\(/.test(s));
    assert.ok(signalSnippet, 'signal completion must have a snippet');
    assertPortableSnippet('PLATFORM_PRIMITIVES signal', signalSnippet!);
    assert.match(signalSnippet!, /\.set\(/, 'signal snippet must teach `.set(...)`');
    assert.match(signalSnippet!, /\.get\(\)/, 'signal snippet must teach `.get()`');
    assert.doesNotMatch(signalSnippet!, /\$\{\d+\//, 'signal snippet must not use VS Code regex transforms');
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
        'signal',
        'state',
        'ref',
        'zenEffect',
        'zenMount',
        'zeneffect',
        'effect',
        'mount',
        'zenPresence',
        'presence',
        'hydrate',
        'zenWindow',
        'zenDocument',
        'zenOn',
        'zenResize',
        'collectRefs'
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
// Router + ZenLink truth: canonical `@zenithbuild/router` surface only
// ---------------------------------------------------------------------------

test('CORE_MODULES exposes @zenithbuild/router and ZenLink subpath; no legacy zenith/router', () => {
    assert.ok(
        CORE_MODULES['@zenithbuild/router'],
        '@zenithbuild/router metadata must exist'
    );
    assert.ok(
        CORE_MODULES['@zenithbuild/router/ZenLink.zen'],
        '@zenithbuild/router/ZenLink.zen metadata must exist'
    );
    assert.equal(
        CORE_MODULES['zenith/router'],
        undefined,
        'legacy `zenith/router` virtual module must not be re-introduced'
    );
});

test('@zenithbuild/router exports canonical navigation surface, no hook-style API', () => {
    const router = CORE_MODULES['@zenithbuild/router'];
    const names = router.exports.map((e) => e.name);
    for (const expected of [
        'createRouter', 'navigate', 'refreshCurrentRoute', 'back', 'forward',
        'getCurrentPath', 'onRouteChange', 'on', 'off',
        'setAdvisoryRoutePolicy', 'zenNavigationShell', 'matchRoute'
    ]) {
        assert.ok(names.includes(expected), `router metadata must surface \`${expected}\``);
    }
    for (const stale of ['useRoute', 'useRouter', 'prefetch', 'isActive', 'getRoute', 'go']) {
        assert.ok(
            !names.includes(stale),
            `router metadata must NOT surface stale \`${stale}\``
        );
    }
});

test('ROUTER_FUNCTIONS catalog matches canonical router surface', () => {
    const names = ROUTER_FUNCTIONS.map((fn) => fn.name);
    assert.ok(names.includes('navigate'), 'must surface `navigate`');
    assert.ok(names.includes('createRouter'), 'must surface `createRouter`');
    assert.ok(names.includes('getCurrentPath'), 'must surface `getCurrentPath`');
    for (const stale of ['useRoute', 'useRouter', 'prefetch', 'isActive', 'getRoute', 'go']) {
        assert.ok(
            !names.includes(stale),
            `ROUTER_FUNCTIONS must NOT surface stale \`${stale}\``
        );
    }
    for (const fn of ROUTER_FUNCTIONS) {
        assertNoStalePatterns(
            `ROUTER_FUNCTIONS entry ${fn.name} (signature)`,
            `${fn.name}\n${fn.signature}`
        );
    }
});

test('ZENLINK_PROPS catalog matches canonical Props from ZenLink.zen', () => {
    const names = ZENLINK_PROPS.map((p) => p.name);
    assert.ok(names.includes('href'), 'ZenLink must surface `href` prop');
    const required = ZENLINK_PROPS.filter((p) => p.required).map((p) => p.name);
    assert.deepEqual(required, ['href'], 'only `href` is required on ZenLink');
    for (const stale of ['to', 'preload', 'replace', 'activeClass', 'children']) {
        assert.ok(
            !names.includes(stale),
            `ZenLink must NOT surface stale \`${stale}\``
        );
    }
    for (const prop of ZENLINK_PROPS) {
        assertNoStalePatterns(`ZenLink prop ${prop.name}`, `${prop.name}\n${prop.type}`);
    }
});

// ---------------------------------------------------------------------------
// Editor-owned catalogs: no React-style children/className suggestions
// ---------------------------------------------------------------------------

test('HTML_ATTRIBUTES catalog does not surface React-style attributes', () => {
    const attrs = new Set<string>(HTML_ATTRIBUTES);
    for (const stale of ['className', 'children', 'htmlFor', 'tabIndex']) {
        assert.ok(
            !attrs.has(stale),
            `HTML_ATTRIBUTES must not surface React-style "${stale}"`
        );
    }
});

test('HTML_ELEMENTS slot doc teaches the implicit slot, not children', () => {
    const slot = HTML_ELEMENTS.find((el) => el.tag === 'slot');
    assert.ok(slot, 'slot HTML element entry must exist');
    assert.match(
        slot!.doc,
        /implicit slot/i,
        'slot doc must explain compile-time implicit slot semantics'
    );
});

test('completion.ts does not infer React-style children/className from braced expressions', () => {
    const source = fs.readFileSync(COMPLETION_SOURCE_PATH, 'utf8');
    assert.doesNotMatch(
        source,
        /usagePatterns.*\bchildren\b/,
        'completion provider must not list `children` in any usage-pattern inference'
    );
    assert.doesNotMatch(
        source,
        /usagePatterns.*\bclassName\b/,
        'completion provider must not list `className` in any usage-pattern inference'
    );
});

test('project.ts only honors `interface Props { … }` for prop inference', () => {
    const projectSource = fs.readFileSync(path.join(ROOT, 'src', 'project.ts'), 'utf8');
    // Strip line and block comments so doc prose explaining forbidden patterns
    // is not flagged as a stale teaching surface.
    const codeOnly = projectSource
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n');
    assert.doesNotMatch(
        codeOnly,
        /\bclassName\b/,
        'project.ts code must not reference `className` outside doc comments'
    );
    assert.doesNotMatch(
        codeOnly,
        /matchAll\([^)]*children[^)]*\)/,
        'project.ts must not infer `children` from braced expressions'
    );
});

// ---------------------------------------------------------------------------
// Receiver member catalog: framework runtime truth (signal/state/ref)
// ---------------------------------------------------------------------------

test('signal receiver members match framework runtime truth (get/set/subscribe)', () => {
    const members = membersForReceiver('signal');
    const labels = members.map((m) => m.label);
    assert.deepEqual(labels, ['get', 'set', 'subscribe'], 'signal exposes get/set/subscribe only');

    const set = members.find((m) => m.label === 'set')!;
    assert.match(set.detail, /Zenith Signal\.set/, 'signal.set must be branded per editor contract');

    const get = members.find((m) => m.label === 'get')!;
    assert.match(get.detail, /Zenith Signal\.get/);

    const subscribe = members.find((m) => m.label === 'subscribe')!;
    assert.match(subscribe.detail, /Zenith Signal\.subscribe/);

    for (const member of members) {
        assertNoStalePatterns(`receiver-members signal ${member.label}`, `${member.label}\n${member.detail}`);
    }
});

test('runtime state receiver members match framework state.ts (Readonly<T> snapshots)', () => {
    const members = membersForReceiver('runtimeState');
    const labels = members.map((m) => m.label);
    assert.deepEqual(labels, ['get', 'set', 'subscribe']);

    const get = members.find((m) => m.label === 'get')!;
    assert.match(get.detail, /Zenith State\.get/);

    const set = members.find((m) => m.label === 'set')!;
    assert.match(set.detail, /Zenith State\.set/);
});

test('ref receiver members expose only `current`', () => {
    const members = membersForReceiver('ref');
    const labels = members.map((m) => m.label);
    assert.deepEqual(labels, ['current']);

    const current = members[0];
    assert.match(current.detail, /Zenith Ref\.current/);
});

test('declarativeState and unknown receivers expose no members (no fake signal API)', () => {
    assert.deepEqual(membersForReceiver('declarativeState'), []);
    assert.deepEqual(membersForReceiver('unknown'), []);
});

test('all completion catalog snippets are portable (no VS Code transform syntax)', () => {
    for (const snippet of collectCatalogSnippets()) {
        assertPortableSnippet('completion catalog', snippet);
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
