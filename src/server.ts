/**
 * Zenith Language Server
 * 
 * Provides full IntelliSense for Zenith .zen files
 * Reuses compiler patterns for consistency
 */

import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    Hover,
    MarkupKind,
    Diagnostic,
    DiagnosticSeverity,
    InsertTextFormat
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';

import {
    detectProjectRoot,
    buildProjectGraph,
    resolveComponent,
    ProjectGraph
} from './project';

// Create connection and document manager
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Project graph cache
let projectGraphs: Map<string, ProjectGraph> = new Map();

// Lifecycle hooks with documentation - sorted for priority
const LIFECYCLE_HOOKS = [
    { name: 'state', doc: 'Declare a reactive state variable', snippet: 'state ${1:name} = ${2:value}', kind: CompletionItemKind.Keyword },
    { name: 'zenOnMount', doc: 'Called when component is mounted to the DOM', snippet: 'zenOnMount(() => {\n\t$0\n})', kind: CompletionItemKind.Function },
    { name: 'zenOnDestroy', doc: 'Called when component is removed from the DOM', snippet: 'zenOnDestroy(() => {\n\t$0\n})', kind: CompletionItemKind.Function },
    { name: 'zenOnUpdate', doc: 'Called after any state update causes a re-render', snippet: 'zenOnUpdate(() => {\n\t$0\n})', kind: CompletionItemKind.Function },
    { name: 'zenEffect', doc: 'Reactive effect that re-runs when dependencies change', snippet: 'zenEffect(() => {\n\t$0\n})', kind: CompletionItemKind.Function },
    { name: 'useFetch', doc: 'Fetch data with caching and SSG support', snippet: 'useFetch("${1:url}")', kind: CompletionItemKind.Function }
];

// Common HTML elements for completions
const HTML_ELEMENTS = [
    { tag: 'div', doc: 'Generic container element' },
    { tag: 'span', doc: 'Inline container element' },
    { tag: 'p', doc: 'Paragraph element' },
    { tag: 'a', doc: 'Anchor/link element', attrs: 'href="$1"' },
    { tag: 'button', doc: 'Button element', attrs: 'onclick="$1"' },
    { tag: 'input', doc: 'Input element', attrs: 'type="$1"', selfClosing: true },
    { tag: 'img', doc: 'Image element', attrs: 'src="$1" alt="$2"', selfClosing: true },
    { tag: 'h1', doc: 'Heading level 1' },
    { tag: 'h2', doc: 'Heading level 2' },
    { tag: 'h3', doc: 'Heading level 3' },
    { tag: 'h4', doc: 'Heading level 4' },
    { tag: 'h5', doc: 'Heading level 5' },
    { tag: 'h6', doc: 'Heading level 6' },
    { tag: 'ul', doc: 'Unordered list' },
    { tag: 'ol', doc: 'Ordered list' },
    { tag: 'li', doc: 'List item' },
    { tag: 'nav', doc: 'Navigation section' },
    { tag: 'header', doc: 'Header section' },
    { tag: 'footer', doc: 'Footer section' },
    { tag: 'main', doc: 'Main content' },
    { tag: 'section', doc: 'Generic section' },
    { tag: 'article', doc: 'Article content' },
    { tag: 'aside', doc: 'Sidebar content' },
    { tag: 'form', doc: 'Form element' },
    { tag: 'label', doc: 'Form label', attrs: 'for="$1"' },
    { tag: 'select', doc: 'Dropdown select' },
    { tag: 'option', doc: 'Select option', attrs: 'value="$1"' },
    { tag: 'textarea', doc: 'Multi-line text input' },
    { tag: 'table', doc: 'Table element' },
    { tag: 'thead', doc: 'Table header group' },
    { tag: 'tbody', doc: 'Table body group' },
    { tag: 'tr', doc: 'Table row' },
    { tag: 'th', doc: 'Table header cell' },
    { tag: 'td', doc: 'Table data cell' },
    { tag: 'br', doc: 'Line break', selfClosing: true },
    { tag: 'hr', doc: 'Horizontal rule', selfClosing: true },
    { tag: 'strong', doc: 'Strong emphasis (bold)' },
    { tag: 'em', doc: 'Emphasis (italic)' },
    { tag: 'code', doc: 'Inline code' },
    { tag: 'pre', doc: 'Preformatted text' },
    { tag: 'blockquote', doc: 'Block quotation' },
    { tag: 'slot', doc: 'Zenith slot for child content' }
];

// Common HTML attributes
const HTML_ATTRIBUTES = [
    'id', 'class', 'style', 'title', 'href', 'src', 'alt', 'type', 'name', 'value',
    'placeholder', 'disabled', 'checked', 'readonly', 'required', 'hidden'
];

// Zenith event handlers
const ZENITH_EVENTS = [
    'onclick', 'onchange', 'oninput', 'onsubmit', 'onkeydown', 'onkeyup',
    'onkeypress', 'onfocus', 'onblur', 'onmouseover', 'onmouseout'
];

// State analysis (mirrors compiler's scriptAnalysis.ts)
function extractStates(script: string): Map<string, string> {
    const states = new Map<string, string>();
    const statePattern = /state\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;\n]+)/g;
    let match;

    while ((match = statePattern.exec(script)) !== null) {
        if (match[1] && match[2]) {
            states.set(match[1], match[2].trim());
        }
    }

    return states;
}

// Extract functions from script
function extractFunctions(script: string): Array<{ name: string, params: string, isAsync: boolean }> {
    const functions: Array<{ name: string, params: string, isAsync: boolean }> = [];
    const funcPattern = /(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g;
    let match;

    while ((match = funcPattern.exec(script)) !== null) {
        if (match[2]) {
            functions.push({
                name: match[2],
                params: match[3] || '',
                isAsync: !!match[1]
            });
        }
    }

    // Also match arrow functions assigned to const/let
    const arrowPattern = /(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(async\s+)?\([^)]*\)\s*=>/g;
    while ((match = arrowPattern.exec(script)) !== null) {
        if (match[1]) {
            functions.push({
                name: match[1],
                params: '',
                isAsync: !!match[2]
            });
        }
    }

    return functions;
}

// Get script content from document
function getScriptContent(text: string): string {
    const match = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    return match ? match[1] : '';
}

// Check position context
function getPositionContext(text: string, offset: number): {
    inScript: boolean;
    inStyle: boolean;
    inTag: boolean;
    inExpression: boolean;
    inTemplate: boolean;
    inAttributeValue: boolean;
    tagName: string | null;
    currentWord: string;
} {
    const before = text.substring(0, offset);

    const scriptOpens = (before.match(/<script[^>]*>/gi) || []).length;
    const scriptCloses = (before.match(/<\/script>/gi) || []).length;
    const inScript = scriptOpens > scriptCloses;

    const styleOpens = (before.match(/<style[^>]*>/gi) || []).length;
    const styleCloses = (before.match(/<\/style>/gi) || []).length;
    const inStyle = styleOpens > styleCloses;

    const lastTagOpen = before.lastIndexOf('<');
    const lastTagClose = before.lastIndexOf('>');
    const inTag = lastTagOpen > lastTagClose;

    const lastBraceOpen = before.lastIndexOf('{');
    const lastBraceClose = before.lastIndexOf('}');
    const inExpression = lastBraceOpen > lastBraceClose && !inScript && !inStyle;

    const inTemplate = !inScript && !inStyle;

    // Check if inside attribute value
    const afterLastTag = before.substring(lastTagOpen);
    const quoteMatch = afterLastTag.match(/=["'][^"']*$/);
    const inAttributeValue = inTag && !!quoteMatch;

    let tagName: string | null = null;
    if (inTag) {
        const tagMatch = before.substring(lastTagOpen).match(/<\/?([A-Za-z][A-Za-z0-9-]*)/);
        if (tagMatch) {
            tagName = tagMatch[1];
        }
    }

    // Get current word being typed
    const wordMatch = before.match(/[a-zA-Z_$][a-zA-Z0-9_$]*$/);
    const currentWord = wordMatch ? wordMatch[0] : '';

    return { inScript, inStyle, inTag, inExpression, inTemplate, inAttributeValue, tagName, currentWord };
}

// Get project graph for a document
function getProjectGraph(docUri: string): ProjectGraph | null {
    const filePath = docUri.replace('file://', '');
    const projectRoot = detectProjectRoot(path.dirname(filePath));

    if (!projectRoot) {
        return null;
    }

    if (!projectGraphs.has(projectRoot)) {
        projectGraphs.set(projectRoot, buildProjectGraph(projectRoot));
    }

    return projectGraphs.get(projectRoot) || null;
}

// Invalidate project graph on file changes
function invalidateProjectGraph(uri: string) {
    const filePath = uri.replace('file://', '');
    const projectRoot = detectProjectRoot(path.dirname(filePath));
    if (projectRoot) {
        projectGraphs.delete(projectRoot);
    }
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['{', '<', '"', "'", '=', '.', ' ', ':', '(']
            },
            hoverProvider: true
        }
    };
});

connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const ctx = getPositionContext(text, offset);
    const completions: CompletionItem[] = [];

    const graph = getProjectGraph(params.textDocument.uri);
    const script = getScriptContent(text);
    const states = extractStates(script);
    const functions = extractFunctions(script);

    // Get line content before cursor
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const lineBefore = text.substring(lineStart, offset);

    // === SCRIPT CONTEXT ===
    if (ctx.inScript) {
        // ALWAYS offer hooks and state - from first letter
        // Filter based on what user is typing
        for (const hook of LIFECYCLE_HOOKS) {
            if (!ctx.currentWord || hook.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                completions.push({
                    label: hook.name,
                    kind: hook.kind,
                    detail: hook.name === 'state' ? 'Zenith State' : 'Zenith Lifecycle',
                    documentation: { kind: MarkupKind.Markdown, value: hook.doc },
                    insertText: hook.snippet,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `0_${hook.name}`, // Priority sort
                    preselect: hook.name === 'state' && ctx.currentWord.startsWith('s')
                });
            }
        }

        // Offer declared functions
        for (const func of functions) {
            if (!ctx.currentWord || func.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                completions.push({
                    label: func.name,
                    kind: CompletionItemKind.Function,
                    detail: `${func.isAsync ? 'async ' : ''}function ${func.name}(${func.params})`,
                    insertText: `${func.name}($0)`,
                    insertTextFormat: InsertTextFormat.Snippet
                });
            }
        }

        // Offer state variables
        for (const [name, value] of states) {
            if (!ctx.currentWord || name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                completions.push({
                    label: name,
                    kind: CompletionItemKind.Variable,
                    detail: `state ${name}`,
                    documentation: `Current value: ${value}`
                });
            }
        }
    }

    // === EXPRESSION CONTEXT {  } ===
    if (ctx.inExpression) {
        // State variables
        for (const [name, value] of states) {
            completions.push({
                label: name,
                kind: CompletionItemKind.Variable,
                detail: `state ${name}`,
                documentation: `Value: ${value}`,
                sortText: `0_${name}`
            });
        }

        // Functions
        for (const func of functions) {
            completions.push({
                label: func.name,
                kind: CompletionItemKind.Function,
                detail: `${func.isAsync ? 'async ' : ''}function`,
                insertText: `${func.name}()`,
                sortText: `1_${func.name}`
            });
        }
    }

    // === TEMPLATE CONTEXT (not in script/style) ===
    if (ctx.inTemplate && !ctx.inExpression && !ctx.inAttributeValue) {
        const isAfterOpenBracket = lineBefore.match(/<\s*$/);
        const isTypingTag = ctx.currentWord.length > 0 && !ctx.inTag;

        // Components and layouts (PascalCase)
        if (graph && (isAfterOpenBracket || (isTypingTag && /^[A-Z]/.test(ctx.currentWord)))) {
            for (const [name, info] of graph.layouts) {
                if (!ctx.currentWord || name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                    const propStr = info.props.length > 0 ? ` ${info.props[0]}="$1"` : '';
                    completions.push({
                        label: name,
                        kind: CompletionItemKind.Class,
                        detail: `layout`,
                        documentation: { kind: MarkupKind.Markdown, value: `**Layout** from \`${path.basename(info.filePath)}\`\n\nProps: ${info.props.join(', ') || 'none'}` },
                        insertText: isAfterOpenBracket
                            ? `${name}${propStr}>$0</${name}>`
                            : `<${name}${propStr}>$0</${name}>`,
                        insertTextFormat: InsertTextFormat.Snippet,
                        sortText: `0_${name}`
                    });
                }
            }

            for (const [name, info] of graph.components) {
                if (!ctx.currentWord || name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                    completions.push({
                        label: name,
                        kind: CompletionItemKind.Class,
                        detail: `component`,
                        documentation: { kind: MarkupKind.Markdown, value: `**Component** from \`${path.basename(info.filePath)}\`\n\nProps: ${info.props.join(', ') || 'none'}` },
                        insertText: isAfterOpenBracket
                            ? `${name} $0/>`
                            : `<${name} $0/>`,
                        insertTextFormat: InsertTextFormat.Snippet,
                        sortText: `0_${name}`
                    });
                }
            }
        }

        // HTML elements (lowercase)
        if (isAfterOpenBracket || (isTypingTag && /^[a-z]/.test(ctx.currentWord))) {
            for (const el of HTML_ELEMENTS) {
                if (!ctx.currentWord || el.tag.startsWith(ctx.currentWord.toLowerCase())) {
                    let snippet: string;
                    if (el.selfClosing) {
                        snippet = el.attrs ? `${el.tag} ${el.attrs} />` : `${el.tag} />`;
                    } else {
                        snippet = el.attrs ? `${el.tag} ${el.attrs}>$0</${el.tag}>` : `${el.tag}>$0</${el.tag}>`;
                    }

                    completions.push({
                        label: el.tag,
                        kind: CompletionItemKind.Property,
                        detail: 'HTML',
                        documentation: el.doc,
                        insertText: isAfterOpenBracket ? snippet : `<${snippet}>`,
                        insertTextFormat: InsertTextFormat.Snippet,
                        sortText: `1_${el.tag}`
                    });
                }
            }
        }
    }

    // === INSIDE TAG (attributes) ===
    if (ctx.inTag && ctx.tagName && !ctx.inAttributeValue) {
        // Component props
        if (/^[A-Z]/.test(ctx.tagName) && graph) {
            const component = resolveComponent(graph, ctx.tagName);
            if (component) {
                for (const prop of component.props) {
                    completions.push({
                        label: prop,
                        kind: CompletionItemKind.Property,
                        detail: `prop of <${ctx.tagName}>`,
                        insertText: `${prop}={$1}`,
                        insertTextFormat: InsertTextFormat.Snippet,
                        sortText: `0_${prop}`
                    });
                }
            }
        }

        // Zenith event handlers
        for (const event of ZENITH_EVENTS) {
            if (!ctx.currentWord || event.startsWith(ctx.currentWord.toLowerCase())) {
                completions.push({
                    label: event,
                    kind: CompletionItemKind.Event,
                    detail: 'Zenith event',
                    documentation: `Bind to ${event.replace('on', '')} event`,
                    insertText: `${event}="$1"`,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `1_${event}`
                });
            }
        }

        // HTML attributes
        for (const attr of HTML_ATTRIBUTES) {
            if (!ctx.currentWord || attr.startsWith(ctx.currentWord.toLowerCase())) {
                completions.push({
                    label: attr,
                    kind: CompletionItemKind.Property,
                    detail: 'HTML attribute',
                    insertText: `${attr}="$1"`,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `2_${attr}`
                });
            }
        }
    }

    // === INSIDE ATTRIBUTE VALUE ===
    if (ctx.inAttributeValue) {
        // If it's an event handler, offer functions
        const eventMatch = lineBefore.match(/on\w+="[^"]*$/);
        if (eventMatch) {
            for (const func of functions) {
                completions.push({
                    label: func.name,
                    kind: CompletionItemKind.Function,
                    detail: 'function',
                    insertText: func.name
                });
            }
        }
    }

    return completions;
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

connection.onHover((params: TextDocumentPositionParams): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const text = document.getText();
    const offset = document.offsetAt(params.position);

    // Get word at position
    const before = text.substring(0, offset);
    const after = text.substring(offset);
    const wordBefore = before.match(/[a-zA-Z0-9_$]*$/)?.[0] || '';
    const wordAfter = after.match(/^[a-zA-Z0-9_$]*/)?.[0] || '';
    const word = wordBefore + wordAfter;

    if (!word) return null;

    // Check lifecycle hooks
    const hook = LIFECYCLE_HOOKS.find(h => h.name === word);
    if (hook) {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: `### ${hook.name}\n\n${hook.doc}\n\n\`\`\`typescript\n${hook.snippet.replace(/\$\d/g, '').replace('$0', '// ...')}\n\`\`\``
            }
        };
    }

    // Check states
    const script = getScriptContent(text);
    const states = extractStates(script);
    if (states.has(word)) {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: `### state \`${word}\`\n\n**Type:** inferred\n\n**Initial value:** \`${states.get(word)}\``
            }
        };
    }

    // Check functions
    const functions = extractFunctions(script);
    const func = functions.find(f => f.name === word);
    if (func) {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: `### ${func.isAsync ? 'async ' : ''}function \`${func.name}\`\n\n\`\`\`typescript\n${func.isAsync ? 'async ' : ''}function ${func.name}(${func.params})\n\`\`\``
            }
        };
    }

    // Check components
    const graph = getProjectGraph(params.textDocument.uri);
    if (graph) {
        const component = resolveComponent(graph, word);
        if (component) {
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: `### ${component.type} \`<${component.name}>\`\n\n**File:** \`${component.filePath}\`\n\n**Props:** ${component.props.join(', ') || 'none'}`
                }
            };
        }
    }

    // Check HTML elements
    const htmlEl = HTML_ELEMENTS.find(e => e.tag === word);
    if (htmlEl) {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: `### HTML \`<${htmlEl.tag}>\`\n\n${htmlEl.doc}`
            }
        };
    }

    return null;
});

// Validate documents and provide diagnostics
documents.onDidChangeContent(change => {
    validateDocument(change.document);
});

documents.onDidOpen(event => {
    validateDocument(event.document);
});

async function validateDocument(document: TextDocument) {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const graph = getProjectGraph(document.uri);

    if (!graph) {
        connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
        return;
    }

    // Validate component references
    const componentPattern = /<([A-Z][a-zA-Z0-9]*)/g;
    let match;

    while ((match = componentPattern.exec(text)) !== null) {
        const componentName = match[1];
        const resolved = resolveComponent(graph, componentName);

        if (!resolved) {
            const startPos = document.positionAt(match.index + 1);
            const endPos = document.positionAt(match.index + 1 + componentName.length);

            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: { start: startPos, end: endPos },
                message: `Unknown component: '<${componentName}>'. Make sure it exists in src/layouts/ or src/components/`,
                source: 'zenith'
            });
        }
    }

    connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

// Watch for file changes
connection.onDidChangeWatchedFiles(params => {
    for (const change of params.changes) {
        invalidateProjectGraph(change.uri);
    }

    for (const doc of documents.all()) {
        validateDocument(doc);
    }
});

documents.listen(connection);
connection.listen();
