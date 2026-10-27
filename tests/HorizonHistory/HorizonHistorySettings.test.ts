import type { SettingDefinitionGroup } from 'obsidian';
import { resetSettings, updateSettings } from '../../src/Config/Settings';
import { horizonHistorySettingsGroup } from '../../src/HorizonHistory/HorizonHistorySettingsGroup';
import {
    horizonHistorySettings,
    normaliseHorizonHistorySettings,
    saveHorizonHistorySettings,
    trackedTasks,
} from '../../src/HorizonHistory/HorizonHistorySettings';

afterEach(() => {
    resetSettings();
});

const ageDefaults = { badges: 'lateness', ageBadgeFrom: 14, ageDays: { low: 30, medium: 90, high: 365 } };

describe('horizon history settings', () => {
    it('has relaxed defaults', () => {
        expect(horizonHistorySettings()).toEqual({
            track: 'horizon',
            lateDays: { low: 7, medium: 30, high: 90 },
            ...ageDefaults,
        });
    });

    it.each([
        [undefined, { track: 'horizon', lateDays: { low: 7, medium: 30, high: 90 } }],
        [{ track: 'open' }, { track: 'open', lateDays: { low: 7, medium: 30, high: 90 } }],
        [
            { track: 'everything', lateDays: { low: 3 } },
            { track: 'horizon', lateDays: { low: 3, medium: 30, high: 90 } },
        ],
        [
            { lateDays: { low: 0, medium: 2.5, high: 'x' } },
            { track: 'horizon', lateDays: { low: 7, medium: 30, high: 90 } },
        ],
        [
            { lateDays: { low: 40, medium: 10, high: 20 } },
            { track: 'horizon', lateDays: { low: 10, medium: 20, high: 40 } },
        ],
    ])('reads %j as %j', (value, expected) => {
        expect(normaliseHorizonHistorySettings(value)).toEqual({ ...expected, ...ageDefaults });
    });

    it.each([
        [{ badges: 'age' }, { badges: 'age' }],
        [{ badges: 'everything' }, { badges: 'lateness' }],
        [{ ageBadgeFrom: 60 }, { ageBadgeFrom: 60 }],
        [{ ageBadgeFrom: 0 }, { ageBadgeFrom: 14 }],
        [{ ageDays: { low: 400, medium: 7 } }, { ageDays: { low: 7, medium: 365, high: 400 } }],
        [{ ageDays: { low: -1, medium: 'x', high: 1.5 } }, { ageDays: { low: 30, medium: 90, high: 365 } }],
    ])('reads %j with age settings as %j', (value, expected) => {
        expect(normaliseHorizonHistorySettings(value)).toEqual({
            track: 'horizon',
            lateDays: { low: 7, medium: 30, high: 90 },
            ...ageDefaults,
            ...expected,
        });
    });

    it.each([
        ['horizon', 'lateness', 'horizon'],
        ['open', 'lateness', 'open'],
        ['horizon', 'age', 'open'],
        ['open', 'age', 'open'],
    ] as const)('tracking %s tasks with %s badges tracks %s tasks', (track, badges, expected) => {
        expect(trackedTasks({ ...horizonHistorySettings(), track, badges })).toEqual(expected);
    });

    it('saves a change and keeps the rest', async () => {
        const plugin = { saveSettings: vi.fn(async () => {}) };
        await saveHorizonHistorySettings(plugin, { track: 'open' });
        await saveHorizonHistorySettings(plugin, { lateDays: { low: 2, medium: 14, high: 60 } });
        await saveHorizonHistorySettings(plugin, { badges: 'age' });
        expect(horizonHistorySettings()).toEqual({
            ...ageDefaults,
            track: 'open',
            lateDays: { low: 2, medium: 14, high: 60 },
            badges: 'age',
        });
        expect(plugin.saveSettings).toHaveBeenCalledTimes(3);
    });

    it('reads settings saved without the fork', () => {
        updateSettings({ t7: undefined });
        expect(horizonHistorySettings().track).toEqual('horizon');
    });
});

describe('horizon history settings group', () => {
    function shownSettings(): string[] {
        const plugin = { saveSettings: async () => {} } as unknown as Parameters<typeof horizonHistorySettingsGroup>[0];
        const events = {} as Parameters<typeof horizonHistorySettingsGroup>[1];
        const group = horizonHistorySettingsGroup(plugin, events) as SettingDefinitionGroup;
        return (group.items ?? [])
            .filter((item) => {
                const visible = 'visible' in item ? item.visible : undefined;
                return typeof visible === 'function' ? visible() : visible !== false;
            })
            .map((item) => ('name' in item ? item.name : ''));
    }

    it('shows the lateness settings with lateness badges', () => {
        expect(shownSettings()).toEqual([
            'Horizon placeholder',
            'Badges show',
            'Tasks to track',
            'Yellow badge from',
            'Orange badge from',
            'Red badge from',
        ]);
    });

    it('shows the age settings with age badges', () => {
        updateSettings({ t7: { horizonHistory: { ...horizonHistorySettings(), badges: 'age' } } });
        expect(shownSettings()).toEqual([
            'Horizon placeholder',
            'Badges show',
            'Age badge from',
            'Yellow age from',
            'Orange age from',
            'Red age from',
        ]);
    });
});
