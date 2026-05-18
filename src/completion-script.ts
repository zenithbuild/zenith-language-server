/**
 * Script-context completion: top-level catalogs + member-access branch.
 *
 * Split out of `completion.ts` so the orchestrator stays small and the
 * member-access path has a single clear place to short-circuit.
 *
 * Key contract for member access (`receiver.` or `receiver.partial`):
 *   - signal / ref / runtimeState  -> only that receiver's members
 *   - declarativeState              -> empty list (compiler lowering, no .get/.set surface)
 *   - unknown receiver              -> empty list (do NOT dump primitives)
 *
 * Top-level (no member access) preserves the prior catalog dump filtered by
 * `currentWord`, so typing `sig` still surfaces `signal`.
 */

import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    MarkupKind
} from 'vscode-languageserver/node';

import {
    LIFECYCLE_HOOKS,
    PLATFORM_PRIMITIVES
} from './metadata/completion-metadata';

import { ROUTER_FUNCTIONS } from './router';
import { getAllModules } from './imports';

import {
    extractFunctions,
    type PositionContext
} from './extractors';

import {
    extractBindings,
    resolveReceiverKind,
    type BindingKind
} from './extractors-bindings';

import { memberCompletionItems } from './metadata/receiver-members';

export interface ScriptDeps {
    states: Map<string, string>;
    functions: ReturnType<typeof extractFunctions>;
    bindings: Map<string, BindingKind>;
    routerEnabled: boolean;
}

/**
 * Build script-context completions.
 *
 * Returns `null` only when we explicitly want the orchestrator to fall through
 * to template/tag handlers; otherwise returns the items to append (which may
 * legitimately be empty — empty for member access on unknown receiver).
 */
export function buildScriptCompletions(
    ctx: PositionContext,
    lineBefore: string,
    deps: ScriptDeps
): CompletionItem[] {
    if (ctx.memberAccess) {
        return memberAccessCompletions(ctx, deps);
    }

    const completions: CompletionItem[] = [];
    addLifecycleHooks(completions, ctx);
    addPlatformPrimitives(completions, ctx);
    addSsrSafeShortcuts(completions, ctx);
    if (deps.routerEnabled) {
        addRouterFunctions(completions, ctx);
    }
    addDeclaredFunctions(completions, ctx, deps.functions);
    addDeclarativeStates(completions, ctx, deps.states);
    addImportPathModules(completions, lineBefore);
    return completions;
}

/**
 * Member completion shortcut.
 *
 * Short-circuits ahead of every other catalog when the cursor is at
 * `receiver.`, returning only the resolved kind's members (or nothing).
 */
function memberAccessCompletions(
    ctx: PositionContext,
    deps: ScriptDeps
): CompletionItem[] {
    if (!ctx.memberAccess) {
        return [];
    }
    const kind = resolveReceiverKind(
        ctx.memberAccess.receiver,
        deps.bindings,
        deps.states
    );
    if (kind === 'unknown' || kind === 'declarativeState') {
        return [];
    }
    return memberCompletionItems(kind, ctx.memberAccess.memberPrefix);
}

function addLifecycleHooks(completions: CompletionItem[], ctx: PositionContext): void {
    for (const hook of LIFECYCLE_HOOKS) {
        if (!matchesPrefix(hook.name, ctx.currentWord)) {
            continue;
        }
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

function addPlatformPrimitives(completions: CompletionItem[], ctx: PositionContext): void {
    for (const prim of PLATFORM_PRIMITIVES) {
        if (!matchesPrefix(prim.name, ctx.currentWord)) {
            continue;
        }
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

function addSsrSafeShortcuts(completions: CompletionItem[], ctx: PositionContext): void {
    const lc = ctx.currentWord.toLowerCase();
    if (lc === 'window' || lc.startsWith('wind')) {
        completions.push({
            label: 'zenWindow',
            kind: CompletionItemKind.Function,
            detail: 'Zenith (SSR-safe)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Use zenWindow() instead of window for SSR-safe access.'
            },
            insertText: 'zenWindow()',
            sortText: '0_zenWindow'
        });
    }
    if (lc === 'document' || lc.startsWith('doc')) {
        completions.push({
            label: 'zenDocument',
            kind: CompletionItemKind.Function,
            detail: 'Zenith (SSR-safe)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Use zenDocument() instead of document for SSR-safe access.'
            },
            insertText: 'zenDocument()',
            sortText: '0_zenDocument'
        });
    }
}

function addRouterFunctions(completions: CompletionItem[], ctx: PositionContext): void {
    for (const fn of ROUTER_FUNCTIONS) {
        if (!matchesPrefix(fn.name, ctx.currentWord)) {
            continue;
        }
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

function addDeclaredFunctions(
    completions: CompletionItem[],
    ctx: PositionContext,
    functions: ReturnType<typeof extractFunctions>
): void {
    for (const func of functions) {
        if (!matchesPrefix(func.name, ctx.currentWord)) {
            continue;
        }
        completions.push({
            label: func.name,
            kind: CompletionItemKind.Function,
            detail: `${func.isAsync ? 'async ' : ''}function ${func.name}(${func.params})`,
            insertText: `${func.name}($0)`,
            insertTextFormat: InsertTextFormat.Snippet
        });
    }
}

function addDeclarativeStates(
    completions: CompletionItem[],
    ctx: PositionContext,
    states: Map<string, string>
): void {
    for (const [name, value] of states) {
        if (!matchesPrefix(name, ctx.currentWord)) {
            continue;
        }
        completions.push({
            label: name,
            kind: CompletionItemKind.Variable,
            detail: `state ${name}`,
            documentation: `Current value: ${value}`
        });
    }
}

function addImportPathModules(completions: CompletionItem[], lineBefore: string): void {
    const isImportPath = /from\s+['"][^'"]*$/.test(lineBefore) || /import\s+['"][^'"]*$/.test(lineBefore);
    if (!isImportPath) {
        return;
    }
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

function matchesPrefix(name: string, prefix: string): boolean {
    return !prefix || name.toLowerCase().startsWith(prefix.toLowerCase());
}

export { extractBindings };
