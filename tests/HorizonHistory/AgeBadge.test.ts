import moment from 'moment';
import { Menu, MenuItem } from 'obsidian';
import { resetSettings, updateSettings } from '../../src/Config/Settings';
import { addAgeBadge, ageLevel, ageText, taskAge } from '../../src/HorizonHistory/AgeBadge';
import { HorizonHistory } from '../../src/HorizonHistory/HorizonHistory';
import { type LateDays, horizonHistorySettings } from '../../src/HorizonHistory/HorizonHistorySettings';
import { saveHorizonPlaceholderShown } from '../../src/HorizonHistory/HorizonPlaceholderSetting';
import { addDays, todayAsDay } from '../../src/HorizonHistory/HorizonPeriod';
import { QueryLayoutOptions } from '../../src/Layout/QueryLayoutOptions';
import { TaskLayoutOptions } from '../../src/Layout/TaskLayoutOptions';
import { TaskLineRenderer } from '../../src/Renderer/TaskLineRenderer';
import type { Task } from '../../src/Task/Task';
import { HorizonMenu } from '../../src/ui/Menus/HorizonMenu';
import { mockHTMLRenderer } from '../Renderer/RenderingTestHelpers';
import { mockApp } from '../__mocks__/obsidian';
import { entryForTask, loadedFrom, taskAt } from './HorizonHistoryTestHelpers';

window.moment = moment;

const today = todayAsDay();

// The mock MenuItem has no setIsLabel(), which the horizon menu's history lines use.
beforeEach(() => {
    HorizonHistory.resetInstance();
    Object.assign(MenuItem.prototype, {
        setIsLabel(this: MenuItem) {
            return this;
        },
    });
});

afterEach(() => {
    // @ts-expect-error TS2790: The operand of a 'delete' operator must be optional.
    delete MenuItem.prototype.setIsLabel;
    resetSettings();
});

afterAll(() => {
    HorizonHistory.resetInstance();
});

function track(task: Task, fields: Parameters<typeof entryForTask>[1]) {
    HorizonHistory.getInstance().load(loadedFrom([entryForTask(task, fields)]), today);
}

function useAgeBadges() {
    updateSettings({ t7: { horizonHistory: { ...horizonHistorySettings(), badges: 'age' } } });
}

describe('age badge text and level', () => {
    const ageDays: LateDays = { low: 30, medium: 90, high: 365 };

    it.each([
        [14, 'none'],
        [29, 'none'],
        [30, 'low'],
        [89, 'low'],
        [90, 'medium'],
        [364, 'medium'],
        [365, 'high'],
    ])('a task %i days old has level %s', (days, expected) => {
        expect(ageLevel(days, ageDays)).toEqual(expected);
    });

    it.each([
        [1, '1d old'],
        [13, '13d old'],
        [14, '2w old'],
        [59, '8w old'],
        [60, '2mo old'],
        [729, '24mo old'],
        [730, '2y old'],
        [1100, '3y old'],
    ])('a task %i days old says %s', (days, expected) => {
        expect(ageText(days)).toEqual(expected);
    });
});

describe('task age', () => {
    it('counts from the created date', () => {
        const task = taskAt(`- [ ] Buy milk ➕ ${addDays(today, -20)}`, 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, since: addDays(today, -5) });
        expect(taskAge(task, today)).toEqual(20);
    });

    it('counts from the start of tracking without a created date', () => {
        const task = taskAt('- [ ] Buy milk', 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, since: addDays(today, -5) });
        expect(taskAge(task, today)).toEqual(5);
    });

    it('counts from the created date of a task that is not tracked', () => {
        HorizonHistory.getInstance().load(loadedFrom(), today);
        expect(taskAge(taskAt(`- [ ] Buy milk ➕ ${addDays(today, -20)}`, 'a.md', 3), today)).toEqual(20);
    });

    it('is unknown for a task that is not tracked and has no created date', () => {
        HorizonHistory.getInstance().load(loadedFrom(), today);
        expect(taskAge(taskAt('- [ ] Buy milk', 'a.md', 3), today)).toBeNull();
    });

    it.each([
        ['done', `- [x] Buy milk ➕ 2026-01-01 ✅ ${today}`, 'done'],
        ['cancelled', `- [-] Buy milk ➕ 2026-01-01 ❌ ${today}`, 'cancelled'],
        ['dropped', '- [ ] Buy milk', 'dropped'],
    ] as const)('is unknown for a %s task', (_, line, status) => {
        const task = taskAt(line, 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, status, closed: today, closedOn: today });
        expect(taskAge(task, today)).toBeNull();
    });

    it('is unknown for a done task that is not tracked', () => {
        HorizonHistory.getInstance().load(loadedFrom(), today);
        expect(taskAge(taskAt(`- [x] Buy milk ➕ 2026-01-01 ✅ ${today}`, 'a.md', 3), today)).toBeNull();
    });

    it('is 0 for a created date in the future', () => {
        HorizonHistory.getInstance().load(loadedFrom(), today);
        expect(taskAge(taskAt(`- [ ] Buy milk ➕ ${addDays(today, 3)}`, 'a.md', 3), today)).toEqual(0);
    });
});

describe('addAgeBadge', () => {
    it('adds nothing to a task younger than the age badge setting', () => {
        const task = taskAt('- [ ] Buy milk', 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, since: addDays(today, -13) });
        const li = document.createElement('li');
        const textSpan = li.createSpan();
        expect(addAgeBadge(li, textSpan, task, horizonHistorySettings(), today)).toBeNull();
        expect(li.outerHTML).toEqual('<li><span></span></li>');
    });

    it.each([
        [1, 1, 'none'],
        [14, 14, 'none'],
        [30, 60, 'low'],
    ])('with badges from %i days, a task %i days old gets level %s', (ageBadgeFrom, days, level) => {
        const task = taskAt('- [ ] Buy milk', 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, since: addDays(today, -days) });
        const settings = { ...horizonHistorySettings(), ageBadgeFrom };
        const li = document.createElement('li');
        const badge = addAgeBadge(li, li.createSpan(), task, settings, today);
        expect(badge?.getAttribute('data-task-age')).toEqual(level);
        expect(li.getAttribute('data-task-age')).toEqual(level);
    });
});

describe('rendered tasks with age badges', () => {
    const showAtPosition = vi.fn();

    beforeEach(() => {
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

    it('shows an age badge right after the description of a task without a horizon', async () => {
        useAgeBadges();
        const task = taskAt('- [ ] Buy milk 📅 2026-12-01', 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, since: addDays(today, -100) });

        const li = await renderTask(task);

        const badge = li.querySelector('.task-age') as HTMLElement;
        expect(badge.textContent).toEqual('3mo old');
        expect(badge.getAttribute('data-task-age')).toEqual('medium');
        expect(badge.getAttribute('aria-label')).toMatch(/^tracked since /);
        expect(badge.previousElementSibling?.classList).toContain('task-description');
        expect(li.getAttribute('data-task-age')).toEqual('medium');
    });

    it('shows an age badge instead of a lateness badge for a late task with a horizon', async () => {
        useAgeBadges();
        const task = taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3);
        track(task, { planned: addDays(today, -40), since: addDays(today, -40) });

        const li = await renderTask(task);

        expect(li.querySelector('.task-horizon-late')).toBeNull();
        expect(li.hasAttribute('data-task-lateness')).toEqual(false);
        const badge = li.querySelector('.task-age') as HTMLElement;
        expect(badge.textContent).toEqual('5w old');
        expect(badge.getAttribute('aria-label')).toMatch(
            /^Planned for .* · 40 days late · never pushed · tracked since /,
        );
    });

    it('shows the age of a task that is not tracked from its created date', async () => {
        useAgeBadges();
        HorizonHistory.getInstance().load(loadedFrom(), today);
        const li = await renderTask(taskAt('- [ ] Buy milk ➕ 2026-03-02', 'a.md', 3));
        expect(li.querySelector('.task-age')?.getAttribute('aria-label')).toMatch(/^created Mon 2 Mar( 2026)?$/);
    });

    it('shows the badge with the horizon placeholder turned off', async () => {
        useAgeBadges();
        await saveHorizonPlaceholderShown({ saveSettings: async () => {} }, false);
        const task = taskAt('- [ ] Buy milk', 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, since: addDays(today, -20) });

        const li = await renderTask(task);

        expect(li.classList).toContain('task-horizon-placeholder-off');
        expect(li.querySelector('.task-age')?.textContent).toEqual('2w old');
    });

    it('opens the horizon menu from the badge, and only once', async () => {
        useAgeBadges();
        const task = taskAt('- [ ] Buy milk', 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, since: addDays(today, -20) });

        const badge = (await renderTask(task)).querySelector('.task-age') as HTMLElement;
        badge.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(showAtPosition).toHaveBeenCalledTimes(1);
        expect(showAtPosition.mock.contexts[0]).toBeInstanceOf(HorizonMenu);
    });

    it('shows no age badge with lateness badges', async () => {
        const task = taskAt('- [ ] Buy milk', 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, since: addDays(today, -100) });
        const li = await renderTask(task);
        expect(li.querySelector('.task-age')).toBeNull();
        expect(li.hasAttribute('data-task-age')).toEqual(false);
    });
});
