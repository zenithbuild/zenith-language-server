/**
 * Detect property-access completion sites: `receiver.` or `receiver.partial`.
 *
 * Used by `getPositionContext` so completion can resolve the receiver to a
 * known kind (signal / ref / runtimeState / declarativeState) and offer only
 * its members, instead of dumping all Zenith primitives on every `.`.
 *
 * Limitations (intentional — no AST):
 *   - String detection is line-local (single/double/template quotes). Block
 *     comments and multi-line strings are not tracked.
 *   - Comments are not stripped; `foo // count.` will still detect `count.`.
 *   - Member chains like `arr[0].prop` and `obj.a.b` resolve to the rightmost
 *     identifier only; transitive type inference is out of scope.
 *   - Decimal literals (`1.`) are rejected so `set(0.` does not trigger.
 */

/**
 * Receiver identifier + the (possibly empty) prefix typed after the dot.
 */
export interface MemberAccessSite {
    receiver: string;
    memberPrefix: string;
}

/**
 * Characters allowed immediately before a member-access receiver.
 *
 * Notably excludes `.` (chained access has its own semantics) and word
 * characters (would mean the receiver is part of a longer identifier or
 * decimal literal like `1.`).
 */
const RECEIVER_BOUNDARY = /[\s;({\[,=+\-*/%&|<>!?:`.]/;

const MEMBER_ACCESS_PATTERN = /([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)?$/;

/**
 * Parse text immediately before the cursor for a member-access site.
 *
 * Returns `null` when the cursor is not at `receiver.` or is inside a string
 * literal on the current line.
 */
export function parseMemberAccess(before: string): MemberAccessSite | null {
    if (before.length === 0) {
        return null;
    }

    const lineStart = before.lastIndexOf('\n') + 1;
    const currentLine = before.slice(lineStart);
    if (isInStringLiteralOnLine(currentLine)) {
        return null;
    }

    const trimmed = before.replace(/\s+$/, '');
    if (trimmed.length === 0) {
        return null;
    }

    const match = trimmed.match(MEMBER_ACCESS_PATTERN);
    if (!match) {
        return null;
    }

    const receiver = match[1];
    const memberPrefix = match[2] ?? '';
    const matchStart = trimmed.length - match[0].length;

    if (matchStart > 0) {
        const boundaryChar = trimmed[matchStart - 1];
        if (!RECEIVER_BOUNDARY.test(boundaryChar)) {
            return null;
        }
    }

    return { receiver, memberPrefix };
}

/**
 * Naive single-line quote scan. Returns `true` when the cursor (at end of
 * `lineBefore`) is inside a `'...'`, `"..."`, or backtick template literal.
 *
 * Does not span line breaks; documented as a limitation above.
 */
export function isInStringLiteralOnLine(lineBefore: string): boolean {
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escaped = false;

    for (let i = 0; i < lineBefore.length; i++) {
        const c = lineBefore[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (c === '\\') {
            escaped = true;
            continue;
        }
        if (!inDouble && !inTemplate && c === "'") {
            inSingle = !inSingle;
            continue;
        }
        if (!inSingle && !inTemplate && c === '"') {
            inDouble = !inDouble;
            continue;
        }
        if (!inSingle && !inDouble && c === '`') {
            inTemplate = !inTemplate;
        }
    }

    return inSingle || inDouble || inTemplate;
}
