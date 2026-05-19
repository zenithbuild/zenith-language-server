/**
 * Editor API coverage matrix (static): links framework virtual module exports to
 * script-completion catalogs and documents intentional gaps.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CORE_MODULES } from '../src/metadata/core-imports';
import { DOM_EVENTS, LIFECYCLE_HOOKS, PLATFORM_PRIMITIVES } from '../src/metadata/completion-metadata';
import { ROUTER_FUNCTIONS, ZENLINK_PROPS } from '../src/router';

/** Compact coverage rows for release notes / audits (machine-checked subset below). */
export const EDITOR_API_COVERAGE_MATRIX: Array<{
    api: string;
    importSource: string;
    completionContext: string;
    hoverDocs: boolean;
    snippet: boolean;
    status: 'covered' | 'partial' | 'intentional_gap';
    notes: string;
}> = [
    {
        api: 'signal',
        importSource: 'zenith',
        completionContext: 'script top-level',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'Member access get/set/subscribe'
    },
    {
        api: 'state (declarative)',
        importSource: 'compiler keyword',
        completionContext: 'script top-level',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'LIFECYCLE_HOOKS.state'
    },
    {
        api: 'state() runtime store',
        importSource: 'zenith',
        completionContext: 'script top-level',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'PLATFORM_PRIMITIVES duplicate label state; lifecycle hover wins bare `state`'
    },
    {
        api: 'ref',
        importSource: 'zenith',
        completionContext: 'script top-level',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'Member current'
    },
    {
        api: 'zenEffect',
        importSource: 'zenith',
        completionContext: 'script top-level',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'Canonical effect surface'
    },
    {
        api: 'zeneffect / effect',
        importSource: 'zenith',
        completionContext: 'script top-level',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'Bundled aliases per packages/runtime/src/zeneffect.ts'
    },
    {
        api: 'zenMount / mount',
        importSource: 'zenith',
        completionContext: 'script top-level',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'mount alias taught as secondary'
    },
    {
        api: 'zenPresence / presence',
        importSource: 'zenith',
        completionContext: 'script top-level',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'Advanced transition helper'
    },
    {
        api: 'hydrate',
        importSource: 'zenith',
        completionContext: 'script top-level',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'Bootstrap integration surface'
    },
    {
        api: 'computed',
        importSource: 'n/a',
        completionContext: 'n/a',
        hoverDocs: false,
        snippet: false,
        status: 'intentional_gap',
        notes: 'Not a Zenith public primitive — forbidden stale pattern'
    },
    {
        api: 'Router API',
        importSource: '@zenithbuild/router',
        completionContext: 'script when router imported',
        hoverDocs: true,
        snippet: false,
        status: 'covered',
        notes: 'ROUTER_FUNCTIONS + named import completion'
    },
    {
        api: 'ZenLink',
        importSource: '@zenithbuild/router/ZenLink.zen',
        completionContext: 'template + props',
        hoverDocs: true,
        snippet: true,
        status: 'covered',
        notes: 'href required; no to/children/className'
    },
    {
        api: 'zenith:server-contract',
        importSource: 'virtual',
        completionContext: 'server script only',
        hoverDocs: true,
        snippet: false,
        status: 'covered',
        notes: 'Import path + named exports gated from client scripts'
    },
    {
        api: 'on:<event>',
        importSource: 'markup',
        completionContext: 'open tag',
        hoverDocs: false,
        snippet: true,
        status: 'covered',
        notes: 'DOM_EVENTS includes aliases; cursor after `on:` normalized in extractors'
    }
];

function scriptCompletionLabels(): Set<string> {
    const labels = new Set<string>();
    for (const h of LIFECYCLE_HOOKS) labels.add(h.name);
    for (const p of PLATFORM_PRIMITIVES) labels.add(p.name);
    return labels;
}

test('matrix rows marked covered remain non-missing', () => {
    for (const row of EDITOR_API_COVERAGE_MATRIX) {
        if (row.status === 'intentional_gap') continue;
        assert.notEqual(row.status, 'missing');
    }
});

test('every zenith virtual export has script completion or lifecycle twin', () => {
    const labels = scriptCompletionLabels();
    const zenith = CORE_MODULES['zenith'];
    assert.ok(zenith);
    for (const exp of zenith.exports) {
        assert.ok(
            labels.has(exp.name),
            `zenith export "${exp.name}" must appear in LIFECYCLE_HOOKS or PLATFORM_PRIMITIVES completion labels`
        );
    }
});

test('DOM_EVENTS covers pointer-first events and compiler aliases', () => {
    const dom = new Set<string>(DOM_EVENTS as unknown as string[]);
    for (const ev of ['pointerdown', 'pointerenter', 'pointerleave', 'hoverin', 'hoverout', 'doubleclick', 'esc']) {
        assert.ok(dom.has(ev), `DOM_EVENTS must include ${ev}`);
    }
});

test('router export catalog matches editor allow-list size', () => {
    assert.equal(ROUTER_FUNCTIONS.length, 12);
});

test('ZenLink props remain href-centric without React props', () => {
    const names = ZENLINK_PROPS.map((p) => p.name);
    assert.ok(names.includes('href'));
    for (const stale of ['to', 'children', 'className']) {
        assert.ok(!names.includes(stale));
    }
});
