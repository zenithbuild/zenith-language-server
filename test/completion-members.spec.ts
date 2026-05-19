/**
 * Context-aware member completion (LSP stdio).
 *
 * Validates the contract from the type-aware completion plan:
 *   - `count.` after `const count = signal(0)` -> get/set/subscribe only
 *   - `el.` after `const el = ref<...>()`      -> current only
 *   - `thing.` (unknown receiver)              -> empty, NOT a primitive dump
 *   - declarative `state x = 0; x.`            -> empty (no fake signal members)
 *   - Top-level `sig` prefix in script         -> signal still surfaced
 *   - Existing router / ZenLink completion paths still pass
 *   - Stale APIs never reappear (`value`, `useState`, `useRoute`, ...)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    openTextDocument,
    positionOf,
    withClient
} from './helpers/lsp-stdio';

const FORBIDDEN_MEMBER_LABELS = ['value', 'useState', 'useRoute', 'useRouter', 'createSignal'];

function labelsOf(completion: any): string[] {
    return Array.isArray(completion) ? completion.map((item: any) => String(item.label ?? '')) : [];
}

test('member completion on `signal(...)` binding surfaces get/set/subscribe only', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/member-signal.zen';
        const text = '<script lang="ts">\nconst count = signal(0);\ncount.\n</script>\n<p>{count}</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'count.\n', 6)
        });

        const labels = labelsOf(completion);
        const expected = ['get', 'set', 'subscribe'];
        for (const name of expected) {
            assert.ok(labels.includes(name), `signal member completion must include "${name}", got ${JSON.stringify(labels)}`);
        }

        for (const forbidden of FORBIDDEN_MEMBER_LABELS) {
            assert.ok(!labels.includes(forbidden), `signal member completion must NOT include stale "${forbidden}"`);
        }

        for (const primitive of ['signal', 'state', 'ref', 'zenMount', 'zenEffect', 'zenOn', 'zenResize', 'collectRefs']) {
            assert.ok(
                !labels.includes(primitive),
                `signal member completion must not dump top-level primitive "${primitive}"`
            );
        }

        const setItem = completion.find((item: any) => item.label === 'set');
        assert.match(String(setItem.detail ?? ''), /set\(nextValue: T\): T/, 'set detail must match runtime signature (returns T, not void)');
    });
});

test('member completion on `ref(...)` binding surfaces only `current`', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/member-ref.zen';
        const text = '<script lang="ts">\nconst el = ref<HTMLDivElement>();\nel.\n</script>\n<div></div>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'el.\n', 3)
        });

        const labels = labelsOf(completion);
        assert.ok(labels.includes('current'), `ref member completion must include "current", got ${JSON.stringify(labels)}`);
        assert.equal(labels.length, 1, 'ref exposes exactly one member (current)');

        for (const forbidden of [...FORBIDDEN_MEMBER_LABELS, 'get', 'set', 'subscribe', 'signal', 'ref', 'state']) {
            assert.ok(!labels.includes(forbidden), `ref member completion must NOT include "${forbidden}"`);
        }
    });
});

test('member completion on `state(...)` runtime store surfaces get/set/subscribe', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/member-runtime-state.zen';
        const text = '<script lang="ts">\nconst store = state({ count: 0 });\nstore.\n</script>\n<p>x</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'store.\n', 6)
        });

        const labels = labelsOf(completion);
        for (const name of ['get', 'set', 'subscribe']) {
            assert.ok(labels.includes(name), `runtime state member completion must include "${name}"`);
        }
        for (const forbidden of FORBIDDEN_MEMBER_LABELS) {
            assert.ok(!labels.includes(forbidden), `runtime state member completion must NOT include "${forbidden}"`);
        }
    });
});

test('member completion on unknown receiver returns an empty list (no primitive dump)', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/member-unknown.zen';
        const text = '<script lang="ts">\nconst thing = {};\nthing.\n</script>\n<p>x</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'thing.\n', 6)
        });

        assert.ok(Array.isArray(completion), 'completion result must be an array');
        assert.equal(completion.length, 0, `unknown receiver must produce no completions; got ${JSON.stringify(labelsOf(completion))}`);
    });
});

test('member completion on declarative `state name = ...` returns no fake signal members', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/member-declarative.zen';
        const text = '<script lang="ts">\nstate count = 0\ncount.\n</script>\n<p>{count}</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'count.\n', 6)
        });

        const labels = labelsOf(completion);
        for (const fake of ['get', 'set', 'subscribe', 'value']) {
            assert.ok(
                !labels.includes(fake),
                `declarative state must NOT teach signal-style "${fake}" member, got ${JSON.stringify(labels)}`
            );
        }
        assert.equal(completion.length, 0, 'declarative state member access must return an empty list');
    });
});

test('typing prefix `sig` in script context still surfaces top-level `signal`', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/member-prefix-toplevel.zen';
        const text = '<script lang="ts">\nsig\n</script>\n<p>hello</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'sig\n', 3)
        });

        const labels = labelsOf(completion);
        assert.ok(labels.includes('signal'), `top-level prefix completion must include "signal", got ${JSON.stringify(labels)}`);
        for (const forbidden of FORBIDDEN_MEMBER_LABELS) {
            assert.ok(!labels.includes(forbidden), `top-level prefix completion must NOT include "${forbidden}"`);
        }
    });
});

test('member completion is suppressed inside string literals on the same line', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/member-in-string.zen';
        const text = '<script lang="ts">\nconst count = signal(0);\nconst s = "count.\n</script>\n<p>x</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'count.\n', 6)
        });

        const labels = labelsOf(completion);
        assert.ok(!labels.includes('get'), 'must not surface signal members inside a string literal');
        assert.ok(!labels.includes('set'), 'must not surface signal members inside a string literal');
    });
});

test('regression: completion responses never expose stale member labels', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/member-regression.zen';
        const text = '<script lang="ts">\nconst count = signal(0);\nconst el = ref<HTMLDivElement>();\ncount.\n</script>\n<p>{count}</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'count.\n', 6)
        });

        for (const item of completion) {
            const label = String(item.label ?? '');
            const insertText = String(item.insertText ?? '');
            assert.ok(!FORBIDDEN_MEMBER_LABELS.includes(label), `forbidden member label "${label}" reappeared`);
            assert.doesNotMatch(insertText, /\.value\b/, `member insertText "${insertText}" must not teach .value`);
            assert.doesNotMatch(insertText, /\buseRoute\b/, `member insertText "${insertText}" must not teach useRoute`);
            assert.doesNotMatch(insertText, /\buseRouter\b/, `member insertText "${insertText}" must not teach useRouter`);
        }
    });
});
