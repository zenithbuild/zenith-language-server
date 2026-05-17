/**
 * Zenith Language Server entry point.
 *
 * Wires the LSP transport to the stateless completion and hover providers in
 * `completion.ts` and `hover.ts`. Diagnostics live in `diagnostics.ts`; code
 * actions live in `code-actions.ts`. Static catalogs live under
 * `metadata/*` and `router.ts`.
 *
 * Syntax highlighting is owned by `@zenithbuild/language`, not this package.
 *
 * Architecture principles:
 *   - Compiler is the source of truth.
 *   - No runtime assumptions.
 *   - Static analysis only.
 *   - Graceful degradation for missing plugins.
 */

import * as path from 'path';

import {
    createConnection,
    DidChangeConfigurationNotification,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
    type CompletionItem,
    type CompletionParams,
    type CodeAction,
    type CodeActionParams,
    type Hover,
    type TextDocumentPositionParams
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
    ProjectGraph,
    buildProjectGraph,
    detectProjectRoot
} from './project';

import { provideCompletions } from './completion';
import { provideHover } from './hover';
import { collectDiagnostics } from './diagnostics';
import {
    buildDomLintCodeActions,
    buildEventBindingCodeActions,
    buildWindowDocumentCodeActions
} from './code-actions';
import {
    DEFAULT_SETTINGS,
    ZenithServerSettings,
    normalizeSettings
} from './settings';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const projectGraphs: Map<string, ProjectGraph> = new Map();
let workspaceFolders: string[] = [];
let globalSettings: ZenithServerSettings = DEFAULT_SETTINGS;

function getProjectGraph(docUri: string): ProjectGraph | null {
    const filePath = docUri.replace('file://', '');
    const projectRoot = detectProjectRoot(path.dirname(filePath), workspaceFolders);

    if (!projectRoot) {
        return null;
    }

    if (!projectGraphs.has(projectRoot)) {
        projectGraphs.set(projectRoot, buildProjectGraph(projectRoot));
    }

    return projectGraphs.get(projectRoot) || null;
}

function invalidateProjectGraph(uri: string): void {
    const filePath = uri.replace('file://', '');
    const projectRoot = detectProjectRoot(path.dirname(filePath), workspaceFolders);
    if (projectRoot) {
        projectGraphs.delete(projectRoot);
    }
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
    workspaceFolders = (params.workspaceFolders || [])
        .map((folder) => folder.uri.replace('file://', ''));
    if (workspaceFolders.length === 0 && params.rootUri) {
        workspaceFolders = [params.rootUri.replace('file://', '')];
    }

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['{', '<', '"', "'", '=', '.', ' ', ':', '(', '@']
            },
            hoverProvider: true,
            codeActionProvider: true
        }
    };
});

connection.onInitialized(() => {
    connection.client.register(DidChangeConfigurationNotification.type);
});

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const graph = getProjectGraph(params.textDocument.uri);
    return provideCompletions(text, offset, graph);
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => item);

connection.onHover((params: TextDocumentPositionParams): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const graph = getProjectGraph(params.textDocument.uri);
    return provideHover(text, offset, graph);
});

connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    const eventActions = buildEventBindingCodeActions(document, params.context.diagnostics);
    const domLintActions = buildDomLintCodeActions(document, params.context.diagnostics);
    const windowDocActions = buildWindowDocumentCodeActions(document, params.range);
    return [...eventActions, ...domLintActions, ...windowDocActions];
});

// Debounce + cancellation for diagnostics (prevents editor lag from rapid typing)
const DEBOUNCE_MS = 150;
const validationTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const validationIds = new Map<string, number>();

documents.onDidChangeContent((change) => {
    const uri = change.document.uri;
    const existing = validationTimeouts.get(uri);
    if (existing) clearTimeout(existing);
    validationTimeouts.set(
        uri,
        setTimeout(() => {
            validationTimeouts.delete(uri);
            validateDocument(change.document);
        }, DEBOUNCE_MS)
    );
});

documents.onDidSave((event) => {
    validateDocument(event.document);
});

documents.onDidOpen((event) => {
    validateDocument(event.document);
});

async function validateDocument(document: TextDocument): Promise<void> {
    const uri = document.uri;
    const id = (validationIds.get(uri) ?? 0) + 1;
    validationIds.set(uri, id);

    const graph = getProjectGraph(uri);
    const filePath = uri.replace('file://', '');
    const projectRoot = detectProjectRoot(path.dirname(filePath), workspaceFolders);
    const diagnostics = await collectDiagnostics(document, graph, globalSettings, projectRoot);

    if (validationIds.get(uri) !== id) return;
    connection.sendDiagnostics({ uri, diagnostics });
}

connection.onDidChangeConfiguration((change) => {
    const config = (change.settings?.zenith ?? change.settings) as unknown;
    globalSettings = normalizeSettings(config);

    for (const doc of documents.all()) {
        validateDocument(doc);
    }
});

connection.onDidChangeWatchedFiles((params) => {
    for (const change of params.changes) {
        invalidateProjectGraph(change.uri);
    }

    for (const doc of documents.all()) {
        validateDocument(doc);
    }
});

documents.listen(connection);
connection.listen();
