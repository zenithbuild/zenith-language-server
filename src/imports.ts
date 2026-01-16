/**
 * Import Resolution & Awareness
 * 
 * Handles recognition and resolution of Zenith imports.
 * - zenith/* imports are core modules (virtual, symbolic resolution)
 * - zenith:* imports are plugin modules (soft diagnostics if missing)
 */

import { 
    CORE_MODULES, 
    getCoreModule, 
    getCoreExport, 
    isCoreModule,
    type CoreModuleMetadata,
    type ModuleExport 
} from './metadata/core-imports';

import { 
    PLUGIN_MODULES, 
    getPluginModule, 
    getPluginExport, 
    isPluginModule, 
    isKnownPluginModule,
    type PluginModuleMetadata,
    type PluginExport 
} from './metadata/plugin-imports';

export interface ParsedImport {
    module: string;
    specifiers: string[];
    isType: boolean;
    line: number;
}

export interface ResolvedImport {
    module: string;
    kind: 'core' | 'plugin' | 'external';
    metadata?: CoreModuleMetadata | PluginModuleMetadata;
    isKnown: boolean;
}

/**
 * Parse Zenith imports from script content
 */
export function parseZenithImports(script: string): ParsedImport[] {
    const imports: ParsedImport[] = [];
    const lines = script.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match: import { x, y } from 'module' or import type { x } from 'module'
        const importMatch = line.match(/import\s+(type\s+)?(?:\{([^}]+)\}|(\*\s+as\s+\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/);
        
        if (importMatch) {
            const isType = !!importMatch[1];
            const namedImports = importMatch[2];
            const namespaceImport = importMatch[3];
            const defaultImport = importMatch[4];
            const moduleName = importMatch[5];
            
            // Only track zenith imports
            if (moduleName.startsWith('zenith') || moduleName.startsWith('zenith:')) {
                const specifiers: string[] = [];
                
                if (namedImports) {
                    // Parse named imports: { a, b as c, d }
                    const parts = namedImports.split(',');
                    for (const part of parts) {
                        const cleaned = part.trim().split(/\s+as\s+/)[0].trim();
                        if (cleaned) specifiers.push(cleaned);
                    }
                } else if (namespaceImport) {
                    specifiers.push(namespaceImport.trim());
                } else if (defaultImport) {
                    specifiers.push(defaultImport);
                }
                
                imports.push({
                    module: moduleName,
                    specifiers,
                    isType,
                    line: i + 1
                });
            }
        }
        
        // Match: import 'module' (side-effect import)
        const sideEffectMatch = line.match(/import\s+['"]([^'"]+)['"]/);
        if (sideEffectMatch && !importMatch) {
            const moduleName = sideEffectMatch[1];
            if (moduleName.startsWith('zenith') || moduleName.startsWith('zenith:')) {
                imports.push({
                    module: moduleName,
                    specifiers: [],
                    isType: false,
                    line: i + 1
                });
            }
        }
    }
    
    return imports;
}

/**
 * Resolve a module name to its metadata
 */
export function resolveModule(moduleName: string): ResolvedImport {
    if (isCoreModule(moduleName)) {
        return {
            module: moduleName,
            kind: 'core',
            metadata: getCoreModule(moduleName),
            isKnown: true
        };
    }
    
    if (isPluginModule(moduleName)) {
        return {
            module: moduleName,
            kind: 'plugin',
            metadata: getPluginModule(moduleName),
            isKnown: isKnownPluginModule(moduleName)
        };
    }
    
    return {
        module: moduleName,
        kind: 'external',
        isKnown: false
    };
}

/**
 * Get export metadata for a specific import
 */
export function resolveExport(moduleName: string, exportName: string): ModuleExport | PluginExport | undefined {
    if (isCoreModule(moduleName)) {
        return getCoreExport(moduleName, exportName);
    }
    
    if (isKnownPluginModule(moduleName)) {
        return getPluginExport(moduleName, exportName);
    }
    
    return undefined;
}

/**
 * Check if router is imported in the given imports
 */
export function hasRouterImport(imports: ParsedImport[]): boolean {
    return imports.some(i => i.module === 'zenith/router');
}

/**
 * Check if a specific export is imported
 */
export function hasImport(imports: ParsedImport[], exportName: string): boolean {
    return imports.some(i => i.specifiers.includes(exportName));
}

/**
 * Get all available modules for completion
 */
export function getAllModules(): Array<{ module: string; kind: 'core' | 'plugin'; description: string }> {
    const modules: Array<{ module: string; kind: 'core' | 'plugin'; description: string }> = [];
    
    for (const [name, meta] of Object.entries(CORE_MODULES)) {
        modules.push({
            module: name,
            kind: 'core',
            description: meta.description
        });
    }
    
    for (const [name, meta] of Object.entries(PLUGIN_MODULES)) {
        modules.push({
            module: name,
            kind: 'plugin',
            description: meta.description
        });
    }
    
    return modules;
}

/**
 * Get exports for completion from a module
 */
export function getModuleExports(moduleName: string): Array<ModuleExport | PluginExport> {
    const coreModule = getCoreModule(moduleName);
    if (coreModule) return coreModule.exports;
    
    const pluginModule = getPluginModule(moduleName);
    if (pluginModule) return pluginModule.exports;
    
    return [];
}

// Re-export utilities
export { isPluginModule } from './metadata/plugin-imports';

// Re-export types
export type { CoreModuleMetadata, ModuleExport } from './metadata/core-imports';
export type { PluginModuleMetadata, PluginExport } from './metadata/plugin-imports';
