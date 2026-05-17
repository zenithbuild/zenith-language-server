import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const binPath = join(packageRoot, 'bin', 'zenith-language-server.js');
const distPath = join(packageRoot, 'dist', 'server.js');
const nodeBin = process.env.NODE_BINARY || 'node';

interface PendingRequest {
    resolve(value: unknown): void;
    reject(error: Error): void;
}

interface NotificationWaiter {
    method: string;
    resolve(value: any): void;
}

class StdioLspClient {
    readonly #server: ChildProcessWithoutNullStreams;
    readonly #pending = new Map<number, PendingRequest>();
    readonly #notifications: any[] = [];
    readonly #waiters: NotificationWaiter[] = [];
    #buffer = Buffer.alloc(0);
    #nextId = 1;
    #stderr = '';

    constructor(args: string[] = []) {
        this.#server = spawn(nodeBin, [binPath, ...args], {
            cwd: packageRoot,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.#server.stdout.on('data', (chunk) => {
            this.#buffer = Buffer.concat([this.#buffer, chunk]);
            this.#readMessages();
        });
        this.#server.stderr.on('data', (chunk) => {
            this.#stderr += chunk.toString('utf8');
        });
        this.#server.on('exit', (code, signal) => {
            if (this.#pending.size === 0) {
                return;
            }
            const error = new Error(`language server exited before response code=${code} signal=${signal} stderr=${this.#stderr}`);
            for (const pending of this.#pending.values()) {
                pending.reject(error);
            }
            this.#pending.clear();
        });
    }

    async initialize(): Promise<any> {
        const result = await this.request('initialize', {
            processId: process.pid,
            rootUri: 'file:///tmp',
            capabilities: {
                workspace: { configuration: false },
                textDocument: {}
            },
            workspaceFolders: null
        });
        this.notify('initialized', {});
        return result;
    }

    request(method: string, params: unknown): Promise<any> {
        const id = this.#nextId;
        this.#nextId += 1;
        const promise = new Promise((resolve, reject) => {
            this.#pending.set(id, { resolve, reject });
        });
        this.#send({ jsonrpc: '2.0', id, method, params });
        return promise;
    }

    notify(method: string, params: unknown): void {
        this.#send({ jsonrpc: '2.0', method, params });
    }

    waitForNotification(method: string, timeoutMs = 7000): Promise<any> {
        const existingIndex = this.#notifications.findIndex((message) => message.method === method);
        if (existingIndex !== -1) {
            const [message] = this.#notifications.splice(existingIndex, 1);
            return Promise.resolve(message.params);
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const index = this.#waiters.findIndex((waiter) => waiter.resolve === resolve);
                if (index !== -1) {
                    this.#waiters.splice(index, 1);
                }
                reject(new Error(`Timed out waiting for ${method}; stderr=${this.#stderr}`));
            }, timeoutMs);
            this.#waiters.push({
                method,
                resolve(value) {
                    clearTimeout(timer);
                    resolve(value);
                }
            });
        });
    }

    async close(): Promise<void> {
        if (!this.#server.killed) {
            try {
                await this.request('shutdown', null);
            } catch {
                // The process may already have exited after a failed startup.
            }
            this.notify('exit', {});
            this.#server.kill('SIGTERM');
        }
    }

    #send(message: unknown): void {
        const body = JSON.stringify(message);
        this.#server.stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
    }

    #readMessages(): void {
        while (true) {
            const headerEnd = this.#buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1) {
                return;
            }

            const header = this.#buffer.slice(0, headerEnd).toString('utf8');
            const match = /Content-Length: (\d+)/i.exec(header);
            if (!match) {
                throw new Error(`Missing Content-Length header: ${header}`);
            }

            const length = Number(match[1]);
            const bodyStart = headerEnd + 4;
            if (this.#buffer.length < bodyStart + length) {
                return;
            }

            const body = this.#buffer.slice(bodyStart, bodyStart + length).toString('utf8');
            this.#buffer = this.#buffer.slice(bodyStart + length);
            this.#handleMessage(JSON.parse(body));
        }
    }

    #handleMessage(message: any): void {
        if (message.id !== undefined && this.#pending.has(message.id)) {
            const pending = this.#pending.get(message.id)!;
            this.#pending.delete(message.id);
            if (message.error) {
                pending.reject(new Error(JSON.stringify(message.error)));
            } else {
                pending.resolve(message.result);
            }
            return;
        }

        if (message.method) {
            const waiterIndex = this.#waiters.findIndex((waiter) => waiter.method === message.method);
            if (waiterIndex !== -1) {
                const [waiter] = this.#waiters.splice(waiterIndex, 1);
                waiter?.resolve(message.params);
                return;
            }
            this.#notifications.push(message);
        }
    }
}

const openTextDocument = (uri: string, text: string) => ({
    textDocument: {
        uri,
        languageId: 'zenith',
        version: 1,
        text
    }
});

function positionOf(text: string, token: string, offset = 0) {
    const index = text.indexOf(token);
    assert.ok(index >= 0, `Expected token ${token}`);
    const before = text.slice(0, index + offset).split('\n');
    return {
        line: before.length - 1,
        character: before.at(-1)!.length
    };
}

async function withClient(callback: (client: StdioLspClient) => Promise<void>, args: string[] = []): Promise<void> {
    await access(distPath);
    const client = new StdioLspClient(args);
    try {
        await callback(client);
    } finally {
        await client.close();
    }
}

test('package bin defaults to stdio and preserves explicit transport flags', async () => {
    const source = await readFile(binPath, 'utf8');
    assert.match(source, /process\.argv\.push\('--stdio'\)/);
    assert.match(source, /arg === '--stdio'/);
    assert.match(source, /arg === '--node-ipc'/);
    assert.match(source, /arg\.startsWith\('--socket='/);

    await withClient(async (lsp) => {
        const result = await lsp.initialize();

        assert.ok(result.capabilities.textDocumentSync);
        assert.ok(result.capabilities.completionProvider);
        assert.equal(result.capabilities.hoverProvider, true);
        assert.equal(result.capabilities.codeActionProvider, true);
    });
});

test('explicit stdio transport still initializes', async () => {
    await withClient(async (lsp) => {
        const result = await lsp.initialize();
        assert.ok(result.capabilities.textDocumentSync);
    }, ['--stdio']);
});

test('publishes compiler-backed diagnostics for invalid .zen documents', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();

        lsp.notify('textDocument/didOpen', openTextDocument(
            'file:///tmp/src/pages/batch7b-invalid.zen',
            '<script lang="ts">\nconst el = document.querySelector(".foo")\n</script>\n<div class="foo">hi</div>'
        ));

        const published = await lsp.waitForNotification('textDocument/publishDiagnostics');
        const [diagnostic] = published.diagnostics;

        assert.equal(published.uri, 'file:///tmp/src/pages/batch7b-invalid.zen');
        assert.equal(diagnostic.code, 'ZEN-DOM-QUERY');
        assert.match(diagnostic.message, /DOM nodes/);
        assert.equal(diagnostic.source, 'zenith-compiler');
        assert.equal(typeof diagnostic.range.start.line, 'number');
        assert.equal(typeof diagnostic.range.start.character, 'number');
    });
});

test('publishes empty diagnostics for valid .zen documents', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();

        lsp.notify('textDocument/didOpen', openTextDocument(
            'file:///tmp/src/pages/batch7b-valid.zen',
            '<script lang="ts">\nconst title = "Hello"\n</script>\n<main>{title}</main>'
        ));

        const published = await lsp.waitForNotification('textDocument/publishDiagnostics');

        assert.equal(published.uri, 'file:///tmp/src/pages/batch7b-valid.zen');
        assert.deepEqual(published.diagnostics, []);
    });
});

test('serves existing completion and hover requests through LSP transport', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/batch7b-editor.zen';
        const text = '<script lang="ts">\nstate count = 0\n</script>\n<button on></button>\n<p>{count}</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'on></button>', 2)
        });
        const labels = completion.map((item: any) => item.label);
        assert.ok(labels.includes('on:click'));

        const hover = await lsp.request('textDocument/hover', {
            textDocument: { uri },
            position: positionOf(text, '{count}', 2)
        });
        assert.match(hover.contents.value, /state `count`/);
    }, ['--stdio']);
});

test('script-context completions only teach canonical signal/state/ref API', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/api-truth.zen';
        // Empty new line inside the script block so currentWord is "" and the
        // LSP returns the full canonical primitive list (not just signal*).
        const text = '<script lang="ts">\nconst count = signal(0);\n\n</script>\n<p>{count}</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: { line: 2, character: 0 }
        });

        assert.ok(Array.isArray(completion) && completion.length > 0, 'expected completion items');

        const labels = new Set(completion.map((item: any) => item.label));
        const stale = ['zenOnMount', 'zenOnDestroy', 'zenOnUpdate', 'zenRef', 'zenState', 'useFetch'];
        for (const name of stale) {
            assert.ok(!labels.has(name), `LSP must not surface stale completion "${name}"`);
        }

        const signalItem = completion.find((item: any) => item.label === 'signal');
        assert.ok(signalItem, 'signal completion must be present in script context');
        assert.match(signalItem.insertText, /signal\(/, 'signal insertText must call signal()');
        assert.match(signalItem.insertText, /\.set\(/, 'signal insertText must teach .set(...)');
        assert.match(signalItem.insertText, /\.get\(\)/, 'signal insertText must teach .get()');
        assert.doesNotMatch(signalItem.insertText, /\.value\b/, 'signal insertText must NOT teach .value');

        const stateItem = completion.find((item: any) => item.label === 'state');
        assert.ok(stateItem, 'state completion must be present in script context');
        assert.match(stateItem.insertText, /^state \$\{1:name\}/, 'state insertText must be declarative');

        for (const item of completion) {
            const labelText = String(item.label ?? '');
            const insertText = String(item.insertText ?? '');
            assert.doesNotMatch(labelText, /\bcount\.value\b/, `completion label "${labelText}" must not teach .value`);
            assert.doesNotMatch(insertText, /\bcount\.value\b/, `completion insertText for "${labelText}" must not teach count.value`);
        }
    }, ['--stdio']);
});

test('script-context completion exposes @zenithbuild/router navigation API and excludes legacy hooks', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/router-truth.zen';
        const text = [
            '<script lang="ts">',
            'import { navigate } from "@zenithbuild/router";',
            '',
            '</script>',
            '<p>hello</p>'
        ].join('\n');

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: { line: 2, character: 0 }
        });

        assert.ok(Array.isArray(completion) && completion.length > 0, 'expected completion items');
        const labels = new Set(completion.map((item: any) => item.label));

        for (const expected of ['navigate', 'createRouter', 'getCurrentPath', 'refreshCurrentRoute']) {
            assert.ok(labels.has(expected), `router completion must include "${expected}"`);
        }
        for (const stale of ['useRoute', 'useRouter', 'prefetch', 'isActive', 'getRoute']) {
            assert.ok(!labels.has(stale), `router completion must NOT include stale "${stale}"`);
        }
    }, ['--stdio']);
});

test('template-context completion offers ZenLink with canonical href prop when router is imported', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/router-template.zen';
        const lines = [
            '<script lang="ts">',
            'import ZenLink from "@zenithbuild/router/ZenLink.zen";',
            '</script>',
            '<'
        ];
        const text = lines.join('\n');

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        // Cursor at the very end, right after the trailing `<`
        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: { line: lines.length - 1, character: 1 }
        });

        assert.ok(Array.isArray(completion) && completion.length > 0, 'expected completion items');
        const zenLinkItem = completion.find((item: any) => item.label === 'ZenLink');
        assert.ok(zenLinkItem, 'ZenLink completion must be offered when router is imported');
        assert.match(
            String(zenLinkItem.insertText ?? ''),
            /href=/,
            'ZenLink completion must teach `href` prop'
        );
        assert.doesNotMatch(
            String(zenLinkItem.insertText ?? ''),
            /\bto=/,
            'ZenLink completion must not teach legacy `to` prop'
        );
    }, ['--stdio']);
});

test('inside-tag completion for ZenLink offers canonical Props and not React-style children', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/router-zenlink-props.zen';
        const text = [
            '<script lang="ts">',
            'import ZenLink from "@zenithbuild/router/ZenLink.zen";',
            '</script>',
            '<ZenLink ></ZenLink>'
        ].join('\n');

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, '<ZenLink ', 9)
        });

        assert.ok(Array.isArray(completion) && completion.length > 0, 'expected completion items');
        const labels = new Set(completion.map((item: any) => item.label));
        for (const expected of ['href', 'class', 'ariaLabel', 'onClick']) {
            assert.ok(labels.has(expected), `ZenLink props must include "${expected}"`);
        }
        for (const stale of ['to', 'preload', 'replace', 'activeClass', 'children', 'className']) {
            assert.ok(
                !labels.has(stale),
                `ZenLink props must NOT include stale "${stale}"`
            );
        }
    }, ['--stdio']);
});

test('component-tag completion does not invent React-style children when Props absent', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/no-children.zen';
        const text = [
            '<script lang="ts">',
            'const x = 1;',
            '</script>',
            '<button ></button>'
        ].join('\n');

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, '<button ', 8)
        });

        assert.ok(Array.isArray(completion) && completion.length > 0, 'expected completion items');
        const labels = new Set(completion.map((item: any) => item.label));
        for (const stale of ['children', 'className']) {
            assert.ok(
                !labels.has(stale),
                `tag attribute completion must not surface stale "${stale}"`
            );
        }
    }, ['--stdio']);
});

test('import-path completion includes @zenithbuild/router but not legacy zenith/router', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/import-completion.zen';
        const text = '<script lang="ts">\nimport { navigate } from ""\n</script>\n';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        // Position cursor inside the empty import path quotes
        const completion = await lsp.request('textDocument/completion', {
            textDocument: { uri },
            position: positionOf(text, 'from ""', 6)
        });

        assert.ok(Array.isArray(completion) && completion.length > 0, 'expected completion items');
        const labels = new Set(completion.map((item: any) => item.label));
        assert.ok(labels.has('@zenithbuild/router'), 'must offer canonical @zenithbuild/router');
        assert.ok(!labels.has('zenith/router'), 'must not offer legacy zenith/router');
    }, ['--stdio']);
});

test('script-context hover for `signal` returns canonical .get()/.set() API docs', async () => {
    await withClient(async (lsp) => {
        await lsp.initialize();
        const uri = 'file:///tmp/api-truth-hover.zen';
        const text = '<script lang="ts">\nconst count = signal(0);\n</script>\n<p>{count}</p>';

        lsp.notify('textDocument/didOpen', openTextDocument(uri, text));

        const hover = await lsp.request('textDocument/hover', {
            textDocument: { uri },
            position: positionOf(text, 'signal(0)', 2)
        });
        const value = String(hover?.contents?.value ?? '');
        assert.match(value, /signal/, 'hover should mention signal');
        assert.match(value, /\.get\(\)/, 'hover should teach .get()');
        assert.match(value, /\.set\(/, 'hover should teach .set()');
    }, ['--stdio']);
});
