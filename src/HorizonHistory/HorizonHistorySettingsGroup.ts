import { type Plugin, type Setting, type SettingDefinitionItem, debounce } from 'obsidian';
import type { TasksEvents } from '../Obsidian/TasksEvents';
import { type LateDays, horizonHistorySettings, saveHorizonHistorySettings } from './HorizonHistorySettings';
import { horizonPlaceholderShown, saveHorizonPlaceholderShown } from './HorizonPlaceholderSetting';
import { redrawHorizonHistory } from './redrawHorizonHistory';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * The `Horizons` group at the end of the plugin's settings tab: the horizon placeholder and the horizon history.
 */
export function horizonHistorySettingsGroup(
    plugin: Plugin & { saveSettings(): Promise<void> },
    events: TasksEvents,
): SettingDefinitionItem {
    const save = async (change: Parameters<typeof saveHorizonHistorySettings>[1]) => {
        await saveHorizonHistorySettings(plugin, change);
        redrawHorizonHistory(plugin.app, events);
    };

    const lateDaysItem = (level: keyof LateDays, name: string, desc: string) => ({
        name,
        desc,
        render: (setting: Setting) => {
            setting.addText((text) => {
                text.inputEl.type = 'number';
                text.inputEl.min = '1';
                text.setValue(String(horizonHistorySettings().lateDays[level])).onChange(
                    debounce(
                        async (value: string) => {
                            const days = Number(value);
                            if (Number.isInteger(days) && days >= 1) {
                                await save({ lateDays: { ...horizonHistorySettings().lateDays, [level]: days } });
                            }
                        },
                        500,
                        true,
                    ),
                );
            });
        },
    });

    return {
        type: 'group',
        heading: 'Horizons',
        items: [
            {
                name: 'Horizon placeholder',
                desc: "Show a faint 🔭 at the end of each task without a horizon, to click for the horizon menu. Turn it off in a vault that doesn't use horizons; horizons and their lateness badges show either way.",
                render: (setting: Setting) => {
                    setting.addToggle((toggle) => {
                        toggle.setValue(horizonPlaceholderShown()).onChange(async (value) => {
                            await saveHorizonPlaceholderShown(plugin, value);
                            redrawHorizonHistory(plugin.app, events);
                        });
                    });
                },
            },
            {
                name: 'Tasks to track',
                desc: 'Tasks with a horizon get a planned date and can be late. With all open tasks, the history also records when each task without a horizon was first seen.',
                render: (setting: Setting) => {
                    setting.addDropdown((dropdown) => {
                        dropdown
                            .addOption('horizon', 'Tasks with a horizon')
                            .addOption('open', 'All open tasks')
                            .setValue(horizonHistorySettings().track)
                            .onChange(async (value) => {
                                await save({ track: value === 'open' ? 'open' : 'horizon' });
                            });
                    });
                },
            },
            lateDaysItem('low', 'Yellow badge from', 'Days late from which a late task shows a yellow badge.'),
            lateDaysItem('medium', 'Orange badge from', 'Days late from which the badge is orange.'),
            lateDaysItem('high', 'Red badge from', 'Days late from which the badge is red.'),
        ],
    };
}
