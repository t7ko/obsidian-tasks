/**
 * Settings of the t7 fork's features, kept in one object, `t7`, in the plugin's settings.
 *
 * Later additions inside it get no default for existing users (settings are merged shallowly), so read them with
 * fallbacks, as `horizonHistorySettings()` does.
 */
export interface ForkSettings {
    horizonHistory: HorizonHistorySettings;
    /** Missing in settings saved before it was added */
    horizon?: HorizonSettings;
}

/**
 * Horizon history. Spec: `fork-features/horizon-history.md`.
 */
export interface HorizonHistorySettings {
    /** Which tasks the history follows: those with a horizon, or every open task */
    track: 'horizon' | 'open';
    /** Days late from which a late task's badge shows at each level */
    lateDays: { low: number; medium: number; high: number };
}

/**
 * How the horizon feature shows on rendered tasks. Spec: `fork-features/horizon-history.md` (it has the settings).
 */
export interface HorizonSettings {
    /** Whether tasks without a horizon show the faint 🔭 placeholder */
    placeholder: boolean;
}

export function defaultForkSettings(): Required<ForkSettings> {
    return {
        horizonHistory: {
            track: 'horizon',
            lateDays: { low: 7, medium: 30, high: 90 },
        },
        horizon: {
            placeholder: true,
        },
    };
}
