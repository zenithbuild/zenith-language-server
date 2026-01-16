/**
 * Core Import Metadata
 * 
 * Static metadata for Zenith core modules.
 * These are virtual modules resolved symbolically (no FS probing).
 */

export interface ModuleExport {
    name: string;
    kind: 'function' | 'component' | 'type' | 'variable';
    description: string;
    signature?: string;
}

export interface CoreModuleMetadata {
    module: string;
    description: string;
    exports: ModuleExport[];
}

/**
 * Core Zenith module exports
 */
export const CORE_MODULES: Record<string, CoreModuleMetadata> = {
    'zenith': {
        module: 'zenith',
        description: 'Core Zenith runtime primitives and lifecycle hooks.',
        exports: [
            {
                name: 'zenEffect',
                kind: 'function',
                description: 'Reactive effect that re-runs when dependencies change.',
                signature: 'zenEffect(callback: () => void | (() => void)): void'
            },
            {
                name: 'zenOnMount',
                kind: 'function',
                description: 'Called when component is mounted to the DOM.',
                signature: 'zenOnMount(callback: () => void | (() => void)): void'
            },
            {
                name: 'zenOnDestroy',
                kind: 'function',
                description: 'Called when component is removed from the DOM.',
                signature: 'zenOnDestroy(callback: () => void): void'
            },
            {
                name: 'zenOnUpdate',
                kind: 'function',
                description: 'Called after any state update causes a re-render.',
                signature: 'zenOnUpdate(callback: () => void): void'
            },
            {
                name: 'zenRef',
                kind: 'function',
                description: 'Create a reactive reference.',
                signature: 'zenRef<T>(initial: T): { value: T }'
            },
            {
                name: 'zenState',
                kind: 'function',
                description: 'Create reactive state.',
                signature: 'zenState<T>(initial: T): [T, (value: T) => void]'
            },
            {
                name: 'zenMemo',
                kind: 'function',
                description: 'Memoize a computed value.',
                signature: 'zenMemo<T>(compute: () => T): T'
            },
            {
                name: 'zenBatch',
                kind: 'function',
                description: 'Batch multiple state updates.',
                signature: 'zenBatch(callback: () => void): void'
            },
            {
                name: 'zenUntrack',
                kind: 'function',
                description: 'Run code without tracking dependencies.',
                signature: 'zenUntrack<T>(callback: () => T): T'
            }
        ]
    },
    'zenith/router': {
        module: 'zenith/router',
        description: 'File-based SPA router for Zenith framework.',
        exports: [
            {
                name: 'ZenLink',
                kind: 'component',
                description: 'Declarative navigation component for routes.',
                signature: '<ZenLink to="/path" preload?>{children}</ZenLink>'
            },
            {
                name: 'useRoute',
                kind: 'function',
                description: 'Provides reactive access to the current route. Must be called at top-level script scope.',
                signature: 'useRoute(): { path: string; params: Record<string, string>; query: Record<string, string> }'
            },
            {
                name: 'useRouter',
                kind: 'function',
                description: 'Provides programmatic navigation methods.',
                signature: 'useRouter(): { navigate: (to: string, options?: { replace?: boolean }) => void; back: () => void; forward: () => void }'
            },
            {
                name: 'navigate',
                kind: 'function',
                description: 'Navigate to a route programmatically.',
                signature: 'navigate(to: string, options?: { replace?: boolean }): void'
            },
            {
                name: 'prefetch',
                kind: 'function',
                description: 'Prefetch a route for faster navigation.',
                signature: 'prefetch(path: string): Promise<void>'
            },
            {
                name: 'isActive',
                kind: 'function',
                description: 'Check if a route is currently active.',
                signature: 'isActive(path: string, exact?: boolean): boolean'
            },
            {
                name: 'getRoute',
                kind: 'function',
                description: 'Get the current route state.',
                signature: 'getRoute(): { path: string; params: Record<string, string>; query: Record<string, string> }'
            }
        ]
    }
};

/**
 * Get a core module by name
 */
export function getCoreModule(moduleName: string): CoreModuleMetadata | undefined {
    return CORE_MODULES[moduleName];
}

/**
 * Get all core module names
 */
export function getCoreModuleNames(): string[] {
    return Object.keys(CORE_MODULES);
}

/**
 * Get an export from a core module
 */
export function getCoreExport(moduleName: string, exportName: string): ModuleExport | undefined {
    const module = CORE_MODULES[moduleName];
    if (!module) return undefined;
    return module.exports.find(e => e.name === exportName);
}

/**
 * Check if a module is a core Zenith module
 */
export function isCoreModule(moduleName: string): boolean {
    return moduleName in CORE_MODULES;
}
