/**
 * Completion item provider.
 *
 * Stateless: takes the current document text + project graph and returns the
 * completion items appropriate for the cursor position. All catalogs are
 * imported from `metadata/*` and `router.ts`.
 */

import * as path from 'path';
import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    MarkupKind
} from 'vscode-languageserver/node';

import {
    DIRECTIVES,
    canPlaceDirective,
    getDirective,
    getDirectiveNames
} from './metadata/directive-metadata';

import {
    LIFECYCLE_HOOKS,
    PLATFORM_PRIMITIVES,
    HTML_ELEMENTS,
    HTML_ATTRIBUTES,
    DOM_EVENTS
} from './metadata/completion-metadata';

import {
    parseZenithImports,
    hasRouterImport,
    hasZenLinkImport,
    getAllModules
} from './imports';

import {
    ROUTER_FUNCTIONS,
    ZENLINK_PROPS
} from './router';

import { ProjectGraph, resolveComponent } from './project';

import {
    PositionContext,
    extractFunctions,
    extractLoopVariables,
    extractStates,
    getPositionContext,
    getScriptContent
} from './extractors';

/**
 * Produce completion items for the given document position.
 */
export function provideCompletions(
    text: string,
    offset: number,
    graph: ProjectGraph | null
): CompletionItem[] {
    const ctx = getPositionContext(text, offset);
    const script = getScriptContent(text);
    const states = extractStates(script);
    const functions = extractFunctions(script);
    const imports = parseZenithImports(script);
    const routerEnabled = hasRouterImport(imports);
    const zenLinkAvailable = hasZenLinkImport(imports) || routerEnabled;
    const loopVariables = extractLoopVariables(text);

    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const lineBefore = text.substring(lineStart, offset);

    const completions: CompletionItem[] = [];

    if (ctx.inScript) {
        addScriptContextCompletions(completions, ctx, lineBefore, {
            states,
            functions,
            routerEnabled
        });
    }

    if (ctx.inExpression) {
        addExpressionContextCompletions(completions, ctx, states, functions, loopVariables);
    }

    if (ctx.inTemplate && !ctx.inExpression && !ctx.inAttributeValue) {
        addTemplateContextCompletions(completions, ctx, lineBefore, graph, zenLinkAvailable);
    }

    if (ctx.inTag && ctx.tagName && !ctx.inAttributeValue) {
        addTagContextCompletions(completions, ctx, graph, zenLinkAvailable);
    }

    if (ctx.inAttributeValue) {
        addAttributeValueCompletions(completions, lineBefore, functions);
    }

    return completions;
}

interface ScriptDeps {
    states: Map<string, string>;
    functions: ReturnType<typeof extractFunctions>;
    routerEnabled: boolean;
}

function addScriptContextCompletions(
    completions: CompletionItem[],
    ctx: PositionContext,
    lineBefore: string,
    deps: ScriptDeps
) {
    const { states, functions, routerEnabled } = deps;

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

    for (const prim of PLATFORM_PRIMITIVES) {
        if (!ctx.currentWord || prim.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
            completions.push({
                label: prim.name,
                kind: prim.kind,
                detail: 'Zenith Platform',
                documentation: { kind: MarkupKind.Markdown, value: prim.doc },
                insertText: prim.snippet,
                insertTextFormat: InsertTextFormat.Snippet,
                sortText: `0_${prim.name}`
            });
        }
    }

    const lc = ctx.currentWord.toLowerCase();
    if (lc === 'window' || lc.startsWith('wind')) {
        completions.push({
            label: 'zenWindow',
            kind: CompletionItemKind.Function,
            detail: 'Zenith (SSR-safe)',
            documentation: { kind: MarkupKind.Markdown, value: 'Use zenWindow() instead of window for SSR-safe access.' },
            insertText: 'zenWindow()',
            sortText: '0_zenWindow'
        });
    }
    if (lc === 'document' || lc.startsWith('doc')) {
        completions.push({
            label: 'zenDocument',
            kind: CompletionItemKind.Function,
            detail: 'Zenith (SSR-safe)',
            documentation: { kind: MarkupKind.Markdown, value: 'Use zenDocument() instead of document for SSR-safe access.' },
            insertText: 'zenDocument()',
            sortText: '0_zenDocument'
        });
    }

    if (routerEnabled) {
        for (const fn of ROUTER_FUNCTIONS) {
            if (!ctx.currentWord || fn.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                completions.push({
                    label: fn.name,
                    kind: CompletionItemKind.Function,
                    detail: '@zenithbuild/router',
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: `${fn.description}\n\n**Signature:**\n\`\`\`typescript\n${fn.signature}\n\`\`\``
                    },
                    insertText: `${fn.name}($0)`,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `0_${fn.name}`
                });
            }
        }
    }

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

function addExpressionContextCompletions(
    completions: CompletionItem[],
    _ctx: PositionContext,
    states: Map<string, string>,
    functions: ReturnType<typeof extractFunctions>,
    loopVariables: string[]
) {
    for (const [name, value] of states) {
        completions.push({
            label: name,
            kind: CompletionItemKind.Variable,
            detail: `state ${name}`,
            documentation: `Value: ${value}`,
            sortText: `0_${name}`
        });
    }

    for (const func of functions) {
        completions.push({
            label: func.name,
            kind: CompletionItemKind.Function,
            detail: `${func.isAsync ? 'async ' : ''}function`,
            insertText: `${func.name}()`,
            sortText: `1_${func.name}`
        });
    }

    for (const loopVar of loopVariables) {
        completions.push({
            label: loopVar,
            kind: CompletionItemKind.Variable,
            detail: 'loop variable',
            sortText: `0_${loopVar}`
        });
    }
}

function addTemplateContextCompletions(
    completions: CompletionItem[],
    ctx: PositionContext,
    lineBefore: string,
    graph: ProjectGraph | null,
    zenLinkAvailable: boolean
) {
    const isAfterOpenBracket = !!lineBefore.match(/<\s*$/);
    const isTypingTag = ctx.currentWord.length > 0 && !ctx.inTag;

    if (graph && (isAfterOpenBracket || (isTypingTag && /^[A-Z]/.test(ctx.currentWord)))) {
        for (const [name, info] of graph.layouts) {
            if (!ctx.currentWord || name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                const propStr = info.props.length > 0 ? ` ${info.props[0]}="$1"` : '';
                completions.push({
                    label: name,
                    kind: CompletionItemKind.Class,
                    detail: 'layout',
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: `**Layout** from \`${path.basename(info.filePath)}\`\n\nProps: ${info.props.join(', ') || 'none'}`
                    },
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
                    detail: 'component',
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: `**Component** from \`${path.basename(info.filePath)}\`\n\nProps: ${info.props.join(', ') || 'none'}`
                    },
                    insertText: isAfterOpenBracket
                        ? `${name} $0/>`
                        : `<${name} $0/>`,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `0_${name}`
                });
            }
        }
    }

    if (zenLinkAvailable && (isAfterOpenBracket || (isTypingTag && ctx.currentWord.toLowerCase().startsWith('z')))) {
        completions.push({
            label: 'ZenLink',
            kind: CompletionItemKind.Class,
            detail: '@zenithbuild/router/ZenLink.zen',
            documentation: {
                kind: MarkupKind.Markdown,
                value: '**ZenLink** — canonical soft-navigation anchor.\n\nRenders a real `<a data-zen-link="true" href="...">`. Children inline into the single implicit slot; there is no `children` prop.\n\n**Import:**\n```ts\nimport ZenLink from "@zenithbuild/router/ZenLink.zen";\n```\n\n**Props:** `href` (required), `class`, `target`, `rel`, `id`, `title`, `ariaLabel`, `ariaCurrent`, `ariaDisabled`, `elementRef`, `onClick`, `onHoverIn`, `onHoverOut`, `onFocus`, `onBlur`.'
            },
            insertText: isAfterOpenBracket ? 'ZenLink href="$1">$0</ZenLink>' : '<ZenLink href="$1">$0</ZenLink>',
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: '0_ZenLink'
        });
    }

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

function addTagContextCompletions(
    completions: CompletionItem[],
    ctx: PositionContext,
    graph: ProjectGraph | null,
    zenLinkAvailable: boolean
) {
    const elementType = ctx.tagName === 'slot'
        ? 'slot'
        : (/^[A-Z]/.test(ctx.tagName!) ? 'component' : 'element');

    for (const directiveName of getDirectiveNames()) {
        if (canPlaceDirective(directiveName, elementType as 'element' | 'component' | 'slot')) {
            if (!ctx.currentWord || directiveName.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                const directive = getDirective(directiveName);
                if (directive) {
                    completions.push({
                        label: directive.name,
                        kind: CompletionItemKind.Keyword,
                        detail: directive.category,
                        documentation: {
                            kind: MarkupKind.Markdown,
                            value: `${directive.description}\n\n**Syntax:** \`${directive.syntax}\``
                        },
                        insertText: `${directive.name}="$1"`,
                        insertTextFormat: InsertTextFormat.Snippet,
                        sortText: `0_${directive.name}`
                    });
                }
            }
        }
    }

    if (!ctx.currentWord || ctx.currentWord.startsWith('on:') || ctx.currentWord === 'on') {
        for (const event of DOM_EVENTS) {
            completions.push({
                label: `on:${event}`,
                kind: CompletionItemKind.Event,
                detail: 'event binding',
                documentation: `Bind to ${event} event`,
                insertText: `on:${event}={$1}`,
                insertTextFormat: InsertTextFormat.Snippet,
                sortText: `1_on:${event}`
            });
        }
    }

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

    if (/^[A-Z]/.test(ctx.tagName!) && graph) {
        const component = resolveComponent(graph, ctx.tagName!);
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

    if (zenLinkAvailable && ctx.tagName === 'ZenLink') {
        for (const prop of ZENLINK_PROPS) {
            if (!ctx.currentWord || prop.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
                const stringLike = prop.type === 'string' || prop.type.startsWith('Ref<');
                const insertText = stringLike
                    ? `${prop.name}="$1"`
                    : `${prop.name}={$1}`;
                completions.push({
                    label: prop.name,
                    kind: CompletionItemKind.Property,
                    detail: prop.required ? `${prop.type} (required)` : prop.type,
                    documentation: prop.description,
                    insertText,
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: prop.required ? `0_${prop.name}` : `1_${prop.name}`
                });
            }
        }
    }

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

function addAttributeValueCompletions(
    completions: CompletionItem[],
    lineBefore: string,
    functions: ReturnType<typeof extractFunctions>
) {
    const eventMatch = lineBefore.match(/on:[a-zA-Z][a-zA-Z0-9_-]*=["'{][^"'{}]*$/);
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

void DIRECTIVES;
