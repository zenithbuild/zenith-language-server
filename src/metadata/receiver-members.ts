/**
 * Receiver-specific member completions.
 *
 * Source of truth: framework/packages/runtime/src/{signal,state,ref}.ts.
 */

import { CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node';
import type { CompletionItem } from 'vscode-languageserver/node';

import type { ReceiverKind } from '../extractors-bindings';
import {
    DOC_PATHS,
    markdownDoc,
    memberPreselect,
    memberSortText,
    zenithDetail
} from './completion-branding';

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
        detail: zenithDetail('Signal.get()', 'T'),
        documentation:
            'Read the current signal value. Registers a reactive dependency when called inside `zenEffect`.',
        insertText: 'get()'
    },
    {
        label: 'set',
        detail: zenithDetail('Signal.set(nextValue: T)', 'T'),
        documentation:
            'Update the signal value and notify subscribers. This is **Zenith Signal.set**, not `setTimeout` or generic object assignment.',
        insertText: 'set(${0:next})',
        snippet: true
    },
    {
        label: 'subscribe',
        detail: zenithDetail('Signal.subscribe(fn)', '() => void'),
        documentation:
            'Subscribe to value changes. Returns an unsubscribe function suitable for `ctx.cleanup(...)`.',
        insertText: 'subscribe(${0:fn})',
        snippet: true
    }
];

const RUNTIME_STATE_MEMBERS: MemberSpec[] = [
    {
        label: 'get',
        detail: zenithDetail('State.get()', 'Readonly<T>'),
        documentation:
            'Read the current frozen state snapshot. Registers a reactive dependency when called inside `zenEffect`.',
        insertText: 'get()'
    },
    {
        label: 'set',
        detail: zenithDetail('State.set(patch)', 'Readonly<T>'),
        documentation:
            'Patch or replace the runtime state object. Returns the new frozen snapshot.',
        insertText: 'set(${0:patch})',
        snippet: true
    },
    {
        label: 'subscribe',
        detail: zenithDetail('State.subscribe(fn)', '() => void'),
        documentation: 'Subscribe to state changes. Returns an unsubscribe function.',
        insertText: 'subscribe(${0:fn})',
        snippet: true
    }
];

const REF_MEMBERS: MemberSpec[] = [
    {
        label: 'current',
        detail: zenithDetail('Ref.current', 'T | null'),
        documentation:
            'DOM node or value held by the ref. Assigned by the runtime at mount; cleared to `null` on disposal. **Not** reactive.',
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

const DOC_BY_KIND: Partial<Record<ReceiverKind, string>> = {
    signal: DOC_PATHS.reactivity,
    runtimeState: DOC_PATHS.reactivity,
    ref: DOC_PATHS.domEnv
};

export function membersForReceiver(kind: ReceiverKind): MemberSpec[] {
    return MEMBERS_BY_KIND[kind];
}

export function memberCompletionItems(
    kind: ReceiverKind,
    memberPrefix: string
): CompletionItem[] {
    const prefix = memberPrefix.toLowerCase();
    const specs = membersForReceiver(kind).filter(
        (member) => !prefix || member.label.toLowerCase().startsWith(prefix)
    );
    const docPath = DOC_BY_KIND[kind];

    return specs.map((member, index) => ({
        label: member.label,
        kind: CompletionItemKind.Method,
        detail: member.detail,
        documentation: markdownDoc(member.documentation, docPath),
        insertText: member.insertText,
        insertTextFormat: member.snippet ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
        filterText: member.label,
        sortText: memberSortText(index, member.label),
        preselect: memberPreselect(member.label, memberPrefix)
    }));
}
