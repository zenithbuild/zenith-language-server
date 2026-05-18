/**
 * Receiver-specific member completions.
 *
 * Source of truth: framework/packages/runtime/src/{signal,state,ref}.ts.
 * Signatures are copied verbatim from the runtime types so completion `detail`
 * strings match the actual TypeScript shape developers see.
 *
 * Used by member-access completion in script + expression contexts. Keeping
 * member catalogs separate from the broader `core-imports` metadata lets us
 * gate by receiver kind (signal/runtimeState/ref) without leaking unrelated
 * top-level primitives into `count.` completion.
 */

import { CompletionItemKind, InsertTextFormat, MarkupKind } from 'vscode-languageserver/node';
import type { CompletionItem } from 'vscode-languageserver/node';

import type { ReceiverKind } from '../extractors-bindings';

export interface MemberSpec {
    label: string;
    detail: string;
    documentation: string;
    insertText: string;
    snippet?: boolean;
}

const SIGNAL_MEMBERS: MemberSpec[] = [
    {
        label: 'get',
        detail: 'get(): T',
        documentation: 'Read the current signal value. Registers a reactive dependency when called inside `zenEffect`.',
        insertText: 'get()'
    },
    {
        label: 'set',
        detail: 'set(nextValue: T): T',
        documentation: 'Update the signal value and notify subscribers. Returns the stored value (the new value, or the previous value if unchanged via `Object.is`).',
        insertText: 'set(${0:next})',
        snippet: true
    },
    {
        label: 'subscribe',
        detail: 'subscribe(fn: (value: T) => void): () => void',
        documentation: 'Subscribe to value changes. Returns an unsubscribe function suitable for `ctx.cleanup(...)`.',
        insertText: 'subscribe(${0:fn})',
        snippet: true
    }
];

const RUNTIME_STATE_MEMBERS: MemberSpec[] = [
    {
        label: 'get',
        detail: 'get(): Readonly<T>',
        documentation: 'Read the current frozen state snapshot. Registers a reactive dependency when called inside `zenEffect`.',
        insertText: 'get()'
    },
    {
        label: 'set',
        detail: 'set(patch: Partial<T> | ((prev: Readonly<T>) => T)): Readonly<T>',
        documentation: 'Patch or replace the state object. Returns the new frozen snapshot. Throws if the result is not a plain object.',
        insertText: 'set(${0:patch})',
        snippet: true
    },
    {
        label: 'subscribe',
        detail: 'subscribe(fn: (next: Readonly<T>) => void): () => void',
        documentation: 'Subscribe to state changes. Returns an unsubscribe function.',
        insertText: 'subscribe(${0:fn})',
        snippet: true
    }
];

const REF_MEMBERS: MemberSpec[] = [
    {
        label: 'current',
        detail: 'current: T | null',
        documentation: 'DOM node or value held by the ref. Assigned by the runtime at mount; cleared to `null` on disposal. **Not** reactive — reading it does not register a dependency.',
        insertText: 'current'
    }
];

const MEMBERS_BY_KIND: Record<ReceiverKind, MemberSpec[]> = {
    signal: SIGNAL_MEMBERS,
    runtimeState: RUNTIME_STATE_MEMBERS,
    ref: REF_MEMBERS,
    declarativeState: [],
    unknown: []
};

/**
 * Return the canonical member specs for a receiver kind.
 *
 * `declarativeState` and `unknown` intentionally return an empty list so the
 * orchestrator can short-circuit without dumping unrelated top-level primitives.
 */
export function membersForReceiver(kind: ReceiverKind): MemberSpec[] {
    return MEMBERS_BY_KIND[kind];
}

/**
 * Build LSP completion items for a given receiver kind, filtered by typed prefix.
 */
export function memberCompletionItems(
    kind: ReceiverKind,
    memberPrefix: string
): CompletionItem[] {
    const prefix = memberPrefix.toLowerCase();
    const specs = membersForReceiver(kind).filter(
        (member) => !prefix || member.label.toLowerCase().startsWith(prefix)
    );

    return specs.map((member, index) => ({
        label: member.label,
        kind: CompletionItemKind.Method,
        detail: member.detail,
        documentation: { kind: MarkupKind.Markdown, value: member.documentation },
        insertText: member.insertText,
        insertTextFormat: member.snippet ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
        sortText: `0_${String(index).padStart(2, '0')}_${member.label}`
    }));
}
