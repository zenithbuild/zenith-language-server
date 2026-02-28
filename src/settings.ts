export type ComponentScriptsMode = 'forbid' | 'allow';

export interface ZenithServerSettings {
    componentScripts: ComponentScriptsMode;
    strictDomLints: boolean;
}

export const DEFAULT_SETTINGS: ZenithServerSettings = Object.freeze({
    componentScripts: 'forbid',
    strictDomLints: false
});

export function normalizeSettings(input: unknown): ZenithServerSettings {
    const maybe = (input || {}) as { componentScripts?: unknown; strictDomLints?: unknown };
    const mode = maybe.componentScripts === 'allow' ? 'allow' : 'forbid';
    const strictDomLints = maybe.strictDomLints === true;
    return { componentScripts: mode, strictDomLints };
}
