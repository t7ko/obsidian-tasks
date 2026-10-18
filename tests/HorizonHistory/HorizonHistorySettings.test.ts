import { resetSettings, updateSettings } from '../../src/Config/Settings';
import {
    horizonHistorySettings,
    normaliseHorizonHistorySettings,
    saveHorizonHistorySettings,
} from '../../src/HorizonHistory/HorizonHistorySettings';

afterEach(() => {
    resetSettings();
});

describe('horizon history settings', () => {
    it('has relaxed defaults', () => {
        expect(horizonHistorySettings()).toEqual({ track: 'horizon', lateDays: { low: 7, medium: 30, high: 90 } });
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
        expect(normaliseHorizonHistorySettings(value)).toEqual(expected);
    });

    it('saves a change and keeps the rest', async () => {
        const plugin = { saveSettings: vi.fn(async () => {}) };
        await saveHorizonHistorySettings(plugin, { track: 'open' });
        await saveHorizonHistorySettings(plugin, { lateDays: { low: 2, medium: 14, high: 60 } });
        expect(horizonHistorySettings()).toEqual({ track: 'open', lateDays: { low: 2, medium: 14, high: 60 } });
        expect(plugin.saveSettings).toHaveBeenCalledTimes(2);
    });

    it('reads settings saved without the fork', () => {
        updateSettings({ t7: undefined });
        expect(horizonHistorySettings().track).toEqual('horizon');
    });
});
