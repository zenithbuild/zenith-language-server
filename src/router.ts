/**
 * Router Awareness
 *
 * Static catalog of the shipped `@zenithbuild/router` API surface and the
 * `<ZenLink>` component props. The LSP uses this for router-aware completions
 * and hovers when the router package (or `ZenLink.zen` subpath) is imported.
 *
 * Source of truth:
 *   - Router exports: `packages/router/index.d.ts` (`@zenithbuild/router`)
 *   - `<ZenLink>` props: `packages/router/src/ZenLink.zen`
 *
 * Forbidden legacy surfaces (do not re-introduce):
 *   - `useRoute`, `useRouter`               — never shipped by router
 *   - `prefetch`, `isActive`, `getRoute`,
 *     `go(delta)`                            — never shipped by router
 *   - `<ZenLink to=...>`, `<ZenLink preload>` — not on the real Props type
 */

export interface RouterFunctionMetadata {
    name: string;
    description: string;
    signature: string;
}

export interface ZenLinkPropMetadata {
    name: string;
    type: string;
    required: boolean;
    description: string;
}

/**
 * Programmatic navigation surface exported by `@zenithbuild/router`.
 */
export const ROUTER_FUNCTIONS: RouterFunctionMetadata[] = [
    {
        name: 'createRouter',
        description: 'Bootstrap a router instance over a route table and a container element. Typically called once at app entry.',
        signature: 'createRouter(config: { routes: Route[]; container: HTMLElement }): { start(): Promise<void>; destroy(): void }'
    },
    {
        name: 'navigate',
        description: 'Navigate to a path. Runs the canonical Zenith soft-navigation flow (guard → load → render). Falls back to hard navigation when the router cannot mirror server truth.',
        signature: 'navigate(path: string): Promise<void>'
    },
    {
        name: 'refreshCurrentRoute',
        description: 'Re-resolve and re-render the current route. Useful after mutating server-side data that should be re-fetched by `load`.',
        signature: 'refreshCurrentRoute(): Promise<void>'
    },
    {
        name: 'back',
        description: 'Go back one entry in the navigation history.',
        signature: 'back(): void'
    },
    {
        name: 'forward',
        description: 'Go forward one entry in the navigation history.',
        signature: 'forward(): void'
    },
    {
        name: 'getCurrentPath',
        description: 'Read the current route path. Returns the active URL pathname without query/hash.',
        signature: 'getCurrentPath(): string'
    },
    {
        name: 'onRouteChange',
        description: 'Subscribe to navigation completion events. Returns a disposer.',
        signature: 'onRouteChange(listener: (event: { path: string; routeId: string; params: Record<string, string> }) => void): () => void'
    },
    {
        name: 'on',
        description: 'Subscribe to a router lifecycle event (e.g. `route:beforeleave`, `route:enter`, `route:error`). Returns a disposer.',
        signature: 'on(event: string, listener: (payload: unknown) => void): () => void'
    },
    {
        name: 'off',
        description: 'Remove a previously registered router lifecycle listener.',
        signature: 'off(event: string, listener: (payload: unknown) => void): void'
    },
    {
        name: 'setAdvisoryRoutePolicy',
        description: 'Configure client-side advisory behavior (deny handling, login redirect, 403 path). Security remains server-authoritative; this only shapes navigation UX.',
        signature: 'setAdvisoryRoutePolicy(policy: AdvisoryRoutePolicy): void'
    },
    {
        name: 'zenNavigationShell',
        description: 'Mount a navigation-shell controller that observes phase transitions (`idle` → `leaving` → `swapping` → `entering`) for chrome animations and skeletons.',
        signature:
            'zenNavigationShell(ref: { current?: Element | null }, options?: NavigationShellOptions | null): NavigationShellController'
    },
    {
        name: 'matchRoute',
        description: 'Match a path against a static route table. Returns the matched route and extracted params, or `null`.',
        signature: 'matchRoute(routes: Route[], path: string): { route: Route; params: Record<string, string> } | null'
    }
];

/**
 * `<ZenLink>` component props, mirroring `packages/router/src/ZenLink.zen`.
 *
 * Children are inlined via the single implicit `<slot />`; there is no
 * `children` prop. There are no `to`, `preload`, `replace`, or `activeClass`
 * props — those are not on the shipped Props type.
 */
export const ZENLINK_PROPS: ZenLinkPropMetadata[] = [
    {
        name: 'href',
        type: 'string',
        required: true,
        description: 'Anchor href. Renders as a real `<a href="...">` with `data-zen-link="true"`.'
    },
    {
        name: 'class',
        type: 'string',
        required: false,
        description: 'CSS class applied to the rendered anchor.'
    },
    {
        name: 'target',
        type: 'string',
        required: false,
        description: 'Standard anchor `target` attribute (e.g. `_blank`).'
    },
    {
        name: 'rel',
        type: 'string',
        required: false,
        description: 'Standard anchor `rel` attribute (e.g. `noopener noreferrer`).'
    },
    {
        name: 'id',
        type: 'string',
        required: false,
        description: 'Element id.'
    },
    {
        name: 'title',
        type: 'string',
        required: false,
        description: 'Tooltip / accessible title for the anchor.'
    },
    {
        name: 'ariaLabel',
        type: 'string',
        required: false,
        description: 'Accessible label (rendered as `aria-label`).'
    },
    {
        name: 'ariaCurrent',
        type: 'string',
        required: false,
        description: 'Current-link indicator (rendered as `aria-current`, e.g. `page`).'
    },
    {
        name: 'ariaDisabled',
        type: 'string',
        required: false,
        description: 'Disabled indicator (rendered as `aria-disabled`).'
    },
    {
        name: 'elementRef',
        type: 'Ref<HTMLAnchorElement>',
        required: false,
        description: 'Forwarded ref that receives the underlying `<a>` element after mount.'
    },
    {
        name: 'onClick',
        type: '(event: MouseEvent) => void',
        required: false,
        description: 'Click handler. Use to intercept navigation when needed.'
    },
    {
        name: 'onHoverIn',
        type: '(event: PointerEvent) => void',
        required: false,
        description: 'Pointer-enter handler (Zenith `on:hoverin` alias).'
    },
    {
        name: 'onHoverOut',
        type: '(event: PointerEvent) => void',
        required: false,
        description: 'Pointer-leave handler (Zenith `on:hoverout` alias).'
    },
    {
        name: 'onFocus',
        type: '(event: FocusEvent) => void',
        required: false,
        description: 'Focus handler.'
    },
    {
        name: 'onBlur',
        type: '(event: FocusEvent) => void',
        required: false,
        description: 'Blur handler.'
    }
];

/**
 * Get router function metadata by name.
 */
export function getRouterFunction(name: string): RouterFunctionMetadata | undefined {
    return ROUTER_FUNCTIONS.find((fn) => fn.name === name);
}

/**
 * Check if a name is a known router function.
 */
export function isRouterFunction(name: string): boolean {
    return ROUTER_FUNCTIONS.some((fn) => fn.name === name);
}

/**
 * Get ZenLink prop metadata.
 */
export function getZenLinkProp(name: string): ZenLinkPropMetadata | undefined {
    return ZENLINK_PROPS.find((p) => p.name === name);
}

/**
 * Get all ZenLink prop names.
 */
export function getZenLinkPropNames(): string[] {
    return ZENLINK_PROPS.map((p) => p.name);
}
