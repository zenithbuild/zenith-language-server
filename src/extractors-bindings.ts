/**
 * Lightweight binding extraction for Zenith script bodies (regex, no AST).
 *
 * Tracks `const|let name = signal(...)`, `const|let name = state(...)`, and
 * `const|let name = ref(...)` so completion can resolve `name.` to the right
 * receiver kind without a full TypeScript language service.
 *
 * Declarative `state name = initial` is tracked separately by `extractStates`
 * and resolved here as `declarativeState` so member completion returns nothing
 * (the compiler-lowered form does not expose signal-style `.get()` / `.set()`).
 */

import { extractStates } from './extractors';

export type BindingKind = 'signal' | 'runtimeState' | 'ref';

const BINDING_PATTERNS: Array<{ kind: BindingKind; pattern: RegExp }> = [
    {
        kind: 'signal',
        pattern: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=\s*signal\s*(?:<[^>]*>)?\s*\(/g
    },
    {
        kind: 'runtimeState',
        pattern: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=\s*state\s*(?:<[^>]*>)?\s*\(/g
    },
    {
        kind: 'ref',
        pattern: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=\s*ref\s*(?:<[^>]*>)?\s*\(/g
    }
];

/**
 * Map binding name -> kind for `const|let name = signal|state|ref(...)`.
 *
 * Later declarations in the same script win, matching JS hoisting semantics
 * for late-bound completion (cursor below the binding sees the latest kind).
 */
export function extractBindings(script: string): Map<string, BindingKind> {
    const bindings = new Map<string, BindingKind>();

    for (const { kind, pattern } of BINDING_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(script)) !== null) {
            bindings.set(match[1], kind);
        }
    }

    return bindings;
}

export type ReceiverKind = BindingKind | 'declarativeState' | 'unknown';

/**
 * Resolve what kind of value `name` refers to in completion.
 *
 * Lookup order matches scope precedence: explicit `const|let` bindings to a
 * known constructor win over declarative `state` (which itself wins over the
 * "unknown" fallback).
 */
export function resolveReceiverKind(
    name: string,
    bindings: Map<string, BindingKind>,
    states: ReturnType<typeof extractStates>
): ReceiverKind {
    const binding = bindings.get(name);
    if (binding) {
        return binding;
    }
    if (states.has(name)) {
        return 'declarativeState';
    }
    return 'unknown';
}
