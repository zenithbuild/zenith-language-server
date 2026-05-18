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
            },
            {
                name: 'zeneffect',
                kind: 'function',
                description:
                    'Low-level effect primitive from `zenith`: auto-tracked `(effect)` or explicit `(dependencies[], effect)`. Prefer `zenEffect` unless dependency lists are required.',
                signature:
                    'zeneffect(effect: (ctx: EffectContext) => void | (() => void), options?: EffectOptions): void\nzeneffect<T>(dependencies: unknown[], effect: (ctx: EffectContext) => void | (() => void)): void'
            },
            {
                name: 'effect',
                kind: 'function',
                description: 'Alias of `zeneffect` (bundled runtime export).',
                signature: 'effect: typeof zeneffect'
            },
            {
                name: 'mount',
                kind: 'function',
                description: 'Alias of `zenMount` (bundled runtime export).',
                signature: 'mount: typeof zenMount'
            },
            {
                name: 'zenPresence',
                kind: 'function',
                description:
                    'Ref-owned presence controller for enter/exit transitions. Typically call `.mount()` inside `zenMount` and drive `.setPresent(...)` from reactive state.',
                signature:
                    'zenPresence(ref: { current?: Element | null }, options?: { timeoutMs?: number; onPhaseChange?: (phase: string, ctx: unknown) => void } | null): { mount(): () => void; destroy(): void; getPhase(): string; setPresent(nextPresent: boolean): void }'
            },
            {
                name: 'presence',
                kind: 'function',
                description: 'Alias of `zenPresence`.',
                signature: 'presence: typeof zenPresence'
            },
            {
                name: 'hydrate',
                kind: 'function',
                description:
                    'Client bootstrap entry that hydrates compiled Zenith payload output. Advanced runtime integration surface.',
                signature: 'hydrate(payload: unknown): void'
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
    '@zenithbuild/router': {
        module: '@zenithbuild/router',
        description: 'Shipped Zenith router package. Use `navigate()` for programmatic navigation and `<ZenLink>` (imported from `@zenithbuild/router/ZenLink.zen`) for anchor-based soft navigation.',
        exports: [
            {
                name: 'createRouter',
                kind: 'function',
                description: 'Bootstrap a router instance over a route table and a container element. Typically called once at app entry.',
                signature: 'createRouter(config: { routes: Route[]; container: HTMLElement }): { start(): Promise<void>; destroy(): void }'
            },
            {
                name: 'navigate',
                kind: 'function',
                description: 'Navigate to a path. Performs the canonical Zenith soft-navigation flow (guard → load → render). Falls back to a hard navigation when the router cannot safely mirror server truth.',
                signature: 'navigate(path: string): Promise<void>'
            },
            {
                name: 'refreshCurrentRoute',
                kind: 'function',
                description: 'Re-resolve and re-render the current route. Useful after mutating server-side data that should be re-fetched by `load`.',
                signature: 'refreshCurrentRoute(): Promise<void>'
            },
            {
                name: 'back',
                kind: 'function',
                description: 'Go back one entry in the navigation history.',
                signature: 'back(): void'
            },
            {
                name: 'forward',
                kind: 'function',
                description: 'Go forward one entry in the navigation history.',
                signature: 'forward(): void'
            },
            {
                name: 'getCurrentPath',
                kind: 'function',
                description: 'Read the current route path. Returns the active URL pathname without query/hash.',
                signature: 'getCurrentPath(): string'
            },
            {
                name: 'onRouteChange',
                kind: 'function',
                description: 'Subscribe to navigation completion events. Returns a disposer.',
                signature: 'onRouteChange(listener: (event: { path: string; routeId: string; params: Record<string, string> }) => void): () => void'
            },
            {
                name: 'on',
                kind: 'function',
                description: 'Subscribe to a router lifecycle event (e.g. `route:beforeleave`, `route:enter`, `route:error`). Returns a disposer.',
                signature: 'on(event: string, listener: (payload: unknown) => void): () => void'
            },
            {
                name: 'off',
                kind: 'function',
                description: 'Remove a previously registered router lifecycle listener.',
                signature: 'off(event: string, listener: (payload: unknown) => void): void'
            },
            {
                name: 'setAdvisoryRoutePolicy',
                kind: 'function',
                description: 'Configure client-side advisory behavior (deny handling, login redirect, 403 path). Security remains server-authoritative; this only shapes navigation UX.',
                signature: 'setAdvisoryRoutePolicy(policy: AdvisoryRoutePolicy): void'
            },
            {
                name: 'zenNavigationShell',
                kind: 'function',
                description: 'Mount a navigation-shell controller that observes phase transitions (`idle` → `leaving` → `swapping` → `entering`) for chrome animations and skeletons.',
                signature: 'zenNavigationShell(options?: NavigationShellOptions): NavigationShellController'
            },
            {
                name: 'matchRoute',
                kind: 'function',
                description: 'Match a path against a static route table. Returns the matched route and extracted params, or `null`.',
                signature: 'matchRoute(routes: Route[], path: string): { route: Route; params: Record<string, string> } | null'
            }
        ]
    },
    '@zenithbuild/router/ZenLink.zen': {
        module: '@zenithbuild/router/ZenLink.zen',
        description: 'Default-exports the canonical `<ZenLink>` anchor component. Renders a real `<a data-zen-link="true" href="...">` and opts into Zenith soft navigation. Imported as `import ZenLink from "@zenithbuild/router/ZenLink.zen"`.',
        exports: [
            {
                name: 'ZenLink',
                kind: 'component',
                description: 'Default export: the `<ZenLink>` component. Props: `href` (required), `class`, `target`, `rel`, `id`, `title`, `ariaLabel`, `ariaCurrent`, `ariaDisabled`, `elementRef`, `onClick`, `onHoverIn`, `onHoverOut`, `onFocus`, `onBlur`. Children are inlined into the single implicit slot.',
                signature: '<ZenLink href="/path">label</ZenLink>'
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
