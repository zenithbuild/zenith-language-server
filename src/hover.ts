/**
 * Hover provider.
 *
 * Stateless: takes the current document text + project graph and returns the
 * hover content for the word at the cursor.
 */

import { Hover, MarkupKind } from 'vscode-languageserver/node';

import {
    getDirective,
    isDirective
} from './metadata/directive-metadata';

import {
    LIFECYCLE_HOOKS,
    PLATFORM_PRIMITIVES,
    HTML_ELEMENTS
} from './metadata/completion-metadata';

import {
    hasRouterImport,
    hasZenLinkImport,
    parseZenithImports,
    resolveExport,
    resolveModule
} from './imports';

import {
    getRouterFunction,
    isRouterFunction
} from './router';

import {
    ProjectGraph,
    resolveComponent
} from './project';

import {
    extractFunctions,
    extractStates,
    getScriptContent
} from './extractors';

export function provideHover(
    text: string,
    offset: number,
    graph: ProjectGraph | null
): Hover | null {
    const before = text.substring(0, offset);
    const after = text.substring(offset);
    const wordBefore = before.match(/[a-zA-Z0-9_$:@-]*$/)?.[0] || '';
    const wordAfter = after.match(/^[a-zA-Z0-9_$:-]*/)?.[0] || '';
    const word = wordBefore + wordAfter;

    if (!word) return null;

    const directiveHover = hoverDirective(word);
    if (directiveHover) return directiveHover;

    const routerHover = hoverRouterFunction(word);
    if (routerHover) return routerHover;

    const lifecycleHover = hoverLifecycle(word);
    if (lifecycleHover) return lifecycleHover;

    const platformHover = hoverPlatform(word);
    if (platformHover) return platformHover;

    const zenLinkHover = hoverZenLink(word, text);
    if (zenLinkHover) return zenLinkHover;

    const script = getScriptContent(text);

    const stateHover = hoverState(word, script);
    if (stateHover) return stateHover;

    const functionHover = hoverFunction(word, script);
    if (functionHover) return functionHover;

    const importHover = hoverImport(word, script);
    if (importHover) return importHover;

    if (graph) {
        const componentHover = hoverComponent(word, graph);
        if (componentHover) return componentHover;
    }

    return hoverHtmlElement(word);
}

function hoverDirective(word: string): Hover | null {
    if (!isDirective(word)) return null;
    const directive = getDirective(word);
    if (!directive) return null;

    const notes = directive.name === 'zen:for'
        ? '- No runtime loop\n- Compiled into static DOM instructions\n- Creates scope: `item`, `index`'
        : '- Compile-time directive\n- No runtime assumptions\n- Processed at build time';

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: `### ${directive.name}\n\n${directive.description}\n\n**Syntax:** \`${directive.syntax}\`\n\n**Notes:**\n${notes}\n\n**Example:**\n\`\`\`html\n${directive.example}\n\`\`\``
        }
    };
}

function hoverRouterFunction(word: string): Hover | null {
    if (!isRouterFunction(word)) return null;
    const fn = getRouterFunction(word);
    if (!fn) return null;

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: `### ${fn.name}\n\n**@zenithbuild/router**\n\n${fn.description}\n\n**Signature:**\n\`\`\`typescript\n${fn.signature}\n\`\`\``
        }
    };
}

function hoverLifecycle(word: string): Hover | null {
    const hook = LIFECYCLE_HOOKS.find((h) => h.name === word);
    if (!hook) return null;
    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: `### ${hook.name}\n\n${hook.doc}\n\n\`\`\`typescript\n${hook.snippet.replace(/\$\d/g, '').replace('$0', '// ...')}\n\`\`\``
        }
    };
}

function hoverPlatform(word: string): Hover | null {
    const platform = PLATFORM_PRIMITIVES.find((p) => p.name === word);
    if (!platform) return null;
    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: `### ${platform.name}\n\n${platform.doc}`
        }
    };
}

function hoverZenLink(word: string, text: string): Hover | null {
    if (word !== 'ZenLink') return null;
    const script = getScriptContent(text);
    const imports = parseZenithImports(script);
    if (!hasZenLinkImport(imports) && !hasRouterImport(imports)) return null;

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: '### `<ZenLink>`\n\n**@zenithbuild/router/ZenLink.zen**\n\nCanonical soft-navigation anchor. Renders a real `<a data-zen-link="true" href="...">`. Children are inlined through the single implicit slot — there is no `children` prop.\n\n**Import:**\n```ts\nimport ZenLink from "@zenithbuild/router/ZenLink.zen";\n```\n\n**Required props:**\n- `href` (string)\n\n**Optional props:**\n- `class`, `target`, `rel`, `id`, `title`\n- `ariaLabel`, `ariaCurrent`, `ariaDisabled`\n- `elementRef`\n- `onClick`, `onHoverIn`, `onHoverOut`, `onFocus`, `onBlur`\n\n**Not props on ZenLink:** `to`, `preload`, `replace`, `activeClass`, `children`.'
        }
    };
}

function hoverState(word: string, script: string): Hover | null {
    const states = extractStates(script);
    if (!states.has(word)) return null;

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: `### state \`${word}\`\n\n**Type:** inferred\n\n**Initial value:** \`${states.get(word)}\``
        }
    };
}

function hoverFunction(word: string, script: string): Hover | null {
    const functions = extractFunctions(script);
    const func = functions.find((f) => f.name === word);
    if (!func) return null;

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: `### ${func.isAsync ? 'async ' : ''}function \`${func.name}\`\n\n\`\`\`typescript\n${func.isAsync ? 'async ' : ''}function ${func.name}(${func.params})\n\`\`\``
        }
    };
}

function hoverImport(word: string, script: string): Hover | null {
    const imports = parseZenithImports(script);
    for (const imp of imports) {
        if (imp.specifiers.includes(word)) {
            const exportMeta = resolveExport(imp.module, word);
            if (exportMeta) {
                const resolved = resolveModule(imp.module);
                const owner = resolved.kind === 'plugin'
                    ? 'Plugin'
                    : resolved.kind === 'core'
                        ? 'Core'
                        : 'External';
                return {
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: `### ${word}\n\n**${owner}** (${imp.module})\n\n${exportMeta.description}\n\n**Signature:**\n\`\`\`typescript\n${exportMeta.signature || word}\n\`\`\``
                    }
                };
            }
        }
    }
    return null;
}

function hoverComponent(word: string, graph: ProjectGraph): Hover | null {
    const component = resolveComponent(graph, word);
    if (!component) return null;
    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: `### ${component.type} \`<${component.name}>\`\n\n**File:** \`${component.filePath}\`\n\n**Props:** ${component.props.join(', ') || 'none'}`
        }
    };
}

function hoverHtmlElement(word: string): Hover | null {
    const htmlEl = HTML_ELEMENTS.find((e) => e.tag === word);
    if (!htmlEl) return null;
    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: `### HTML \`<${htmlEl.tag}>\`\n\n${htmlEl.doc}`
        }
    };
}
