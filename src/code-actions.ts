import {
    ZenithDiagnostic,
    ZenithRange
} from './diagnostics';

export const EVENT_BINDING_DIAGNOSTIC_CODE = 'zenith.event.binding.syntax';

export interface EventBindingCodeActionData {
    replacement: string;
    title: string;
}

export interface ZenithCodeAction {
    title: string;
    kind: string;
    diagnostics: ZenithDiagnostic[];
    edit: {
        changes: Record<string, Array<{ range: ZenithRange; newText: string }>>;
    };
    isPreferred?: boolean;
}

interface ZenithTextDocumentLike {
    uri: string;
}

export function buildEventBindingCodeActions(
    document: ZenithTextDocumentLike,
    diagnostics: ZenithDiagnostic[]
): ZenithCodeAction[] {
    const actions: ZenithCodeAction[] = [];

    for (const diagnostic of diagnostics) {
        if (diagnostic.code !== EVENT_BINDING_DIAGNOSTIC_CODE) {
            continue;
        }

        const data = diagnostic.data as EventBindingCodeActionData | undefined;
        if (!data || typeof data.replacement !== 'string' || typeof data.title !== 'string') {
            continue;
        }

        actions.push({
            title: data.title,
            kind: 'quickfix',
            diagnostics: [diagnostic],
            edit: {
                changes: {
                    [document.uri]: [{
                        range: diagnostic.range,
                        newText: data.replacement
                    }]
                }
            },
            isPreferred: true
        });
    }

    return actions;
}
