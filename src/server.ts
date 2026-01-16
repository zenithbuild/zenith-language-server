/**
 * Zenith Language Server
 * 
 * Provides full IntelliSense for Zenith .zen files.
 * 
 * Architecture Principles:
 * - Compiler is the source of truth
 * - No runtime assumptions
 * - Static analysis only
 * - Graceful degradation for missing plugins
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

import { 
    DIRECTIVES, 
    isDirective, 
    getDirective, 
    getDirectiveNames,
    canPlaceDirective,
    parseForExpression 
} from './metadata/directive-metadata';

import { 
    parseZenithImports, 
    hasRouterImport, 
    resolveModule, 
    resolveExport,
    getAllModules,
    getModuleExports 
} from './imports';

import { 
    ROUTER_HOOKS, 
    ZENLINK_PROPS, 
    ROUTE_FIELDS,
    getRouterHook,
    isRouterHook,
    getZenLinkPropNames
} from './router';

import { collectDiagnostics } from './diagnostics';

// Create connection and document manager
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Project graph cache
let projectGraphs: Map<string, ProjectGraph> = new Map();

// Lifecycle hooks with documentation
const LIFECYCLE_HOOKS = [
    { name: 'state', doc: 'Declare a reactive state variable', snippet: 'state ${1:name} = ${2:value}', kind: CompletionItemKind.Keyword },
    { name: 'zenOnMount', doc: 'Called when component is mounted to the DOM', snippet: 'zenOnMount(() => {\n\t$0\n})', kind: CompletionItemKind.Function },
    { name: 'zenOnDestroy', doc: 'Called when component is removed from the DOM', snippet: 'zenOnDestroy(() => {\n\t$0\n})', kind: CompletionItemKind.Function },
    { name: 'zenOnUpdate', doc: 'Called after any state update causes a re-render', snippet: 'zenOnUpdate(() => {\n\t$0\n})', kind: CompletionItemKind.Function },
    { name: 'zenEffect', doc: 'Reactive effect that re-runs when dependencies change', snippet: 'zenEffect(() => {\n\t$0\n})', kind: CompletionItemKind.Function },
    { name: 'useFetch', doc: 'Fetch data with caching and SSG support', snippet: 'useFetch("${1:url}")', kind: CompletionItemKind.Function }
];

// Common HTML elements
const HTML_ELEMENTS = [
    { tag: 'div', doc: 'Generic container element' },
    { tag: 'span', doc: 'Inline container element' },
    { tag: 'p', doc: 'Paragraph element' },
    { tag: 'a', doc: 'Anchor/link element', attrs: 'href="$1"' },
    { tag: 'button', doc: 'Button element', attrs: 'onclick={$1}' },
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

// DOM events for @event and onclick handlers
const DOM_EVENTS = [
    'click', 'change', 'input', 'submit', 'keydown', 'keyup', 'keypress',
    'focus', 'blur', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave'
];

// State analysis
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

    // Arrow functions assigned to const/let
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

// Extract loop variables from zen:for directives
function extractLoopVariables(text: string): string[] {
    const vars: string[] = [];
    const loopPattern = /zen:for\s*=\s*["']([^"']+)["']/g;
    let match;
    
    while ((match = loopPattern.exec(text)) !== null) {
        const parsed = parseForExpression(match[1]);
        if (parsed) {
            vars.push(parsed.itemVar);
            if (parsed.indexVar) vars.push(parsed.indexVar);
        }
    }
    
    return vars;
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
    afterAt: boolean;
    afterColon: boolean;
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
    const wordMatch = before.match(/[a-zA-Z_$:@][a-zA-Z0-9_$:-]*$/);
    const currentWord = wordMatch ? wordMatch[0] : '';
    
    // Check for @ or : prefix for event/binding completion
    const afterAt = before.endsWith('@') || currentWord.startsWith('@');
    const afterColon = before.endsWith(':') || (currentWord.startsWith(':') && !currentWord.startsWith(':'));

    return { inScript, inStyle, inTag, inExpression, inTemplate, inAttributeValue, tagName, currentWord, afterAt, afterColon };
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
                triggerCharacters: ['{', '<', '"', "'", '=', '.', ' ', ':', '(', '@']
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
    const imports = parseZenithImports(script);
    const routerEnabled = hasRouterImport(imports);
    const loopVariables = extractLoopVariables(text);

    // Get line content before cursor
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const lineBefore = text.substring(lineStart, offset);

    // === SCRIPT CONTEXT ===
    if (ctx.inScript) {
        // Lifecycle hooks and state
        for (const hook of LIFECYCLE_HOOKS) {
            if (!ctx.currentWord || hook.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                completions.push({
                    label: hook.name,
                    kind: hook.kind,
                    detail: hook.name === 'state' ? 'Zenith State' : 'Zenith Lifecycle',
                    documentation: { kind: MarkupKind.Markdown, value: hook.doc },
                    insertText: hook.snippet,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `0_${hook.name}`,
                    preselect: hook.name === 'state' && ctx.currentWord.startsWith('s')
                });
            }
        }

        // Router hooks when router is imported
        if (routerEnabled) {
            for (const hook of Object.values(ROUTER_HOOKS)) {
                if (!ctx.currentWord || hook.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                    completions.push({
                        label: hook.name,
                        kind: CompletionItemKind.Function,
                        detail: hook.owner,
                        documentation: { kind: MarkupKind.Markdown, value: `${hook.description}\n\n**Returns:** \`${hook.returns}\`` },
                        insertText: `${hook.name}()`,
                        sortText: `0_${hook.name}`
                    });
                }
            }
        }

        // Declared functions
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

        // State variables
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

        // Import path completions
        const isImportPath = /from\s+['"][^'"]*$/.test(lineBefore) || /import\s+['"][^'"]*$/.test(lineBefore);
        if (isImportPath) {
            for (const mod of getAllModules()) {
                completions.push({
                    label: mod.module,
                    kind: CompletionItemKind.Module,
                    detail: mod.kind === 'plugin' ? 'Zenith Plugin' : 'Zenith Core',
                    documentation: mod.description,
                    insertText: mod.module
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

        // Loop variables
        for (const loopVar of loopVariables) {
            completions.push({
                label: loopVar,
                kind: CompletionItemKind.Variable,
                detail: 'loop variable',
                sortText: `0_${loopVar}`
            });
        }

        // Route fields when router is imported
        if (routerEnabled) {
            for (const field of ROUTE_FIELDS) {
                completions.push({
                    label: `route.${field.name}`,
                    kind: CompletionItemKind.Property,
                    detail: field.type,
                    documentation: field.description,
                    sortText: `2_route_${field.name}`
                });
            }
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

        // ZenLink when router is imported
        if (routerEnabled && (isAfterOpenBracket || (isTypingTag && ctx.currentWord.toLowerCase().startsWith('z')))) {
            completions.push({
                label: 'ZenLink',
                kind: CompletionItemKind.Class,
                detail: 'router component',
                documentation: { kind: MarkupKind.Markdown, value: '**Router Component** (zenith/router)\n\nDeclarative navigation component for routes.\n\n**Props:** to, preload, replace, class, activeClass' },
                insertText: isAfterOpenBracket ? 'ZenLink to="$1">$0</ZenLink>' : '<ZenLink to="$1">$0</ZenLink>',
                insertTextFormat: InsertTextFormat.Snippet,
                sortText: '0_ZenLink'
            });
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
        // Directives (zen:if, zen:for, etc.)
        const elementType = ctx.tagName === 'slot' ? 'slot' : (/^[A-Z]/.test(ctx.tagName) ? 'component' : 'element');
        
        for (const directiveName of getDirectiveNames()) {
            if (canPlaceDirective(directiveName, elementType as 'element' | 'component' | 'slot')) {
                if (!ctx.currentWord || directiveName.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                    const directive = getDirective(directiveName);
                    if (directive) {
                        completions.push({
                            label: directive.name,
                            kind: CompletionItemKind.Keyword,
                            detail: directive.category,
                            documentation: { kind: MarkupKind.Markdown, value: `${directive.description}\n\n**Syntax:** \`${directive.syntax}\`` },
                            insertText: `${directive.name}="$1"`,
                            insertTextFormat: InsertTextFormat.Snippet,
                            sortText: `0_${directive.name}`
                        });
                    }
                }
            }
        }

        // @event completions
        if (ctx.afterAt || ctx.currentWord.startsWith('@')) {
            for (const event of DOM_EVENTS) {
                completions.push({
                    label: `@${event}`,
                    kind: CompletionItemKind.Event,
                    detail: 'event binding',
                    documentation: `Bind to ${event} event`,
                    insertText: `@${event}={$1}`,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `1_@${event}`
                });
            }
        }

        // :prop reactive bindings
        if (ctx.afterColon || ctx.currentWord.startsWith(':')) {
            for (const attr of HTML_ATTRIBUTES) {
                completions.push({
                    label: `:${attr}`,
                    kind: CompletionItemKind.Property,
                    detail: 'reactive binding',
                    documentation: `Reactive binding for ${attr}`,
                    insertText: `:${attr}="$1"`,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `1_:${attr}`
                });
            }
        }

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

        // ZenLink props
        if (routerEnabled && ctx.tagName === 'ZenLink') {
            for (const prop of ZENLINK_PROPS) {
                if (!ctx.currentWord || prop.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                    completions.push({
                        label: prop.name,
                        kind: CompletionItemKind.Property,
                        detail: prop.required ? `${prop.type} (required)` : prop.type,
                        documentation: prop.description,
                        insertText: prop.name === 'to' ? `${prop.name}="$1"` : `${prop.name}`,
                        insertTextFormat: InsertTextFormat.Snippet,
                        sortText: prop.required ? `0_${prop.name}` : `1_${prop.name}`
                    });
                }
            }
        }

        // Standard event handlers (onclick, onchange, etc.)
        for (const event of DOM_EVENTS) {
            const onEvent = `on${event}`;
            if (!ctx.currentWord || onEvent.startsWith(ctx.currentWord.toLowerCase())) {
                completions.push({
                    label: onEvent,
                    kind: CompletionItemKind.Event,
                    detail: 'event handler',
                    documentation: `Bind to ${event} event`,
                    insertText: `${onEvent}={$1}`,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `2_${onEvent}`
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
                    sortText: `3_${attr}`
                });
            }
        }
    }

    // === INSIDE ATTRIBUTE VALUE ===
    if (ctx.inAttributeValue) {
        // Event handler: offer functions
        const eventMatch = lineBefore.match(/(?:on\w+|@\w+)=["'{][^"'{}]*$/);
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

    // Get word at position (including : and @ prefixes)
    const before = text.substring(0, offset);
    const after = text.substring(offset);
    const wordBefore = before.match(/[a-zA-Z0-9_$:@-]*$/)?.[0] || '';
    const wordAfter = after.match(/^[a-zA-Z0-9_$:-]*/)?.[0] || '';
    const word = wordBefore + wordAfter;

    if (!word) return null;

    // Check directives (zen:if, zen:for, etc.)
    if (isDirective(word)) {
        const directive = getDirective(word);
        if (directive) {
            let notes = '';
            if (directive.name === 'zen:for') {
                notes = '- No runtime loop\n- Compiled into static DOM instructions\n- Creates scope: `item`, `index`';
            } else {
                notes = '- Compile-time directive\n- No runtime assumptions\n- Processed at build time';
            }
            
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: `### ${directive.name}\n\n${directive.description}\n\n**Syntax:** \`${directive.syntax}\`\n\n**Notes:**\n${notes}\n\n**Example:**\n\`\`\`html\n${directive.example}\n\`\`\``
                }
            };
        }
    }

    // Check router hooks
    if (isRouterHook(word)) {
        const hook = getRouterHook(word);
        if (hook) {
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: `### ${hook.name}()\n\n**${hook.owner}**\n\n${hook.description}\n\n**Restrictions:** ${hook.restrictions}\n\n**Returns:** \`${hook.returns}\`\n\n**Signature:**\n\`\`\`typescript\n${hook.signature}\n\`\`\``
                }
            };
        }
    }

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

    // Check ZenLink
    if (word === 'ZenLink') {
        const script = getScriptContent(text);
        const imports = parseZenithImports(script);
        if (hasRouterImport(imports)) {
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: '### `<ZenLink>`\n\n**Router Component** (zenith/router)\n\nDeclarative navigation component for routes.\n\n**Props:**\n- `to` (string, required) - Route path\n- `preload` (boolean) - Prefetch on hover\n- `replace` (boolean) - Replace history entry\n- `class` (string) - CSS class\n- `activeClass` (string) - Class when active'
                }
            };
        }
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

    // Check imports
    const imports = parseZenithImports(script);
    for (const imp of imports) {
        if (imp.specifiers.includes(word)) {
            const exportMeta = resolveExport(imp.module, word);
            if (exportMeta) {
                const resolved = resolveModule(imp.module);
                const owner = resolved.kind === 'plugin' ? 'Plugin' : resolved.kind === 'core' ? 'Core' : 'External';
                return {
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: `### ${word}\n\n**${owner}** (${imp.module})\n\n${exportMeta.description}\n\n**Signature:**\n\`\`\`typescript\n${exportMeta.signature || word}\n\`\`\``
                    }
                };
            }
        }
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
    const graph = getProjectGraph(document.uri);
    const diagnostics = collectDiagnostics(document, graph);
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
