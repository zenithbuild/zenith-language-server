export type ComponentScriptsMode = 'forbid' | 'allow';

export interface ZenithServerSettings {
    componentScripts: ComponentScriptsMode;
}

export const DEFAULT_SETTINGS: ZenithServerSettings = Object.freeze({
    componentScripts: 'forbid'
});

export function normalizeSettings(input: unknown): ZenithServerSettings {
    const maybe = (input || {}) as { componentScripts?: unknown };
    const mode = maybe.componentScripts === 'allow' ? 'allow' : 'forbid';
    return { componentScripts: mode };
}
