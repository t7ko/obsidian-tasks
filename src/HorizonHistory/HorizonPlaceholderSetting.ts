import { defaultForkSettings } from '../Config/ForkSettings';
import { getSettings, updateSettings } from '../Config/Settings';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * The setting that turns off the horizon feature's placeholder, the faint 🔭 at the end of tasks without a horizon.
 */

/**
 * Whether tasks without a horizon show the placeholder: the saved setting, or the default if it is missing.
 */
export function horizonPlaceholderShown(): boolean {
    const t7: unknown = (getSettings() as { t7?: unknown }).t7;
    const horizon = typeof t7 === 'object' && t7 !== null ? (t7 as { horizon?: unknown }).horizon : undefined;
    const placeholder =
        typeof horizon === 'object' && horizon !== null
            ? (horizon as { placeholder?: unknown }).placeholder
            : undefined;
    return typeof placeholder === 'boolean' ? placeholder : defaultForkSettings().horizon.placeholder;
}

/**
 * Turn the placeholder on or off, and save the plugin's settings.
 */
export async function saveHorizonPlaceholderShown(
    plugin: { saveSettings(): Promise<void> },
    shown: boolean,
): Promise<void> {
    const t7 = getSettings().t7;
    updateSettings({ t7: { ...t7, horizon: { ...t7?.horizon, placeholder: shown } } });
    await plugin.saveSettings();
}
