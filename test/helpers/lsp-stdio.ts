/**
 * Shared LSP stdio harness for spec files.
 *
 * Extracted from `lsp-stdio.spec.ts` so multiple test files can share the same
 * minimal JSON-RPC client without growing any single spec past the file cap.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..', '..');
const binPath = join(packageRoot, 'bin', 'zenith-language-server.js');
const distPath = join(packageRoot, 'dist', 'server.js');
const nodeBin = process.env.NODE_BINARY || 'node';

export const HARNESS_PATHS = { packageRoot, binPath, distPath } as const;

interface PendingRequest {
    resolve(value: unknown): void;
    reject(error: Error): void;
}

interface NotificationWaiter {
    method: string;
    resolve(value: any): void;
}

export class StdioLspClient {
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
            const error = new Error(
                `language server exited before response code=${code} signal=${signal} stderr=${this.#stderr}`
            );
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

export const openTextDocument = (uri: string, text: string) => ({
    textDocument: {
        uri,
        languageId: 'zenith',
        version: 1,
        text
    }
});

export function positionOf(text: string, token: string, offset = 0) {
    const index = text.indexOf(token);
    assert.ok(index >= 0, `Expected token ${token}`);
    const before = text.slice(0, index + offset).split('\n');
    return {
        line: before.length - 1,
        character: before.at(-1)!.length
    };
}

export async function withClient(
    callback: (client: StdioLspClient) => Promise<void>,
    args: string[] = []
): Promise<void> {
    await access(distPath);
    const client = new StdioLspClient(args);
    try {
        await callback(client);
    } finally {
        await client.close();
    }
}
