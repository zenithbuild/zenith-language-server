/**
 * Lightweight static extractors used by completion and hover.
 *
 * No runtime evaluation, no AST: regex scans only. These intentionally err on
 * the side of "what is plausible at this cursor" so the LSP can still respond
 * while the document is mid-edit.
 */

import { parseForExpression } from './metadata/directive-metadata';
import { parseMemberAccess, type MemberAccessSite } from './member-access';

export interface PositionContext {
    inScript: boolean;
    inStyle: boolean;
    inTag: boolean;
    inExpression: boolean;
    inTemplate: boolean;
    inAttributeValue: boolean;
    tagName: string | null;
    currentWord: string;
    afterAt: boolean;
    afterColon: boolean;
    memberAccess: MemberAccessSite | null;
}

export interface DeclaredFunction {
    name: string;
    params: string;
    isAsync: boolean;
}

/**
 * Extract declarative `state name = initial` declarations from a script body.
 * Returns a map of `name -> initialExpression`.
 */
export function extractStates(script: string): Map<string, string> {
    const states = new Map<string, string>();
    const statePattern = /state\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;\n]+)/g;
    let match;

    while ((match = statePattern.exec(script)) !== null) {
        if (match[1] && match[2]) {
            states.set(match[1], match[2].trim());
        }
    }

    return states;
}

/**
 * Extract `function foo(...)` and `const foo = (...) =>` declarations.
 */
export function extractFunctions(script: string): DeclaredFunction[] {
    const functions: DeclaredFunction[] = [];
    const funcPattern = /(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g;
    let match;

    while ((match = funcPattern.exec(script)) !== null) {
        if (match[2]) {
            functions.push({
                name: match[2],
                params: match[3] || '',
                isAsync: !!match[1]
            });
        }
    }

    const arrowPattern = /(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(async\s+)?\([^)]*\)\s*=>/g;
    while ((match = arrowPattern.exec(script)) !== null) {
        if (match[1]) {
            functions.push({
                name: match[1],
                params: '',
                isAsync: !!match[2]
            });
        }
    }

    return functions;
}

/**
 * Extract loop variable names declared by `zen:for="item in list"`.
 */
export function extractLoopVariables(text: string): string[] {
    const vars: string[] = [];
    const loopPattern = /zen:for\s*=\s*["']([^"']+)["']/g;
    let match;

    while ((match = loopPattern.exec(text)) !== null) {
        const parsed = parseForExpression(match[1]);
        if (parsed) {
            vars.push(parsed.itemVar);
            if (parsed.indexVar) vars.push(parsed.indexVar);
        }
    }

    return vars;
}

/**
 * Pull the first `<script ...>` body out of the document text. Returns an
 * empty string when no script block exists.
 */
export function getScriptContent(text: string): string {
    const match = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    return match ? match[1] : '';
}

/**
 * Classify the cursor position so completion/hover can pick the right catalog.
 */
export function getPositionContext(text: string, offset: number): PositionContext {
    const before = text.substring(0, offset);

    const scriptOpens = (before.match(/<script[^>]*>/gi) || []).length;
    const scriptCloses = (before.match(/<\/script>/gi) || []).length;
    const inScript = scriptOpens > scriptCloses;

    const styleOpens = (before.match(/<style[^>]*>/gi) || []).length;
    const styleCloses = (before.match(/<\/style>/gi) || []).length;
    const inStyle = styleOpens > styleCloses;

    const lastTagOpen = before.lastIndexOf('<');
    const lastTagClose = before.lastIndexOf('>');
    const inTag = lastTagOpen > lastTagClose;

    const lastBraceOpen = before.lastIndexOf('{');
    const lastBraceClose = before.lastIndexOf('}');
    const inExpression = lastBraceOpen > lastBraceClose && !inScript && !inStyle;

    const inTemplate = !inScript && !inStyle;

    const afterLastTag = before.substring(lastTagOpen);
    const quoteMatch = afterLastTag.match(/=["'][^"']*$/);
    const inAttributeValue = inTag && !!quoteMatch;

    let tagName: string | null = null;
    if (inTag) {
        const tagMatch = before.substring(lastTagOpen).match(/<\/?([A-Za-z][A-Za-z0-9-]*)/);
        if (tagMatch) {
            tagName = tagMatch[1];
        }
    }

    const wordMatch = before.match(/[a-zA-Z_$:@][a-zA-Z0-9_$:-]*$/);
    let currentWord = wordMatch ? wordMatch[0] : '';

    // Tag UX: cursor immediately after `on:` yields a lone `:` token; normalize so `on:*`
    // event completions still surface (see `addTagContextCompletions`).
    if (inTag && !inAttributeValue && currentWord === ':' && /\bon:$/.test(before)) {
        currentWord = 'on:';
    }

    const afterAt = before.endsWith('@') || currentWord.startsWith('@');
    const afterColon = before.endsWith(':') || (currentWord.startsWith(':') && !currentWord.startsWith(':'));

    const memberAccess = (inScript || inExpression) ? parseMemberAccess(before) : null;

    return {
        inScript,
        inStyle,
        inTag,
        inExpression,
        inTemplate,
        inAttributeValue,
        tagName,
        currentWord,
        afterAt,
        afterColon,
        memberAccess
    };
}
