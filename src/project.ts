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

/**
 * Detect Zenith project root
 * Looks for zenith.config.ts, src/, or app/
 */
export function detectProjectRoot(startPath: string): string | null {
    let current = startPath;

    while (current !== path.dirname(current)) {
        // Check for zenith.config.ts
        if (fs.existsSync(path.join(current, 'zenith.config.ts'))) {
            return current;
        }
        // Check for src/ directory with Zenith files
        const srcDir = path.join(current, 'src');
        if (fs.existsSync(srcDir)) {
            const hasPages = fs.existsSync(path.join(srcDir, 'pages'));
            const hasLayouts = fs.existsSync(path.join(srcDir, 'layouts'));
            if (hasPages || hasLayouts) {
                return current;
            }
        }
        // Check for app/ directory
        const appDir = path.join(current, 'app');
        if (fs.existsSync(appDir)) {
            const hasPages = fs.existsSync(path.join(appDir, 'pages'));
            const hasLayouts = fs.existsSync(path.join(appDir, 'layouts'));
            if (hasPages || hasLayouts) {
                return current;
            }
        }
        current = path.dirname(current);
    }

    return null;
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
