export interface ZenithServerSettings {
    strictDomLints: boolean;
}

export const DEFAULT_SETTINGS: ZenithServerSettings = Object.freeze({
    strictDomLints: false
});

export function normalizeSettings(input: unknown): ZenithServerSettings {
    const maybe = (input || {}) as { strictDomLints?: unknown };
    const strictDomLints = maybe.strictDomLints === true;
    return { strictDomLints };
}
