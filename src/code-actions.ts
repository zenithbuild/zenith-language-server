import {
    ZenithDiagnostic,
    ZenithRange
} from './diagnostics';

export const EVENT_BINDING_DIAGNOSTIC_CODE = 'zenith.event.binding.syntax';

export const ZEN_DOM_QUERY = 'ZEN-DOM-QUERY';
export const ZEN_DOM_LISTENER = 'ZEN-DOM-LISTENER';
export const ZEN_DOM_WRAPPER = 'ZEN-DOM-WRAPPER';

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
    getText(): string;
    positionAt(offset: number): { line: number; character: number };
    offsetAt(position: { line: number; character: number }): number;
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

export function buildDomLintCodeActions(
    document: ZenithTextDocumentLike,
    diagnostics: ZenithDiagnostic[]
): ZenithCodeAction[] {
    const actions: ZenithCodeAction[] = [];
    const text = document.getText();

    for (const diagnostic of diagnostics) {
        const code = diagnostic.code;
        if (code !== ZEN_DOM_QUERY && code !== ZEN_DOM_LISTENER && code !== ZEN_DOM_WRAPPER) {
            continue;
        }

        const startOffset = document.offsetAt(diagnostic.range.start);
        const endOffset = document.offsetAt(diagnostic.range.end);
        const lineStart = text.lastIndexOf('\n', startOffset) + 1;
        const lineEnd = text.indexOf('\n', endOffset);
        const lineEndOffset = lineEnd === -1 ? text.length : lineEnd;
        const lineContent = text.substring(lineStart, lineEndOffset);

        if (code === ZEN_DOM_QUERY) {
            const insertPos = { line: diagnostic.range.start.line, character: 0 };
            actions.push({
                title: 'Suppress with // zen-allow:dom-query <reason>',
                kind: 'quickfix',
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [document.uri]: [{
                            range: { start: insertPos, end: insertPos },
                            newText: '// zen-allow:dom-query <reason>\n'
                        }]
                    }
                }
            });
            actions.push({
                title: 'Convert to ref() (partial / TODO)',
                kind: 'quickfix',
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [document.uri]: [{
                            range: { start: insertPos, end: insertPos },
                            newText: '// TODO: use ref<T>() + zenMount instead\nconst elRef = ref<HTMLElement>();\n'
                        }]
                    }
                }
            });
        } else if (code === ZEN_DOM_LISTENER) {
            const insertPos = { line: diagnostic.range.start.line, character: 0 };
            const lineRange = {
                start: document.positionAt(lineStart),
                end: document.positionAt(lineEndOffset)
            };
            const commentedLine = lineContent.replace(/^(\s*)/, '$1// ');
            actions.push({
                title: 'Replace with zenOn template',
                kind: 'quickfix',
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [document.uri]: [
                            {
                                range: { start: insertPos, end: insertPos },
                                newText: '// zenOn(target, eventName, handler) - register disposer via ctx.cleanup\n// const off = zenOn(doc, \'keydown\', handler); ctx.cleanup(off);\n'
                            },
                            {
                                range: lineRange,
                                newText: commentedLine
                            }
                        ]
                    }
                }
            });
        } else if (code === ZEN_DOM_WRAPPER) {
            let newText = lineContent;
            if (lineContent.includes('window') && !lineContent.includes('zenWindow')) {
                newText = newText.replace(/\bwindow\b/g, 'zenWindow()');
            }
            if (lineContent.includes('document') && !lineContent.includes('zenDocument')) {
                newText = newText.replace(/\bdocument\b/g, 'zenDocument()');
            }
            if (lineContent.includes('globalThis.window')) {
                newText = newText.replace(/globalThis\.window/g, 'zenWindow()');
            }
            if (lineContent.includes('globalThis.document')) {
                newText = newText.replace(/globalThis\.document/g, 'zenDocument()');
            }
            if (newText !== lineContent) {
                actions.push({
                    title: 'Replace with zenWindow() / zenDocument()',
                    kind: 'quickfix',
                    diagnostics: [diagnostic],
                    edit: {
                        changes: {
                            [document.uri]: [{
                                range: {
                                    start: document.positionAt(lineStart),
                                    end: document.positionAt(lineEndOffset)
                                },
                                newText
                            }]
                        }
                    }
                });
            }
        }
    }

    return actions;
}

/**
 * Convenience code actions: Replace window/document with zenWindow()/zenDocument()
 * even when there is no ZEN-DOM-WRAPPER diagnostic.
 */
export function buildWindowDocumentCodeActions(
    document: ZenithTextDocumentLike,
    range: ZenithRange
): ZenithCodeAction[] {
    const text = document.getText();
    const startOffset = document.offsetAt(range.start);
    const endOffset = document.offsetAt(range.end);
    const selected = text.substring(startOffset, endOffset);

    if (selected === 'window') {
        return [{
            title: 'Replace with zenWindow()',
            kind: 'refactor',
            diagnostics: [],
            edit: {
                changes: {
                    [document.uri]: [{ range, newText: 'zenWindow()' }]
                }
            }
        }];
    }
    if (selected === 'document') {
        return [{
            title: 'Replace with zenDocument()',
            kind: 'refactor',
            diagnostics: [],
            edit: {
                changes: {
                    [document.uri]: [{ range, newText: 'zenDocument()' }]
                }
            }
        }];
    }
    return [];
}
