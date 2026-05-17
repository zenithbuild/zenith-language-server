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
        description: 'Core Zenith runtime primitives.',
        exports: [
            {
                name: 'signal',
                kind: 'function',
                description: 'Create a reactive signal. Returns an object with explicit `.get()` / `.set(value)` / `.subscribe(fn)` methods. There is no `.value` property.',
                signature: 'signal<T>(initialValue: T): { get(): T; set(next: T): T; subscribe(fn: (value: T) => void): () => void }'
            },
            {
                name: 'state',
                kind: 'function',
                description: 'Runtime plain-object store. Reads via `.get()`, writes via `.set(patch | (prev) => next)`. For declarative reactive locals in `.zen` scripts prefer the compiler form `state name = initial`.',
                signature: 'state<T extends Record<string, unknown>>(initial: T): { get(): Readonly<T>; set(patch: Partial<T> | ((prev: Readonly<T>) => T)): Readonly<T> }'
            },
            {
                name: 'ref',
                kind: 'function',
                description: 'Create a Zenith ref for DOM nodes (and stable values). Access via `.current`. Forbidden patterns: `.value`, Vue-style reactive wrappers.',
                signature: 'ref<T>(initialValue?: T): { current: T | null }'
            },
            {
                name: 'zenEffect',
                kind: 'function',
                description: 'Reactive effect that re-runs when its tracked signal/state dependencies change. Provides a context with `cleanup`, `timeout`, `raf`, `debounce` helpers.',
                signature: 'zenEffect(effect: (ctx: EffectContext) => void | (() => void), options?: EffectOptions): void'
            },
            {
                name: 'zenMount',
                kind: 'function',
                description: 'Run a callback once when the host element mounts. Provides a context with `cleanup(disposer)` for tearing down listeners and timers.',
                signature: 'zenMount(callback: (ctx: { cleanup(disposer: () => void): void }) => void | (() => void)): void'
            },
            {
                name: 'zenWindow',
                kind: 'function',
                description: 'SSR-safe `window` access. Returns `null` outside the browser. Use instead of the global `window`.',
                signature: 'zenWindow(): Window | null'
            },
            {
                name: 'zenDocument',
                kind: 'function',
                description: 'SSR-safe `document` access. Returns `null` outside the browser. Use instead of the global `document`.',
                signature: 'zenDocument(): Document | null'
            },
            {
                name: 'zenOn',
                kind: 'function',
                description: 'Add an event listener that is SSR-safe and returns a disposer suitable for `ctx.cleanup(...)`. Forbidden alternative: calling `addEventListener` directly in `.zen` scripts.',
                signature: 'zenOn<T extends Event>(target: EventTarget | null, eventName: string, handler: (event: T) => void, options?: AddEventListenerOptions): () => void'
            },
            {
                name: 'zenResize',
                kind: 'function',
                description: 'Subscribe to window resize updates. Returns a disposer suitable for `ctx.cleanup(...)`.',
                signature: 'zenResize(handler: (size: { w: number; h: number }) => void): () => void'
            },
            {
                name: 'collectRefs',
                kind: 'function',
                description: 'Collect multiple Zenith refs into a deterministic array of attached elements. Use instead of `querySelectorAll` for multi-node operations.',
                signature: 'collectRefs<T extends Element>(...refs: { current: T | null }[]): T[]'
            }
        ]
    },
    'zenith:server-contract': {
        module: 'zenith:server-contract',
        description: 'Server-side route handler primitives and result helpers used inside `<script server lang="ts">` blocks and `page.guard.ts` / `page.load.ts` files.',
        exports: [
            {
                name: 'allow',
                kind: 'function',
                description: 'Result helper that allows the request to continue. Returned from `guard(ctx)`.',
                signature: 'allow(): RouteResult'
            },
            {
                name: 'redirect',
                kind: 'function',
                description: 'Result helper that redirects to the given location. Returned from `guard(ctx)` or `load(ctx)`.',
                signature: 'redirect(location: string, status?: number): RouteResult'
            },
            {
                name: 'deny',
                kind: 'function',
                description: 'Result helper that denies the request with an optional status and message.',
                signature: 'deny(status?: number, message?: string): RouteResult'
            },
            {
                name: 'data',
                kind: 'function',
                description: 'Result helper that returns a payload to the route component as `data`. Returned from `load(ctx)` or `action(ctx)`. A plain object returned from `load` is treated as `data(payload)`.',
                signature: 'data<T>(payload: T): RouteResult<T>'
            },
            {
                name: 'invalid',
                kind: 'function',
                description: 'Result helper for invalid action inputs (validation failures, etc.).',
                signature: 'invalid(reason: string, details?: Record<string, unknown>): RouteResult'
            },
            {
                name: 'json',
                kind: 'function',
                description: 'Result helper for JSON responses from `action(ctx)`.',
                signature: 'json<T>(payload: T, init?: { status?: number; headers?: Record<string, string> }): RouteResult<T>'
            },
            {
                name: 'text',
                kind: 'function',
                description: 'Result helper for plain text responses from `action(ctx)`.',
                signature: 'text(body: string, init?: { status?: number; headers?: Record<string, string> }): RouteResult'
            },
            {
                name: 'download',
                kind: 'function',
                description: 'Result helper for downloadable file responses from `action(ctx)`.',
                signature: 'download(body: BodyInit, filename: string, init?: { status?: number; headers?: Record<string, string> }): RouteResult'
            },
            {
                name: 'withMiddleware',
                kind: 'function',
                description: 'Compose route-local middleware around `guard(ctx)`, `load(ctx)`, or `action(ctx)`. Middleware composes left-to-right as declared.',
                signature: 'withMiddleware<H>(handler: H, ...middleware: Array<(h: H) => H>): H'
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
