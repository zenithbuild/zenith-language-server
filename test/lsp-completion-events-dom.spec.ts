/**
 * LSP completion: DOM events in markup + runtime primitives in script context.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CORE_MODULES } from '../src/metadata/core-imports';
import { openTextDocument, positionOf, withClient } from './helpers/lsp-stdio';

test('tag attribute context surfaces `on:click` and Zenith aliases, not React/Vanilla patterns', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/events-tag.zen';
        // Cursor on `on` (before `>`): `currentWord` is `on`, which enables the `on:*` catalog.
        const text = '<script lang="ts">\nconst x = 1;\n</script>\n<button on></button>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'on></button>', 2)
        });

        const labels = completion.map((item: any) => String(item.label));

        assert.ok(labels.some((l) => l.startsWith('on:click')), 'must suggest on:click');
        assert.ok(labels.some((l) => l === 'on:hoverin'), 'must suggest on:hoverin alias');
        assert.ok(labels.some((l) => l === 'on:doubleclick'), 'must suggest on:doubleclick alias');
        assert.ok(labels.some((l) => l === 'on:esc'), 'must suggest on:esc alias');

        for (const stale of ['onClick', 'onclick', '@click']) {
            assert.ok(!labels.includes(stale), `must not suggest stale "${stale}"`);
        }
    }, ['--stdio']);
});

test('cursor immediately after `on:` still surfaces `on:*` event completions', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/events-tag-colon.zen';
        const token = '<button on:';
        const text = `<script lang="ts">\nconst x = 1;\n</script>\n${token}></button>`;

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, token, token.length)
        });

        const labels = completion.map((item: any) => String(item.label));
        assert.ok(labels.some((l) => l === 'on:click'), 'must suggest on:click after typed `on:`');
        assert.ok(labels.some((l) => l === 'on:hoverout'), 'must suggest alias completions');
        for (const stale of ['onClick', 'onclick', '@click']) {
            assert.ok(!labels.includes(stale), `must not suggest stale "${stale}" after \`on:\``);
        }
    }, ['--stdio']);
});

test('partial `on:h` prefix still surfaces matching `on:*` events and no React/Vue handlers', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/events-tag-onh.zen';
        const token = '<button on:h';
        const text = `<script lang="ts">\nconst x = 1;\n</script>\n${token}></button>`;

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, token, token.length)
        });

        const labels = completion.map((item: any) => String(item.label));
        assert.ok(labels.some((l) => l === 'on:hoverin'), 'must suggest on:hoverin when prefix is on:h');
        assert.ok(labels.some((l) => l === 'on:hoverout'), 'must suggest on:hoverout when prefix is on:h');
        for (const stale of ['onClick', 'onclick', '@click']) {
            assert.ok(!labels.includes(stale), `must not suggest stale "${stale}" after \`on:h\``);
        }
    }, ['--stdio']);
});

test('script empty-line completion exposes DOM/runtime primitives from zenith catalog', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/dom-script.zen';
        const text = '<script lang="ts">\n\n</script>\n<p>x</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: { line: 1, character: 0 }
        });

        const labels = new Set(completion.map((item: any) => String(item.label)));

        for (const name of [
            'zenOn',
            'zenWindow',
            'zenDocument',
            'zenResize',
            'zenMount',
            'collectRefs',
            'ref',
            'signal',
            'state',
            'zenEffect',
            'zeneffect',
            'effect',
            'mount',
            'zenPresence',
            'presence',
            'hydrate'
        ]) {
            assert.ok(labels.has(name), `expected script completion for ${name}`);
        }

        for (const stale of ['useRoute', 'useRouter', 'prefetch']) {
            assert.ok(!labels.has(stale), `must not surface stale ${stale}`);
        }
    }, ['--stdio']);
});

test('server script suggests zenith:server-contract named exports only from metadata truth set', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/server-named.zen';
        const text = '<script server lang="ts">\nimport {  } from "zenith:server-contract"\n</script>\n';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, '{  }', 2)
        });

        const labels = new Set(completion.map((item: any) => String(item.label)));
        const expected = CORE_MODULES['zenith:server-contract'].exports.map((e) => e.name);

        for (const name of expected) {
            assert.ok(labels.has(name), `server-contract named completion must include ${name}`);
        }
        assert.ok(!labels.has('navigate'), 'must not leak router helpers into server-contract imports');
    }, ['--stdio']);
});

test('client script does not surface zenith:server-contract named exports inside import braces', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/client-server-contract.zen';
        const text =
            '<script lang="ts">\nimport {  } from "zenith:server-contract"\n</script>\n<p>x</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, '{  }', 2)
        });

        const labels = new Set(completion.map((item: any) => String(item.label)));
        for (const forbidden of ['allow', 'redirect', 'deny', 'data', 'withMiddleware']) {
            assert.ok(!labels.has(forbidden), `client script must not suggest server-contract export "${forbidden}"`);
        }
    }, ['--stdio']);
});
