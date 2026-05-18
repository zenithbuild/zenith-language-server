/**
 * Portable LSP snippet gates (Neovim vim.snippet + VS Code/Cursor).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
    assertPortableSnippet,
    collectCatalogSnippets,
    FORBIDDEN_SNIPPET_PATTERNS
} from './helpers/snippet-portability';
import { PLATFORM_PRIMITIVES } from '../src/metadata/completion-metadata';
import { openTextDocument, withClient } from './helpers/lsp-stdio';

test('completion catalog snippets contain no VS Code-only transform syntax', () => {
    const snippets = collectCatalogSnippets();
    assert.ok(snippets.length > 0, 'expected catalog snippets');
    for (const snippet of snippets) {
        for (const { label, regex } of FORBIDDEN_SNIPPET_PATTERNS) {
            assert.doesNotMatch(
                snippet,
                regex,
                `catalog snippet must not use ${label}: ${snippet.slice(0, 80)}...`
            );
        }
    }
});

test('signal catalog snippet teaches portable counter example with get/set', () => {
    const signal = PLATFORM_PRIMITIVES.find((p) => p.name === 'signal');
    assert.ok(signal, 'signal entry must exist');
    assertPortableSnippet('signal', signal!.snippet);
    assert.match(signal!.snippet, /signal\(/);
    assert.match(signal!.snippet, /\.get\(\)/);
    assert.match(signal!.snippet, /\.set\(/);
    assert.doesNotMatch(signal!.snippet, /\.value\b/);
    assert.match(signal!.snippet, /\$\{3:increment\}/, 'increment name is a plain tab stop');
    assert.doesNotMatch(
        signal!.snippet,
        /function\s+\$\{1:count\}/,
        'signal snippet must avoid variable/function declaration collisions'
    );
});

test('any script-block snippet uses `<script lang=\"ts\">` (no plain <script>)', () => {
    const snippets = collectCatalogSnippets();
    for (const snippet of snippets) {
        if (!snippet.includes('<script')) {
            continue;
        }
        assert.match(snippet, /<script\s+lang="ts">/i);
        assert.doesNotMatch(snippet, /<script>\s*/i);
    }
});

test('LSP stdio signal completion insertText is portable and teaches get/set', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/snippet-signal.zen';
        const text = '<script lang="ts">\n\n</script>\n';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: { line: 1, character: 0 }
        });

        const signalItem = completion.find((item: any) => item.label === 'signal');
        assert.ok(signalItem, 'signal completion must be present');
        const insertText = String(signalItem.insertText ?? '');

        assert.match(insertText, /\.get\(\)/);
        assert.match(insertText, /\.set\(/);
        assert.doesNotMatch(insertText, /\.value\b/);
        assert.doesNotMatch(insertText, /\$\{\d+\//, 'must not contain regex transform');
        assert.doesNotMatch(insertText, /:\/capitalize/, 'must not contain capitalize transform');

        assertPortableSnippet('LSP signal insertText', insertText);
    });
});

test('Neovim vim.snippet.expand accepts signal completion insertText', async (t) => {
    const nvim = spawnSync('nvim', ['--version'], { encoding: 'utf8' });
    if (nvim.status !== 0) {
        t.skip('nvim not installed');
        return;
    }

    let insertText = '';
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/snippet-nvim-parse.zen';
        const text = '<script lang="ts">\n\n</script>\n';
        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));
        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: { line: 1, character: 0 }
        });
        const signalItem = completion.find((item: any) => item.label === 'signal');
        insertText = String(signalItem?.insertText ?? '');
    });

    assert.ok(insertText.length > 0, 'expected signal insertText from LSP');

    const dir = await mkdtemp(join(tmpdir(), 'zenith-snippet-parse-'));
    const luaPath = join(dir, 'parse-snippet.lua');
    const lua = `
local snippet = ${JSON.stringify(insertText)}
vim.cmd('enew')
vim.cmd('startinsert')
local ok, err = pcall(vim.snippet.expand, snippet)
if ok then
  print('SNIPPET_EXPAND=ok')
else
  print('SNIPPET_EXPAND=fail:' .. tostring(err))
  vim.cmd('cquit! 1')
end
vim.cmd('quit!')
`;
    await writeFile(luaPath, lua, 'utf8');

    try {
        const result = spawnSync('nvim', ['--headless', '-n', '-l', luaPath], {
            encoding: 'utf8',
            timeout: 15000
        });

        const output = `${result.stdout}\n${result.stderr}`;
        assert.match(
            output,
            /SNIPPET_EXPAND=ok/,
            `vim.snippet.expand failed: ${output}`
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
