/**
 * Router Awareness
 * 
 * Special support for Zenith Router features.
 * The LSP provides router-aware completions and hovers when zenith/router is imported.
 * 
 * Important: No route file system assumptions or runtime navigation simulation.
 */

export interface RouterHookMetadata {
    name: string;
    owner: string;
    description: string;
    restrictions: string;
    returns: string;
    signature: string;
}

export interface ZenLinkPropMetadata {
    name: string;
    type: string;
    required: boolean;
    description: string;
}

export interface RouteFieldMetadata {
    name: string;
    type: string;
    description: string;
}

/**
 * Router hook definitions
 */
export const ROUTER_HOOKS: Record<string, RouterHookMetadata> = {
    useRoute: {
        name: 'useRoute',
        owner: 'Router Hook (zenith/router)',
        description: 'Provides reactive access to the current route state.',
        restrictions: 'Must be called at top-level script scope.',
        returns: '{ path: string; params: Record<string, string>; query: Record<string, string> }',
        signature: 'useRoute(): RouteState'
    },
    useRouter: {
        name: 'useRouter',
        owner: 'Router Hook (zenith/router)',
        description: 'Provides programmatic navigation methods.',
        restrictions: 'Must be called at top-level script scope.',
        returns: '{ navigate, back, forward, go }',
        signature: 'useRouter(): Router'
    }
};

/**
 * ZenLink component props
 */
export const ZENLINK_PROPS: ZenLinkPropMetadata[] = [
    {
        name: 'to',
        type: 'string',
        required: true,
        description: 'The route path to navigate to.'
    },
    {
        name: 'preload',
        type: 'boolean',
        required: false,
        description: 'Whether to prefetch the route on hover.'
    },
    {
        name: 'replace',
        type: 'boolean',
        required: false,
        description: 'Whether to replace the current history entry instead of pushing a new one.'
    },
    {
        name: 'class',
        type: 'string',
        required: false,
        description: 'CSS class to apply to the link.'
    },
    {
        name: 'activeClass',
        type: 'string',
        required: false,
        description: 'CSS class to apply when the link is active.'
    }
];

/**
 * Route state fields available from useRoute()
 */
export const ROUTE_FIELDS: RouteFieldMetadata[] = [
    {
        name: 'path',
        type: 'string',
        description: 'The current route path (e.g., "/blog/my-post").'
    },
    {
        name: 'params',
        type: 'Record<string, string>',
        description: 'Dynamic route parameters (e.g., { slug: "my-post" }).'
    },
    {
        name: 'query',
        type: 'Record<string, string>',
        description: 'Query string parameters (e.g., { page: "1" }).'
    }
];

/**
 * Router navigation functions
 */
export const ROUTER_FUNCTIONS = [
    {
        name: 'navigate',
        description: 'Navigate to a route programmatically.',
        signature: 'navigate(to: string, options?: { replace?: boolean }): void'
    },
    {
        name: 'prefetch',
        description: 'Prefetch a route for faster navigation.',
        signature: 'prefetch(path: string): Promise<void>'
    },
    {
        name: 'isActive',
        description: 'Check if a route is currently active.',
        signature: 'isActive(path: string, exact?: boolean): boolean'
    },
    {
        name: 'back',
        description: 'Navigate back in history.',
        signature: 'back(): void'
    },
    {
        name: 'forward',
        description: 'Navigate forward in history.',
        signature: 'forward(): void'
    },
    {
        name: 'go',
        description: 'Navigate to a specific history entry.',
        signature: 'go(delta: number): void'
    }
];

/**
 * Get router hook metadata
 */
export function getRouterHook(name: string): RouterHookMetadata | undefined {
    return ROUTER_HOOKS[name];
}

/**
 * Check if a name is a router hook
 */
export function isRouterHook(name: string): boolean {
    return name in ROUTER_HOOKS;
}

/**
 * Get ZenLink prop metadata
 */
export function getZenLinkProp(name: string): ZenLinkPropMetadata | undefined {
    return ZENLINK_PROPS.find(p => p.name === name);
}

/**
 * Get all ZenLink prop names
 */
export function getZenLinkPropNames(): string[] {
    return ZENLINK_PROPS.map(p => p.name);
}

/**
 * Get route field metadata
 */
export function getRouteField(name: string): RouteFieldMetadata | undefined {
    return ROUTE_FIELDS.find(f => f.name === name);
}
