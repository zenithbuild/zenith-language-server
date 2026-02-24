/**
 * Zenith Project Graph
 * 
 * Uses the compiler's discovery logic to build a project graph
 * Ensures LSP understands the same structure as the compiler
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ComponentInfo {
    name: string;
    filePath: string;
    type: 'layout' | 'component' | 'page';
    props: string[];
}

export interface ProjectGraph {
    root: string;
    layouts: Map<string, ComponentInfo>;
    components: Map<string, ComponentInfo>;
    pages: Map<string, ComponentInfo>;
}

const ZENITH_CONFIG_CANDIDATES = [
    'zenith.config.ts',
    'zenith.config.js',
    'zenith.config.mjs',
    'zenith.config.cjs',
    'zenith.config.json'
];

function hasZenithConfig(dir: string): boolean {
    return ZENITH_CONFIG_CANDIDATES.some((fileName) => fs.existsSync(path.join(dir, fileName)));
}

function hasZenithCliDependency(dir: string): boolean {
    const packageJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        return false;
    }

    try {
        const raw = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(raw) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
            optionalDependencies?: Record<string, string>;
        };

        const deps = [
            pkg.dependencies || {},
            pkg.devDependencies || {},
            pkg.peerDependencies || {},
            pkg.optionalDependencies || {}
        ];

        return deps.some((group) => Object.prototype.hasOwnProperty.call(group, '@zenithbuild/cli'));
    } catch {
        return false;
    }
}

function hasZenithStructure(dir: string): boolean {
    const srcDir = path.join(dir, 'src');
    if (fs.existsSync(srcDir)) {
        const hasPages = fs.existsSync(path.join(srcDir, 'pages'));
        const hasLayouts = fs.existsSync(path.join(srcDir, 'layouts'));
        if (hasPages || hasLayouts) {
            return true;
        }
    }

    const appDir = path.join(dir, 'app');
    if (fs.existsSync(appDir)) {
        const hasPages = fs.existsSync(path.join(appDir, 'pages'));
        const hasLayouts = fs.existsSync(path.join(appDir, 'layouts'));
        if (hasPages || hasLayouts) {
            return true;
        }
    }

    return false;
}

function findNearestByRule(startPath: string, predicate: (dir: string) => boolean): string | null {
    let current = path.resolve(startPath);
    if (!fs.existsSync(current)) {
        current = path.dirname(current);
    }

    while (!fs.existsSync(current) && current !== path.dirname(current)) {
        current = path.dirname(current);
    }

    if (!fs.existsSync(current)) {
        return null;
    }

    if (!fs.statSync(current).isDirectory()) {
        current = path.dirname(current);
    }

    while (current !== path.dirname(current)) {
        if (predicate(current)) {
            return current;
        }
        current = path.dirname(current);
    }

    if (predicate(current)) {
        return current;
    }

    return null;
}

function findFallbackRoot(startPath: string): string | null {
    return findNearestByRule(startPath, (dir) => {
        if (fs.existsSync(path.join(dir, 'package.json'))) {
            return true;
        }
        if (hasZenithStructure(dir)) {
            return true;
        }
        return false;
    });
}

/**
 * Detect Zenith project root
 * Priority:
 * 1) nearest zenith.config.*
 * 2) nearest package.json with @zenithbuild/cli
 * 3) nearest Zenith structure (src/pages|layouts or app/pages|layouts)
 * 4) workspace folder fallbacks (if provided)
 * 5) nearest package.json or Zenith structure
 */
export function detectProjectRoot(startPath: string, workspaceFolders: string[] = []): string | null {
    const localConfigRoot = findNearestByRule(startPath, hasZenithConfig);
    if (localConfigRoot) {
        return localConfigRoot;
    }

    const localCliRoot = findNearestByRule(startPath, hasZenithCliDependency);
    if (localCliRoot) {
        return localCliRoot;
    }

    const localStructureRoot = findNearestByRule(startPath, hasZenithStructure);
    if (localStructureRoot) {
        return localStructureRoot;
    }

    const absoluteStart = path.resolve(startPath);
    const matchingWorkspaceFolders = workspaceFolders
        .map((workspacePath) => path.resolve(workspacePath))
        .filter((workspacePath) => absoluteStart === workspacePath || absoluteStart.startsWith(`${workspacePath}${path.sep}`))
        .sort((a, b) => b.length - a.length);

    for (const workspaceRoot of matchingWorkspaceFolders) {
        if (hasZenithConfig(workspaceRoot)) {
            return workspaceRoot;
        }
        if (hasZenithCliDependency(workspaceRoot)) {
            return workspaceRoot;
        }
        if (hasZenithStructure(workspaceRoot)) {
            return workspaceRoot;
        }
    }

    return findFallbackRoot(startPath);
}

/**
 * Extract props from a .zen file
 * Infers props from usage patterns (Astro/Vue style)
 */
function extractPropsFromFile(filePath: string): string[] {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const props: string[] = [];

        // Look for Props interface/type
        const propsMatch = content.match(/(?:interface|type)\s+Props\s*[={]\s*\{([^}]+)\}/);
        if (propsMatch && propsMatch[1]) {
            const propNames = propsMatch[1].match(/([a-zA-Z_$][a-zA-Z0-9_$?]*)\s*[?:]?\s*:/g);
            if (propNames) {
                for (const p of propNames) {
                    const name = p.replace(/[?:\s]/g, '');
                    if (name && !props.includes(name)) {
                        props.push(name);
                    }
                }
            }
        }

        // Look for common prop patterns in expressions
        const usagePatterns = content.matchAll(/\{(title|lang|className|children|href|src|alt|id|name)\}/g);
        for (const match of usagePatterns) {
            if (match[1] && !props.includes(match[1])) {
                props.push(match[1]);
            }
        }

        return props;
    } catch {
        return [];
    }
}

/**
 * Discover all .zen files in a directory
 */
function discoverZenFiles(dir: string, type: 'layout' | 'component' | 'page'): Map<string, ComponentInfo> {
    const result = new Map<string, ComponentInfo>();

    if (!fs.existsSync(dir)) {
        return result;
    }

    function scanDir(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (entry.name.endsWith('.zen')) {
                const name = path.basename(entry.name, '.zen');
                const props = extractPropsFromFile(fullPath);

                result.set(name, {
                    name,
                    filePath: fullPath,
                    type,
                    props
                });
            }
        }
    }

    scanDir(dir);
    return result;
}

/**
 * Build project graph from root directory
 */
export function buildProjectGraph(root: string): ProjectGraph {
    const srcDir = fs.existsSync(path.join(root, 'src')) ? path.join(root, 'src') : path.join(root, 'app');

    const layouts = discoverZenFiles(path.join(srcDir, 'layouts'), 'layout');
    const components = discoverZenFiles(path.join(srcDir, 'components'), 'component');
    const pages = discoverZenFiles(path.join(srcDir, 'pages'), 'page');

    return {
        root,
        layouts,
        components,
        pages
    };
}

/**
 * Resolve a component/layout by name
 */
export function resolveComponent(graph: ProjectGraph, name: string): ComponentInfo | undefined {
    // Check layouts first (common pattern for <DefaultLayout>)
    if (graph.layouts.has(name)) {
        return graph.layouts.get(name);
    }

    // Then components
    if (graph.components.has(name)) {
        return graph.components.get(name);
    }

    return undefined;
}
