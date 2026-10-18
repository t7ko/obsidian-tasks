import moment from 'moment';
import { Menu } from 'obsidian';
import { getSettings, resetSettings, updateSettings } from '../../src/Config/Settings';
import { HorizonHistory } from '../../src/HorizonHistory/HorizonHistory';
import { horizonHistorySettings, saveHorizonHistorySettings } from '../../src/HorizonHistory/HorizonHistorySettings';
import {
    horizonPlaceholderShown,
    saveHorizonPlaceholderShown,
} from '../../src/HorizonHistory/HorizonPlaceholderSetting';
import { QueryLayoutOptions } from '../../src/Layout/QueryLayoutOptions';
import { TaskLayoutOptions } from '../../src/Layout/TaskLayoutOptions';
import { TaskLineRenderer } from '../../src/Renderer/TaskLineRenderer';
import type { Task } from '../../src/Task/Task';
import { mockHTMLRenderer } from '../Renderer/RenderingTestHelpers';
import { mockApp } from '../__mocks__/obsidian';
import { taskAt } from './HorizonHistoryTestHelpers';

window.moment = moment;

const plugin = { saveSettings: vi.fn(async () => {}) };

afterEach(() => {
    resetSettings();
});

describe('horizon placeholder setting', () => {
    it('shows the placeholder by default', () => {
        expect(horizonPlaceholderShown()).toEqual(true);
    });

    it('saves a change and keeps the other fork settings', async () => {
        await saveHorizonHistorySettings(plugin, { track: 'open' });

        await saveHorizonPlaceholderShown(plugin, false);

        expect(horizonPlaceholderShown()).toEqual(false);
        expect(horizonHistorySettings().track).toEqual('open');
        expect(getSettings().t7.horizon).toEqual({ placeholder: false });
    });

    it('keeps the placeholder setting when the history settings change', async () => {
        await saveHorizonPlaceholderShown(plugin, false);

        await saveHorizonHistorySettings(plugin, { track: 'open' });

        expect(horizonPlaceholderShown()).toEqual(false);
    });

    it.each([
        ['settings saved without the fork', undefined],
        ['settings saved before the setting existed', { horizonHistory: horizonHistorySettings() }],
        ['an invalid value', { horizonHistory: horizonHistorySettings(), horizon: { placeholder: 'no' } }],
    ])('shows the placeholder with %s', (_, t7) => {
        updateSettings({ t7: t7 as never });
        expect(horizonPlaceholderShown()).toEqual(true);
    });
});

describe('rendering with the placeholder turned off', () => {
    const showAtPosition = vi.fn();

    beforeEach(() => {
        HorizonHistory.resetInstance();
        Menu.prototype.showAtPosition = showAtPosition;
        showAtPosition.mockClear();
    });

    afterEach(() => {
        // @ts-expect-error TS2790: The operand of a 'delete' operator must be optional.
        delete Menu.prototype.showAtPosition;
    });

    async function renderTask(task: Task) {
        const taskLineRenderer = new TaskLineRenderer({
            textRenderer: mockHTMLRenderer,
            obsidianApp: mockApp,
            obsidianComponent: null,
            taskLayoutOptions: new TaskLayoutOptions(),
            queryLayoutOptions: new QueryLayoutOptions(),
        });
        const li = document.createElement('div').createEl('li');
        await taskLineRenderer.renderTaskLine({ li, task, taskIndex: 0, isTaskInQueryFile: true });
        return li;
    }

    function clickPlaceholder(li: HTMLElement) {
        // A click on the ::after placeholder targets the text span itself.
        const textSpan = li.querySelector('.tasks-list-text') as HTMLElement;
        textSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    it('marks a task without a horizon and opens no menu from it', async () => {
        await saveHorizonPlaceholderShown(plugin, false);

        const li = await renderTask(taskAt('- [ ] Buy milk', 'a.md', 3));
        clickPlaceholder(li);

        expect(li.classList.contains('task-horizon-placeholder-off')).toEqual(true);
        expect(showAtPosition).not.toHaveBeenCalled();
    });

    it('leaves a task with a horizon as with the placeholder on', async () => {
        const task = taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3);
        const shown = await renderTask(task);

        await saveHorizonPlaceholderShown(plugin, false);
        const hidden = await renderTask(task);

        expect(hidden.outerHTML).toEqual(shown.outerHTML);
        expect(hidden.classList.contains('task-horizon-placeholder-off')).toEqual(false);
    });

    it('leaves a task without a horizon as upstream renders it with the placeholder on', async () => {
        const li = await renderTask(taskAt('- [ ] Buy milk', 'a.md', 3));
        clickPlaceholder(li);

        expect(li.classList.contains('task-horizon-placeholder-off')).toEqual(false);
        expect(showAtPosition).toHaveBeenCalledTimes(1);
    });
});
