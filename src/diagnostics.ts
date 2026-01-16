/**
 * Diagnostics
 * 
 * Compile-time validation mirroring the Zenith compiler.
 * The LSP must surface compiler-level errors early.
 * 
 * Important: No runtime execution. Pure static analysis only.
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { isDirective, parseForExpression } from './metadata/directive-metadata';
import { parseZenithImports, resolveModule, isPluginModule } from './imports';
import type { ProjectGraph } from './project';

export interface ValidationContext {
    document: TextDocument;
    text: string;
    graph: ProjectGraph | null;
}

/**
 * Collect all diagnostics for a document
 */
export function collectDiagnostics(document: TextDocument, graph: ProjectGraph | null): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    
    // Validate component references
    collectComponentDiagnostics(document, text, graph, diagnostics);
    
    // Validate directive usage
    collectDirectiveDiagnostics(document, text, diagnostics);
    
    // Validate imports
    collectImportDiagnostics(document, text, diagnostics);
    
    // Validate expressions
    collectExpressionDiagnostics(document, text, diagnostics);
    
    return diagnostics;
}

/**
 * Validate component references
 */
function collectComponentDiagnostics(
    document: TextDocument,
    text: string,
    graph: ProjectGraph | null,
    diagnostics: Diagnostic[]
): void {
    if (!graph) return;
    
    // Match component tags (PascalCase)
    const componentPattern = /<([A-Z][a-zA-Z0-9]*)(?=[\s/>])/g;
    let match;
    
    while ((match = componentPattern.exec(text)) !== null) {
        const componentName = match[1];
        
        // Skip known router components
        if (componentName === 'ZenLink') continue;
        
        // Check if component exists in project graph
        const inLayouts = graph.layouts.has(componentName);
        const inComponents = graph.components.has(componentName);
        
        if (!inLayouts && !inComponents) {
            const startPos = document.positionAt(match.index + 1);
            const endPos = document.positionAt(match.index + 1 + componentName.length);
            
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
 * Validate directive usage
 */
function collectDirectiveDiagnostics(
    document: TextDocument,
    text: string,
    diagnostics: Diagnostic[]
): void {
    // Match zen:* directives
    const directivePattern = /(zen:(?:if|for|effect|show))\s*=\s*["']([^"']*)["']/g;
    let match;
    
    while ((match = directivePattern.exec(text)) !== null) {
        const directiveName = match[1];
        const directiveValue = match[2];
        
        // Validate zen:for syntax
        if (directiveName === 'zen:for') {
            const parsed = parseForExpression(directiveValue);
            if (!parsed) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: { start: startPos, end: endPos },
                    message: `Invalid zen:for syntax. Expected: "item in items" or "item, index in items"`,
                    source: 'zenith'
                });
            }
        }
        
        // Check for empty directive values
        if (!directiveValue.trim()) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: { start: startPos, end: endPos },
                message: `${directiveName} requires a value`,
                source: 'zenith'
            });
        }
    }
    
    // Check for zen:for on slot elements (forbidden)
    const slotForPattern = /<slot[^>]*zen:for/g;
    while ((match = slotForPattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: { start: startPos, end: endPos },
            message: `zen:for cannot be used on <slot> elements`,
            source: 'zenith'
        });
    }
}

/**
 * Validate imports
 */
function collectImportDiagnostics(
    document: TextDocument,
    text: string,
    diagnostics: Diagnostic[]
): void {
    // Extract script content
    const scriptMatch = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!scriptMatch) return;
    
    const scriptContent = scriptMatch[1];
    const scriptStart = scriptMatch.index! + scriptMatch[0].indexOf(scriptContent);
    
    const imports = parseZenithImports(scriptContent);
    
    for (const imp of imports) {
        const resolved = resolveModule(imp.module);
        
        // Warn about unknown plugin modules (soft diagnostic)
        if (isPluginModule(imp.module) && !resolved.isKnown) {
            // Find the import line in the document
            const importPattern = new RegExp(`import[^'"]*['"]${imp.module.replace(':', '\\:')}['"]`);
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
        
        // Check for invalid specifiers in known modules
        if (resolved.isKnown && resolved.metadata) {
            const validExports = resolved.metadata.exports.map(e => e.name);
            
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
 * Validate expressions for dangerous patterns
 */
function collectExpressionDiagnostics(
    document: TextDocument,
    text: string,
    diagnostics: Diagnostic[]
): void {
    // Match expressions in templates
    const expressionPattern = /\{([^}]+)\}/g;
    let match;
    
    while ((match = expressionPattern.exec(text)) !== null) {
        const expression = match[1];
        const offset = match.index;
        
        // Check for dangerous patterns
        if (expression.includes('eval(') || expression.includes('Function(')) {
            const startPos = document.positionAt(offset);
            const endPos = document.positionAt(offset + match[0].length);
            
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: { start: startPos, end: endPos },
                message: `Dangerous pattern detected: eval() and Function() are not allowed in expressions`,
                source: 'zenith'
            });
        }
        
        // Check for with statement
        if (/\bwith\s*\(/.test(expression)) {
            const startPos = document.positionAt(offset);
            const endPos = document.positionAt(offset + match[0].length);
            
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: { start: startPos, end: endPos },
                message: `'with' statement is not allowed in expressions`,
                source: 'zenith'
            });
        }
    }
}
