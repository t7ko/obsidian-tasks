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
    /** Missing in settings saved before it was added */
    recurrence?: RecurrenceSettings;
}

/**
 * Horizon history. Spec: `fork-features/horizon-history.md`.
 */
export interface HorizonHistorySettings {
    /** Which tasks the history follows: those with a horizon, or every open task */
    track: 'horizon' | 'open';
    /** Days late from which a late task's badge shows at each level */
    lateDays: { low: number; medium: number; high: number };
    /** Which badges rendered tasks get: lateness, or every open task's age (which tracks all open tasks) */
    badges: 'lateness' | 'age';
    /** Days old from which an open task gets an age badge */
    ageBadgeFrom: number;
    /** Days old from which an age badge shows at each level; younger badges are grey */
    ageDays: { low: number; medium: number; high: number };
}

/**
 * How the horizon feature shows on rendered tasks. Spec: `fork-features/horizon-history.md` (it has the settings).
 */
export interface HorizonSettings {
    /** Whether tasks without a horizon show the faint 🔭 placeholder */
    placeholder: boolean;
}

/**
 * Recurring tasks. Spec: `fork-features/recurrence-delete-on-completion.md`.
 */
export interface RecurrenceSettings {
    /** Whether a 🔁 typed in the editor gets `🏁 delete` added */
    deleteOnCompletion: boolean;
}

export function defaultForkSettings(): Required<ForkSettings> {
    return {
        horizonHistory: {
            track: 'horizon',
            lateDays: { low: 7, medium: 30, high: 90 },
            badges: 'lateness',
            ageBadgeFrom: 14,
            ageDays: { low: 30, medium: 90, high: 365 },
        },
        horizon: {
            placeholder: true,
        },
        recurrence: {
            deleteOnCompletion: false,
        },
    };
}
