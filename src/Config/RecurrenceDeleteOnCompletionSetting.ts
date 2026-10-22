import type { Setting, SettingGroupItem } from 'obsidian';
import { defaultForkSettings } from './ForkSettings';
import { getSettings, updateSettings } from './Settings';

/**
 * t7 fork feature: 🏁 delete for recurrences typed in the editor. Spec:
 * `fork-features/recurrence-delete-on-completion.md`.
 *
 * The setting that turns the feature on, off by default, and its toggle in the Recurring tasks group of the settings
 * tab.
 */

/**
 * Whether a 🔁 typed in the editor gets `🏁 delete`: the saved setting, or the default if it is missing.
 */
export function deleteOnCompletionForTypedRecurrence(): boolean {
    const t7: unknown = (getSettings() as { t7?: unknown }).t7;
    const recurrence = typeof t7 === 'object' && t7 !== null ? (t7 as { recurrence?: unknown }).recurrence : undefined;
    const deleteOnCompletion =
        typeof recurrence === 'object' && recurrence !== null
            ? (recurrence as { deleteOnCompletion?: unknown }).deleteOnCompletion
            : undefined;
    return typeof deleteOnCompletion === 'boolean'
        ? deleteOnCompletion
        : defaultForkSettings().recurrence.deleteOnCompletion;
}

/**
 * Turn the feature on or off, and save the plugin's settings.
 */
export async function saveDeleteOnCompletionForTypedRecurrence(
    plugin: { saveSettings(): Promise<void> },
    on: boolean,
): Promise<void> {
    const t7 = getSettings().t7;
    updateSettings({ t7: { ...t7, recurrence: { ...t7?.recurrence, deleteOnCompletion: on } } });
    await plugin.saveSettings();
}

/**
 * The toggle, for the items of the settings tab's Recurring tasks group.
 */
export function recurrenceDeleteOnCompletionSettingItem(plugin: { saveSettings(): Promise<void> }): SettingGroupItem {
    return {
        name: 'Add 🏁 delete to typed recurrences',
        desc: "When you put a 🔁 into a task line in the editor, by typing it or picking it from Tasks' auto-suggest, add 🏁 delete right after it, so that completing the task leaves only its next occurrence. Removing the 🔁 before leaving the line removes it too, and Undo (Ctrl+Z) takes it back. Tasks with a 🏁 already, pasted text and the edit modal are left alone.",
        render: (setting: Setting) => {
            setting.addToggle((toggle) => {
                toggle.setValue(deleteOnCompletionForTypedRecurrence()).onChange(async (value) => {
                    await saveDeleteOnCompletionForTypedRecurrence(plugin, value);
                });
            });
        },
    };
}
