/**
 * Completion item metadata + ranking (LSP stdio).
 *
 * Asserts full item shape (detail, documentation, sortText, filterText) so
 * real editors can surface Zenith-owned items clearly above host noise.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    openTextDocument,
    positionOf,
    withClient
} from './helpers/lsp-stdio';

const FORBIDDEN = ['value', 'useState', 'useRoute', 'useRouter', 'createSignal', 'onClick', 'onclick', '@click'];

function findItem(completion: any[], label: string): any {
    return completion.find((item: any) => String(item.label) === label);
}

function labelsOf(completion: any[]): string[] {
    return completion.map((item: any) => String(item.label ?? ''));
}

function docValue(item: any): string {
    const doc = item?.documentation;
    if (!doc) return '';
    if (typeof doc === 'string') return doc;
    return String(doc.value ?? '');
}

test('initialize exposes completion triggerCharacters including member and event triggers', async () => {
    await withClient(async (lsp) => {
        const result = await lsp.initialize();
        const triggers: string[] = result.capabilities.completionProvider?.triggerCharacters ?? [];
        assert.ok(triggers.includes('.'), 'must trigger on . for member access');
        assert.ok(triggers.includes(':'), 'must trigger on : for on: events');
        assert.ok(triggers.includes('<'), 'must trigger on < for tags');
    });
});

test('top-level sig surfaces signal with branded metadata and early sortText', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/rank-sig.zen';
        const text = '<script lang="ts">\nsig\n</script>\n<p>x</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'sig\n', 3)
        });

        const signal = findItem(completion, 'signal');
        assert.ok(signal, `expected signal in ${JSON.stringify(labelsOf(completion))}`);
        assert.ok(String(signal.detail ?? '').includes('Zenith'), 'signal detail must mention Zenith');
        assert.ok(String(signal.detail ?? '').includes('signal'), 'signal detail must mention signal');
        assert.ok(docValue(signal).toLowerCase().includes('zenith'), 'signal docs must mention Zenith');
        assert.ok(docValue(signal).toLowerCase().includes('signal'), 'signal docs must mention signal');
        assert.ok(signal.sortText, 'signal must define sortText');
        assert.ok(signal.filterText, 'signal must define filterText');
        assert.equal(signal.filterText, 'signal');
        assert.match(String(signal.sortText), /^!00_signal$/, 'sig prefix should rank signal first among Zenith items');

        for (const stale of FORBIDDEN) {
            assert.ok(!labelsOf(completion).includes(stale), `must not suggest stale "${stale}"`);
        }
    });
});

test('count. surfaces get/set/subscribe with branded detail, docs, sortText, and filterText', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/rank-count-dot.zen';
        const text = '<script lang="ts">\nconst count = signal(0);\ncount.\n</script>\n<p>{count}</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'count.\n', 6)
        });

        const labels = labelsOf(completion);
        assert.deepEqual(labels.sort(), ['get', 'set', 'subscribe']);

        for (const name of ['get', 'set', 'subscribe'] as const) {
            const item = findItem(completion, name);
            assert.ok(item, `missing member ${name}`);
            assert.ok(String(item.detail ?? '').startsWith('Zenith'), `${name} detail must be branded`);
            assert.ok(docValue(item).length > 0, `${name} must have documentation`);
            assert.ok(item.sortText?.startsWith('!'), `${name} sortText should rank early`);
            assert.equal(item.filterText, name);
        }

        const setItem = findItem(completion, 'set');
        assert.match(String(setItem.detail ?? ''), /Zenith Signal\.set/, 'set must brand Zenith Signal.set');

        for (const prim of ['signal', 'zenMount', 'ref']) {
            assert.ok(!labels.includes(prim), `must not dump primitive "${prim}" on member access`);
        }
    });
});

test('count.s filters to set and subscribe only', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/rank-count-s.zen';
        const text = '<script lang="ts">\nconst count = signal(0);\ncount.s\n</script>\n<p>{count}</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'count.s\n', 7)
        });

        const labels = labelsOf(completion);
        assert.ok(labels.includes('set'));
        assert.ok(labels.includes('subscribe'));
        assert.ok(!labels.includes('get'));
        assert.ok(!labels.includes('signal'));
    });
});

test('refVar. surfaces current with branded metadata', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/rank-ref.zen';
        const text = '<script lang="ts">\nconst el = ref<HTMLDivElement>();\nel.\n</script>\n<div></div>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'el.\n', 3)
        });

        const current = findItem(completion, 'current');
        assert.ok(current, 'ref member completion must include current');
        assert.match(String(current.detail ?? ''), /Zenith Ref\.current/);
        assert.ok(docValue(current).length > 0);
        assert.ok(current.filterText === 'current');
    });
});

test('unknown receiver returns empty Zenith member list', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/rank-unknown.zen';
        const text = '<script lang="ts">\nconst thing = {};\nthing.\n</script>\n';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'thing.\n', 6)
        });

        assert.equal(completion.length, 0);
    });
});

test('on: tag context surfaces branded on:click with filterText and early sortText', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/rank-on.zen';
        const token = '<button on:';
        const text = `<script lang="ts">\n</script>\n${token}></button>`;

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, token, token.length)
        });

        const click = findItem(completion, 'on:click');
        assert.ok(click, 'must suggest on:click in on: context');
        assert.ok(String(click.detail ?? '').includes('Zenith'));
        assert.ok(click.filterText === 'on:click');
        assert.match(String(click.sortText ?? ''), /^!/);
    });
});
