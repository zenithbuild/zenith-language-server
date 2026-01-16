/**
 * Plugin Import Metadata
 * 
 * Static metadata for Zenith plugin modules.
 * Plugin modules use the zenith:* namespace.
 * 
 * Important: The LSP must NOT assume plugin presence.
 * If a plugin is not installed, diagnostics should be soft warnings, not errors.
 */

export interface PluginExport {
    name: string;
    kind: 'function' | 'type' | 'variable';
    description: string;
    signature?: string;
}

export interface PluginModuleMetadata {
    module: string;
    description: string;
    exports: PluginExport[];
    required: boolean;
}

/**
 * Known Zenith plugin modules
 */
export const PLUGIN_MODULES: Record<string, PluginModuleMetadata> = {
    'zenith:content': {
        module: 'zenith:content',
        description: 'Content collections plugin for Zenith. Provides type-safe content management for Markdown, MDX, and JSON files.',
        exports: [
            {
                name: 'zenCollection',
                kind: 'function',
                description: 'Define a content collection with schema validation.',
                signature: 'zenCollection<T>(options: { name: string; schema: T }): Collection<T>'
            },
            {
                name: 'getCollection',
                kind: 'function',
                description: 'Get all entries from a content collection.',
                signature: 'getCollection(name: string): Promise<CollectionEntry[]>'
            },
            {
                name: 'getEntry',
                kind: 'function',
                description: 'Get a single entry from a content collection.',
                signature: 'getEntry(collection: string, slug: string): Promise<CollectionEntry | undefined>'
            },
            {
                name: 'useZenOrder',
                kind: 'function',
                description: 'Hook to sort collection entries by frontmatter order field.',
                signature: 'useZenOrder(entries: CollectionEntry[]): CollectionEntry[]'
            }
        ],
        required: false
    },
    'zenith:image': {
        module: 'zenith:image',
        description: 'Image optimization plugin for Zenith.',
        exports: [
            {
                name: 'Image',
                kind: 'function',
                description: 'Optimized image component with automatic format conversion and lazy loading.',
                signature: 'Image({ src: string; alt: string; width?: number; height?: number })'
            },
            {
                name: 'getImage',
                kind: 'function',
                description: 'Get optimized image metadata.',
                signature: 'getImage(src: string, options?: ImageOptions): Promise<ImageMetadata>'
            }
        ],
        required: false
    }
};

/**
 * Get a plugin module by name
 */
export function getPluginModule(moduleName: string): PluginModuleMetadata | undefined {
    return PLUGIN_MODULES[moduleName];
}

/**
 * Get all plugin module names
 */
export function getPluginModuleNames(): string[] {
    return Object.keys(PLUGIN_MODULES);
}

/**
 * Get an export from a plugin module
 */
export function getPluginExport(moduleName: string, exportName: string): PluginExport | undefined {
    const module = PLUGIN_MODULES[moduleName];
    if (!module) return undefined;
    return module.exports.find(e => e.name === exportName);
}

/**
 * Check if a module is a plugin module (zenith:* namespace)
 */
export function isPluginModule(moduleName: string): boolean {
    return moduleName.startsWith('zenith:');
}

/**
 * Check if a plugin module is known
 */
export function isKnownPluginModule(moduleName: string): boolean {
    return moduleName in PLUGIN_MODULES;
}
