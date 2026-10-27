import { type HorizonHistorySettings, defaultForkSettings } from '../Config/ForkSettings';
import { getSettings, updateSettings } from '../Config/Settings';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 */

export type LateDays = HorizonHistorySettings['lateDays'];

/**
 * Which tasks the history follows with these settings: age badges need every open task.
 */
export function trackedTasks(settings: HorizonHistorySettings): HorizonHistorySettings['track'] {
    return settings.badges === 'age' ? 'open' : settings.track;
}

/**
 * The horizon history's settings, with defaults for anything missing or invalid. Each set of three day counts is put
 * in ascending order.
 */
export function horizonHistorySettings(): HorizonHistorySettings {
    const t7: unknown = (getSettings() as { t7?: unknown }).t7;
    const horizonHistory =
        typeof t7 === 'object' && t7 !== null ? (t7 as { horizonHistory?: unknown }).horizonHistory : undefined;
    return normaliseHorizonHistorySettings(horizonHistory);
}

export function normaliseHorizonHistorySettings(value: unknown): HorizonHistorySettings {
    const defaults = defaultForkSettings().horizonHistory;
    const given = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const track = given.track === 'open' || given.track === 'horizon' ? given.track : defaults.track;
    const badges = given.badges === 'age' || given.badges === 'lateness' ? given.badges : defaults.badges;
    const ageBadgeFrom = isDayCount(given.ageBadgeFrom) ? given.ageBadgeFrom : defaults.ageBadgeFrom;
    return {
        track,
        lateDays: normaliseDayLevels(given.lateDays, defaults.lateDays),
        badges,
        ageBadgeFrom,
        ageDays: normaliseDayLevels(given.ageDays, defaults.ageDays),
    };
}

function normaliseDayLevels(value: unknown, defaults: LateDays): LateDays {
    const given = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const [low, medium, high] = (['low', 'medium', 'high'] as const)
        .map((level) => {
            const days = given[level];
            return isDayCount(days) ? days : defaults[level];
        })
        .sort((a, b) => a - b);
    return { low, medium, high };
}

/**
 * Change some of the horizon history's settings and save the plugin's settings.
 */
export async function saveHorizonHistorySettings(
    plugin: { saveSettings(): Promise<void> },
    change: Partial<HorizonHistorySettings>,
): Promise<void> {
    const horizonHistory = { ...horizonHistorySettings(), ...change };
    updateSettings({ t7: { ...getSettings().t7, horizonHistory } });
    await plugin.saveSettings();
}

function isDayCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}
