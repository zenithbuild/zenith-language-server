/**
 * Diagnostics
 *
 * Compile-time validation mirroring Zenith contracts.
 * No runtime execution. Pure static analysis only.
 */

import * as path from 'path';

import { parseForExpression } from './metadata/directive-metadata';
import { parseZenithImports, resolveModule, isPluginModule } from './imports';
import type { ProjectGraph } from './project';
import {
    classifyZenithFile,
    isCssContractImportSpecifier,
    isLocalCssSpecifier,
    resolveCssImportPath
} from './contracts';
import type { ZenithServerSettings } from './settings';
import { EVENT_BINDING_DIAGNOSTIC_CODE } from './code-actions';

const COMPONENT_SCRIPT_CONTRACT_MESSAGE =
    'Zenith Contract Violation: Components are structural; move <script> to the parent route scope.';

const CSS_BARE_IMPORT_MESSAGE =
    'CSS import contract violation: bare CSS imports are not supported.';

const CSS_ESCAPE_MESSAGE =
    'CSS import contract violation: imported CSS path escapes project root.';

const DiagnosticSeverity = {
    Error: 1,
    Warning: 2,
    Information: 3,
    Hint: 4
} as const;

export interface ZenithPosition {
    line: number;
    character: number;
}

export interface ZenithRange {
    start: ZenithPosition;
    end: ZenithPosition;
}

export interface ZenithDiagnostic {
    severity: number;
    range: ZenithRange;
    message: string;
    source: string;
    code?: string;
    data?: unknown;
}

export interface ZenithTextDocumentLike {
    uri: string;
    getText(): string;
    positionAt(offset: number): ZenithPosition;
}

function uriToFilePath(uri: string): string {
    try {
        return decodeURIComponent(new URL(uri).pathname);
    } catch {
        return decodeURIComponent(uri.replace('file://', ''));
    }
}

function stripScriptAndStylePreserveIndices(text: string): string {
    return text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => ' '.repeat(match.length));
}

interface ScriptBlock {
    content: string;
    contentStartOffset: number;
}

function getScriptBlocks(text: string): ScriptBlock[] {
    const blocks: ScriptBlock[] = [];
    const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptPattern.exec(text)) !== null) {
        const whole = match[0] || '';
        const content = match[1] || '';
        const localStart = whole.indexOf(content);
        const contentStartOffset = (match.index || 0) + Math.max(localStart, 0);
        blocks.push({ content, contentStartOffset });
    }

    return blocks;
}

interface ParsedImportSpecifier {
    specifier: string;
    startOffset: number;
    endOffset: number;
}

function parseImportSpecifiers(scriptContent: string, scriptStartOffset: number): ParsedImportSpecifier[] {
    const imports: ParsedImportSpecifier[] = [];
    const importPattern = /import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"\n]+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = importPattern.exec(scriptContent)) !== null) {
        const statement = match[0] || '';
        const specifier = match[1] || '';
        const rel = statement.indexOf(specifier);
        const startOffset = scriptStartOffset + (match.index || 0) + Math.max(rel, 0);
        const endOffset = startOffset + specifier.length;
        imports.push({ specifier, startOffset, endOffset });
    }

    return imports;
}

function normalizeEventHandlerValue(rawValue: string): string {
    let value = rawValue.trim();

    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1).trim();
    }

    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\(\)$/.test(value)) {
        value = value.slice(0, -2);
    }

    if (!value) {
        return 'handler';
    }

    return value;
}

/**
 * Collect all diagnostics for a document.
 */
export async function collectDiagnostics(
    document: ZenithTextDocumentLike,
    graph: ProjectGraph | null,
    settings: ZenithServerSettings,
    projectRoot: string | null
): Promise<ZenithDiagnostic[]> {
    const diagnostics: ZenithDiagnostic[] = [];
    const text = document.getText();
    const filePath = uriToFilePath(document.uri);

    let hasComponentScriptCompilerDiagnostic = false;

    // 1) Compiler validation (source-of-truth), with configurable suppression for component script contract.
    try {
        process.env.ZENITH_CACHE = '1';
        const { compile } = await import('@zenithbuild/compiler');
        const result = await compile(text, filePath);

        // 2) Surface ZEN-DOM-* warnings from compiler JSON as LSP diagnostics.
        interface CompilerWarning {
            code?: string;
            message?: string;
            range?: { start?: { line?: number; column?: number }; end?: { line?: number; column?: number } };
        }
        const warnings: CompilerWarning[] = (result as { warnings?: CompilerWarning[] }).warnings ?? [];
        const domLintSeverity = settings.strictDomLints ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning;
        for (const w of warnings) {
            const range = w.range;
            const startLine = (range?.start?.line ?? 1) - 1;
            const startChar = (range?.start?.column ?? 1) - 1;
            const endLine = (range?.end?.line ?? range?.start?.line ?? 1) - 1;
            const endChar = (range?.end?.column ?? range?.start?.column ?? 1);
            diagnostics.push({
                severity: domLintSeverity,
                range: {
                    start: { line: startLine, character: startChar },
                    end: { line: endLine, character: endChar }
                },
                message: w.message ?? 'DOM lint',
                source: 'zenith-compiler',
                code: w.code
            });
        }
    } catch (error: any) {
        const message = String(error?.message || 'Unknown compiler error');
        const isContractViolation = message.includes(COMPONENT_SCRIPT_CONTRACT_MESSAGE);

        if (isContractViolation) {
            hasComponentScriptCompilerDiagnostic = true;
        }

        if (!(settings.componentScripts === 'allow' && isContractViolation)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: (error?.line || 1) - 1, character: (error?.column || 1) - 1 },
                    end: { line: (error?.line || 1) - 1, character: (error?.column || 1) + 20 }
                },
                message: `[${error?.code || 'compiler'}] ${message}${error?.hints ? '\n\nHints:\n' + error.hints.join('\n') : ''}`,
                source: 'zenith-compiler'
            });
        }
    }

    diagnostics.push(
        ...collectContractDiagnostics(
            document,
            graph,
            settings,
            projectRoot,
            hasComponentScriptCompilerDiagnostic
        )
    );

    return diagnostics;
}

export function collectContractDiagnostics(
    document: ZenithTextDocumentLike,
    graph: ProjectGraph | null,
    settings: ZenithServerSettings,
    projectRoot: string | null,
    hasComponentScriptCompilerDiagnostic = false
): ZenithDiagnostic[] {
    const diagnostics: ZenithDiagnostic[] = [];
    const text = document.getText();
    const filePath = uriToFilePath(document.uri);

    collectComponentScriptDiagnostics(document, text, filePath, settings, diagnostics, hasComponentScriptCompilerDiagnostic);
    collectEventBindingDiagnostics(document, text, diagnostics);
    collectDirectiveDiagnostics(document, text, diagnostics);
    collectImportDiagnostics(document, text, diagnostics);
    collectCssImportContractDiagnostics(document, text, filePath, projectRoot, diagnostics);
    collectExpressionDiagnostics(document, text, diagnostics);
    collectComponentDiagnostics(document, text, graph, diagnostics);

    return diagnostics;
}

function collectComponentScriptDiagnostics(
    document: ZenithTextDocumentLike,
    text: string,
    filePath: string,
    settings: ZenithServerSettings,
    diagnostics: ZenithDiagnostic[],
    hasComponentScriptCompilerDiagnostic: boolean
): void {
    if (settings.componentScripts !== 'forbid') {
        return;
    }

    if (classifyZenithFile(filePath) !== 'component') {
        return;
    }

    if (hasComponentScriptCompilerDiagnostic) {
        return;
    }

    const scriptTagMatch = /<script\b[^>]*>/i.exec(text);
    if (!scriptTagMatch || scriptTagMatch.index == null) {
        return;
    }

    diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
            start: document.positionAt(scriptTagMatch.index),
            end: document.positionAt(scriptTagMatch.index + scriptTagMatch[0].length)
        },
        message: COMPONENT_SCRIPT_CONTRACT_MESSAGE,
        source: 'zenith-contract'
    });
}

function collectEventBindingDiagnostics(
    document: ZenithTextDocumentLike,
    text: string,
    diagnostics: ZenithDiagnostic[]
): void {
    const stripped = stripScriptAndStylePreserveIndices(text);

    // Invalid @click={handler}
    const atEventPattern = /@([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/g;
    let match: RegExpExecArray | null;

    while ((match = atEventPattern.exec(stripped)) !== null) {
        const fullMatch = match[0] || '';
        const eventName = match[1] || 'click';
        const rawHandler = match[2] || '{handler}';
        const handler = normalizeEventHandlerValue(rawHandler);
        const replacement = `on:${eventName}={${handler}}`;

        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
                start: document.positionAt(match.index || 0),
                end: document.positionAt((match.index || 0) + fullMatch.length)
            },
            message: `Invalid event binding syntax. Use on:${eventName}={handler}.`,
            source: 'zenith-contract',
            code: EVENT_BINDING_DIAGNOSTIC_CODE,
            data: {
                replacement,
                title: `Convert to ${replacement}`
            }
        });
    }

    // Invalid onclick="handler" / onclick={handler}
    const onEventPattern = /\bon([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/g;
    while ((match = onEventPattern.exec(stripped)) !== null) {
        const fullMatch = match[0] || '';
        const eventName = match[1] || 'click';
        const rawHandler = match[2] || '{handler}';
        const handler = normalizeEventHandlerValue(rawHandler);
        const replacement = `on:${eventName}={${handler}}`;

        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
                start: document.positionAt(match.index || 0),
                end: document.positionAt((match.index || 0) + fullMatch.length)
            },
            message: `Invalid event binding syntax. Use on:${eventName}={handler}.`,
            source: 'zenith-contract',
            code: EVENT_BINDING_DIAGNOSTIC_CODE,
            data: {
                replacement,
                title: `Convert to ${replacement}`
            }
        });
    }
}

function collectCssImportContractDiagnostics(
    document: ZenithTextDocumentLike,
    text: string,
    filePath: string,
    projectRoot: string | null,
    diagnostics: ZenithDiagnostic[]
): void {
    const scriptBlocks = getScriptBlocks(text);
    if (scriptBlocks.length === 0) {
        return;
    }

    const effectiveProjectRoot = projectRoot ? path.resolve(projectRoot) : path.dirname(filePath);

    for (const block of scriptBlocks) {
        const imports = parseImportSpecifiers(block.content, block.contentStartOffset);
        for (const imp of imports) {
            if (!isCssContractImportSpecifier(imp.specifier)) {
                continue;
            }

            if (!isLocalCssSpecifier(imp.specifier)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: document.positionAt(imp.startOffset),
                        end: document.positionAt(imp.endOffset)
                    },
                    message: CSS_BARE_IMPORT_MESSAGE,
                    source: 'zenith-contract'
                });
                continue;
            }

            const resolved = resolveCssImportPath(filePath, imp.specifier, effectiveProjectRoot);
            if (resolved.escapesProjectRoot) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: document.positionAt(imp.startOffset),
                        end: document.positionAt(imp.endOffset)
                    },
                    message: CSS_ESCAPE_MESSAGE,
                    source: 'zenith-contract'
                });
            }
        }
    }
}

/**
 * Validate component references.
 */
function collectComponentDiagnostics(
    document: ZenithTextDocumentLike,
    text: string,
    graph: ProjectGraph | null,
    diagnostics: ZenithDiagnostic[]
): void {
    if (!graph) return;

    const strippedText = text
        .replace(/<(script|style)[^>]*>([\s\S]*?)<\/\1>/gi, (match, _tag, content) => {
            return match.replace(content, ' '.repeat(content.length));
        });

    const componentPattern = /<([A-Z][a-zA-Z0-9]*)(?=[\s/>])/g;
    let match: RegExpExecArray | null;

    while ((match = componentPattern.exec(strippedText)) !== null) {
        const componentName = match[1];
        if (componentName === 'ZenLink') continue;

        const inLayouts = graph.layouts.has(componentName);
        const inComponents = graph.components.has(componentName);

        if (!inLayouts && !inComponents) {
            const startPos = document.positionAt((match.index || 0) + 1);
            const endPos = document.positionAt((match.index || 0) + 1 + componentName.length);

            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: { start: startPos, end: endPos },
                message: `Unknown component: '<${componentName}>'. Ensure it exists in src/layouts/ or src/components/`,
                source: 'zenith'
            });
        }
    }
}

/**
 * Validate directive usage.
 */
function collectDirectiveDiagnostics(
    document: ZenithTextDocumentLike,
    text: string,
    diagnostics: ZenithDiagnostic[]
): void {
    const directivePattern = /(zen:(?:if|for|effect|show))\s*=\s*["']([^"']*)["']/g;
    let match: RegExpExecArray | null;

    while ((match = directivePattern.exec(text)) !== null) {
        const directiveName = match[1];
        const directiveValue = match[2];

        if (directiveName === 'zen:for') {
            const parsed = parseForExpression(directiveValue);
            if (!parsed) {
                const startPos = document.positionAt(match.index || 0);
                const endPos = document.positionAt((match.index || 0) + (match[0] || '').length);

                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: { start: startPos, end: endPos },
                    message: 'Invalid zen:for syntax. Expected: "item in items" or "item, index in items"',
                    source: 'zenith'
                });
            }
        }

        if (!directiveValue.trim()) {
            const startPos = document.positionAt(match.index || 0);
            const endPos = document.positionAt((match.index || 0) + (match[0] || '').length);

            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: { start: startPos, end: endPos },
                message: `${directiveName} requires a value`,
                source: 'zenith'
            });
        }
    }

    const slotForPattern = /<slot[^>]*zen:for/g;
    while ((match = slotForPattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index || 0);
        const endPos = document.positionAt((match.index || 0) + (match[0] || '').length);

        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: { start: startPos, end: endPos },
            message: 'zen:for cannot be used on <slot> elements',
            source: 'zenith'
        });
    }
}

/**
 * Validate imports.
 */
function collectImportDiagnostics(
    document: ZenithTextDocumentLike,
    text: string,
    diagnostics: ZenithDiagnostic[]
): void {
    const scriptMatch = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!scriptMatch) return;

    const scriptContent = scriptMatch[1];
    const scriptStart = (scriptMatch.index || 0) + scriptMatch[0].indexOf(scriptContent);
    const imports = parseZenithImports(scriptContent);

    for (const imp of imports) {
        const resolved = resolveModule(imp.module);

        if (isPluginModule(imp.module) && !resolved.isKnown) {
            const importPattern = new RegExp(`import[^'\"]*['\"]${imp.module.replace(':', '\\:')}['\"]`);
            const importMatch = scriptContent.match(importPattern);

            if (importMatch) {
                const importOffset = scriptStart + (importMatch.index || 0);
                const startPos = document.positionAt(importOffset);
                const endPos = document.positionAt(importOffset + importMatch[0].length);

                diagnostics.push({
                    severity: DiagnosticSeverity.Information,
                    range: { start: startPos, end: endPos },
                    message: `Unknown plugin module: '${imp.module}'. Make sure the plugin is installed.`,
                    source: 'zenith'
                });
            }
        }

        if (resolved.isKnown && resolved.metadata) {
            const validExports = resolved.metadata.exports.map((e) => e.name);

            for (const specifier of imp.specifiers) {
                if (!validExports.includes(specifier)) {
                    const specPattern = new RegExp(`\\b${specifier}\\b`);
                    const specMatch = scriptContent.match(specPattern);

                    if (specMatch) {
                        const specOffset = scriptStart + (specMatch.index || 0);
                        const startPos = document.positionAt(specOffset);
                        const endPos = document.positionAt(specOffset + specifier.length);

                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: { start: startPos, end: endPos },
                            message: `'${specifier}' is not exported from '${imp.module}'`,
                            source: 'zenith'
                        });
                    }
                }
            }
        }
    }
}

/**
 * Validate expressions for dangerous patterns.
 */
function collectExpressionDiagnostics(
    document: ZenithTextDocumentLike,
    text: string,
    diagnostics: ZenithDiagnostic[]
): void {
    const expressionPattern = /\{([^}]+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = expressionPattern.exec(text)) !== null) {
        const expression = match[1];
        const offset = match.index || 0;

        if (expression.includes('eval(') || expression.includes('Function(')) {
            const startPos = document.positionAt(offset);
            const endPos = document.positionAt(offset + (match[0] || '').length);

            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: { start: startPos, end: endPos },
                message: 'Dangerous pattern detected: eval() and Function() are not allowed in expressions',
                source: 'zenith'
            });
        }

        if (/\bwith\s*\(/.test(expression)) {
            const startPos = document.positionAt(offset);
            const endPos = document.positionAt(offset + (match[0] || '').length);

            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: { start: startPos, end: endPos },
                message: "'with' statement is not allowed in expressions",
                source: 'zenith'
            });
        }

        if (expression.includes(' as ') || (expression.includes('<') && expression.includes('>'))) {
            const startPos = document.positionAt(offset);
            const endPos = document.positionAt(offset + (match[0] || '').length);

            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: { start: startPos, end: endPos },
                message: 'TypeScript syntax (type casting or generics) detected in runtime expression. Runtime code must be pure JavaScript.',
                source: 'zenith'
            });
        }
    }
}

export const CONTRACT_MESSAGES = {
    componentScript: COMPONENT_SCRIPT_CONTRACT_MESSAGE,
    cssBareImport: CSS_BARE_IMPORT_MESSAGE,
    cssEscape: CSS_ESCAPE_MESSAGE
} as const;
