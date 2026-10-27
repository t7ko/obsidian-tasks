import { type Plugin, type Setting, type SettingDefinitionItem, debounce } from 'obsidian';
import type { TasksEvents } from '../Obsidian/TasksEvents';
import { type LateDays, horizonHistorySettings, saveHorizonHistorySettings } from './HorizonHistorySettings';
import { horizonPlaceholderShown, saveHorizonPlaceholderShown } from './HorizonPlaceholderSetting';
import { redrawHorizonHistory } from './redrawHorizonHistory';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * The `Horizons` group at the end of the plugin's settings tab: the horizon placeholder and the horizon history.
 *
 * @param plugin
 * @param events
 * @param refreshVisibility - re-evaluates the `visible` predicates of the tab's items, after the badge mode changed.
 */
export function horizonHistorySettingsGroup(
    plugin: Plugin & { saveSettings(): Promise<void> },
    events: TasksEvents,
    refreshVisibility: () => void = () => {},
): SettingDefinitionItem {
    const save = async (change: Parameters<typeof saveHorizonHistorySettings>[1]) => {
        await saveHorizonHistorySettings(plugin, change);
        redrawHorizonHistory(plugin.app, events);
    };

    const showsLateness = () => horizonHistorySettings().badges === 'lateness';
    const showsAge = () => horizonHistorySettings().badges === 'age';

    const dayCountItem = (
        name: string,
        desc: string,
        visible: () => boolean,
        current: () => number,
        change: (days: number) => Parameters<typeof saveHorizonHistorySettings>[1],
    ) => ({
        name,
        desc,
        visible,
        render: (setting: Setting) => {
            setting.addText((text) => {
                text.inputEl.type = 'number';
                text.inputEl.min = '1';
                text.setValue(String(current())).onChange(
                    debounce(
                        async (value: string) => {
                            const days = Number(value);
                            if (Number.isInteger(days) && days >= 1) {
                                await save(change(days));
                            }
                        },
                        500,
                        true,
                    ),
                );
            });
        },
    });

    const lateDaysItem = (level: keyof LateDays, name: string, desc: string) =>
        dayCountItem(
            name,
            desc,
            showsLateness,
            () => horizonHistorySettings().lateDays[level],
            (days) => ({ lateDays: { ...horizonHistorySettings().lateDays, [level]: days } }),
        );

    const ageDaysItem = (level: keyof LateDays, name: string, desc: string) =>
        dayCountItem(
            name,
            desc,
            showsAge,
            () => horizonHistorySettings().ageDays[level],
            (days) => ({ ageDays: { ...horizonHistorySettings().ageDays, [level]: days } }),
        );

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
                name: 'Badges show',
                desc: "Lateness: late tasks with a horizon get a badge saying how late they are. Age: every open task gets a badge saying how old it is, with or without a horizon, and all open tasks are tracked. For a vault that doesn't use horizons.",
                render: (setting: Setting) => {
                    setting.addDropdown((dropdown) => {
                        dropdown
                            .addOption('lateness', 'Lateness')
                            .addOption('age', 'Age')
                            .setValue(horizonHistorySettings().badges)
                            .onChange(async (value) => {
                                await save({ badges: value === 'age' ? 'age' : 'lateness' });
                                refreshVisibility();
                            });
                    });
                },
            },
            {
                name: 'Tasks to track',
                desc: 'Tasks with a horizon get a planned date and can be late. With all open tasks, the history also records when each task without a horizon was first seen.',
                visible: showsLateness,
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
            dayCountItem(
                'Age badge from',
                'Days old from which an open task shows an age badge, grey until the yellow age.',
                showsAge,
                () => horizonHistorySettings().ageBadgeFrom,
                (days) => ({ ageBadgeFrom: days }),
            ),
            ageDaysItem('low', 'Yellow age from', 'Days old from which an age badge is yellow.'),
            ageDaysItem('medium', 'Orange age from', 'Days old from which an age badge is orange.'),
            ageDaysItem('high', 'Red age from', 'Days old from which an age badge is red.'),
        ],
    };
}
