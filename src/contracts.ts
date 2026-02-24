import * as fs from 'fs';
import * as path from 'path';

export type ZenithFileKind = 'page' | 'layout' | 'component' | 'unknown';

export function stripImportSuffix(specifier: string): string {
    const hashIndex = specifier.indexOf('#');
    const queryIndex = specifier.indexOf('?');

    let cutAt = -1;
    if (hashIndex >= 0 && queryIndex >= 0) {
        cutAt = Math.min(hashIndex, queryIndex);
    } else if (hashIndex >= 0) {
        cutAt = hashIndex;
    } else if (queryIndex >= 0) {
        cutAt = queryIndex;
    }

    return cutAt >= 0 ? specifier.slice(0, cutAt) : specifier;
}

export function isLocalCssSpecifier(specifier: string): boolean {
    return (
        specifier.startsWith('./') ||
        specifier.startsWith('../') ||
        specifier.startsWith('/')
    );
}

export function isCssContractImportSpecifier(specifier: string): boolean {
    const normalized = stripImportSuffix(specifier).trim();
    if (!normalized) {
        return false;
    }

    if (normalized.endsWith('.css')) {
        return true;
    }

    if (normalized === 'tailwindcss') {
        return true;
    }

    if (/^@[^/]+\/css(?:$|\/)/.test(normalized)) {
        return true;
    }

    return false;
}

function canonicalizePath(candidate: string): string {
    try {
        return fs.realpathSync.native(candidate);
    } catch {
        return path.resolve(candidate);
    }
}

export function resolveCssImportPath(
    importingFilePath: string,
    specifier: string,
    projectRoot: string
): { resolvedPath: string; escapesProjectRoot: boolean } {
    const normalizedSpecifier = stripImportSuffix(specifier);
    const importingDir = path.dirname(importingFilePath);
    const rootCanonical = canonicalizePath(projectRoot);

    const unresolvedTarget = normalizedSpecifier.startsWith('/')
        ? path.join(rootCanonical, normalizedSpecifier.slice(1))
        : path.resolve(importingDir, normalizedSpecifier);

    const targetCanonical = canonicalizePath(unresolvedTarget);
    const relativeToRoot = path.relative(rootCanonical, targetCanonical);
    const escapesProjectRoot =
        relativeToRoot.startsWith('..') ||
        path.isAbsolute(relativeToRoot);

    return {
        resolvedPath: targetCanonical,
        escapesProjectRoot
    };
}

export function classifyZenithFile(filePath: string): ZenithFileKind {
    const normalized = filePath.replace(/\\/g, '/');

    if (!normalized.endsWith('.zen')) {
        return 'unknown';
    }

    if (normalized.includes('/src/pages/') || normalized.includes('/app/pages/')) {
        return 'page';
    }

    if (normalized.includes('/src/layouts/') || normalized.includes('/app/layouts/')) {
        return 'layout';
    }

    return 'component';
}
