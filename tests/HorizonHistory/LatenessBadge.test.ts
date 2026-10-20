import moment from 'moment';
import { Menu, MenuItem } from 'obsidian';
import { resetSettings, updateSettings } from '../../src/Config/Settings';
import { HorizonHistory } from '../../src/HorizonHistory/HorizonHistory';
import { horizonHistorySettings } from '../../src/HorizonHistory/HorizonHistorySettings';
import { addDays, todayAsDay } from '../../src/HorizonHistory/HorizonPeriod';
import type { HistoryRecord } from '../../src/HorizonHistory/HistoryRecord';
import { historyDetails, latenessLevel, latenessText } from '../../src/HorizonHistory/LatenessBadge';
import { QueryLayoutOptions } from '../../src/Layout/QueryLayoutOptions';
import { TaskLayoutOptions } from '../../src/Layout/TaskLayoutOptions';
import { TaskLineRenderer } from '../../src/Renderer/TaskLineRenderer';
import type { Task } from '../../src/Task/Task';
import { HorizonMenu } from '../../src/ui/Menus/HorizonMenu';
import { mockHTMLRenderer } from '../Renderer/RenderingTestHelpers';
import { menuToString } from '../ui/Menus/MenuTestingHelpers';
import { mockApp } from '../__mocks__/obsidian';
import { entryForTask, loadedFrom, taskAt } from './HorizonHistoryTestHelpers';

window.moment = moment;

const today = todayAsDay();

// The mock MenuItem has no setIsLabel(), so add one that records the label items.
const setIsLabel = vi.fn(function (this: MenuItem) {
    return this;
});

beforeEach(() => {
    HorizonHistory.resetInstance();
    Object.assign(MenuItem.prototype, { setIsLabel });
    setIsLabel.mockClear();
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

describe('badge text and level', () => {
    const lateDays = { low: 7, medium: 30, high: 90 };

    it.each([
        [1, '1d late', null],
        [6, '6d late', null],
        [7, '7d late', 'low'],
        [13, '13d late', 'low'],
        [14, '2w late', 'low'],
        [29, '4w late', 'low'],
        [30, '4w late', 'medium'],
        [59, '8w late', 'medium'],
        [60, '2mo late', 'medium'],
        [90, '3mo late', 'high'],
        [400, '13mo late', 'high'],
    ])('%d days late shows %j at level %s', (days, text, level) => {
        expect(latenessText(days)).toEqual(text);
        expect(latenessLevel(days, lateDays)).toEqual(level);
    });
});

describe('details', () => {
    function record(fields: Partial<HistoryRecord>): HistoryRecord {
        return {
            id: 'abc',
            path: 'notes.md',
            line: 3,
            text: '- [ ] Call Bob 🔭 today',
            horizon: 'today',
            status: 'open',
            planned: '2026-10-12',
            pushes: 3,
            since: '2026-10-02',
            ...fields,
        };
    }

    it.each<[string, Partial<HistoryRecord>, string | null, string[]]>([
        [
            'an open late task',
            {},
            null,
            ['Planned for Mon 12 Oct · 5 days late', 'pushed 3 times · tracked since Fri 2 Oct'],
        ],
        [
            'an open task on time',
            { planned: '2026-10-18', pushes: 0 },
            null,
            ['Planned for Sun 18 Oct', 'never pushed · tracked since Fri 2 Oct'],
        ],
        [
            'a task 1 day late, pushed once',
            { planned: '2026-10-16', pushes: 1 },
            null,
            ['Planned for Fri 16 Oct · 1 day late', 'pushed once · tracked since Fri 2 Oct'],
        ],
        [
            'a task done late',
            { status: 'done', closed: '2026-10-14' },
            null,
            ['Planned for Mon 12 Oct · finished 2 days late', 'pushed 3 times · tracked since Fri 2 Oct'],
        ],
        [
            'a task cancelled on time',
            { status: 'cancelled', closed: '2026-10-11' },
            null,
            ['Planned for Mon 12 Oct · finished on time', 'pushed 3 times · tracked since Fri 2 Oct'],
        ],
        [
            'a task from another year',
            { since: '2025-12-30' },
            null,
            ['Planned for Mon 12 Oct · 5 days late', 'pushed 3 times · tracked since Tue 30 Dec 2025'],
        ],
        [
            'a task with a created date',
            {},
            '2026-03-02',
            ['Planned for Mon 12 Oct · 5 days late', 'pushed 3 times · created Mon 2 Mar'],
        ],
        [
            'a task without a horizon',
            { horizon: 'none', planned: undefined, pushes: 0 },
            null,
            ['tracked since Fri 2 Oct'],
        ],
        [
            'a created task without a horizon',
            { horizon: 'none', planned: undefined, pushes: 0 },
            '2026-03-02',
            ['created Mon 2 Mar'],
        ],
    ])('describes %s', (_, fields, createdDay, expected) => {
        expect(historyDetails(record(fields), '2026-10-17', createdDay).map((parts) => parts.join(' · '))).toEqual(
            expected,
        );
    });
});

describe('rendered tasks', () => {
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

    it('shows a badge after the horizon of a task late enough for one', async () => {
        const task = taskAt('- [ ] Call Bob 🔭 today and more', 'a.md', 3);
        track(task, { planned: addDays(today, -10), pushes: 2 });

        const li = await renderTask(task);

        const badge = li.querySelector('.task-horizon-late') as HTMLElement;
        expect(badge.outerHTML).toMatch(
            /^<span class="task-horizon-late" data-task-lateness="low" aria-label="Planned for .* · 10 days late · pushed 2 times · tracked since .*">10d late<\/span>$/,
        );
        expect(badge.previousElementSibling?.classList.contains('task-horizon')).toEqual(true);
        expect(badge.parentElement?.textContent).toEqual('Call Bob 🔭 today10d late and more');
        expect(li.getAttribute('data-task-lateness')).toEqual('low');
    });

    it.each([
        [40, 'medium', '5w late'],
        [100, 'high', '3mo late'],
    ])('shows a task %d days late at level %s', async (days, level, text) => {
        const task = taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3);
        track(task, { planned: addDays(today, -days) });
        const badge = (await renderTask(task)).querySelector('.task-horizon-late') as HTMLElement;
        expect(badge.getAttribute('data-task-lateness')).toEqual(level);
        expect(badge.textContent).toEqual(text);
    });

    it('follows the days-late settings', async () => {
        updateSettings({ t7: { horizonHistory: { track: 'horizon', lateDays: { low: 1, medium: 2, high: 3 } } } });
        const task = taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3);
        track(task, { planned: addDays(today, -2) });
        const badge = (await renderTask(task)).querySelector('.task-horizon-late') as HTMLElement;
        expect(badge.getAttribute('data-task-lateness')).toEqual('medium');
        expect(badge.textContent).toEqual('2d late');
    });

    it('shows the badge with the horizon placeholder turned off', async () => {
        updateSettings({ t7: { horizonHistory: horizonHistorySettings(), horizon: { placeholder: false } } });
        const task = taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3);
        track(task, { planned: addDays(today, -10) });

        const badge = (await renderTask(task)).querySelector('.task-horizon-late') as HTMLElement;

        expect(badge.textContent).toEqual('10d late');
    });

    it('opens the horizon menu from the badge', async () => {
        const task = taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3);
        track(task, { planned: addDays(today, -30) });
        const li = await renderTask(task);

        const badge = li.querySelector('.task-horizon-late') as HTMLElement;
        badge.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

        expect(showAtPosition).toHaveBeenCalledTimes(1);
        expect(showAtPosition.mock.contexts[0]).toBeInstanceOf(HorizonMenu);
    });

    it.each([
        ['a task late by fewer days than the yellow badge needs', '- [ ] Call Bob 🔭 today', -6],
        ['a task on time', '- [ ] Call Bob 🔭 today', 0],
        ['a task planned later', '- [ ] Call Bob 🔭 next week', 3],
    ])('shows no badge for %s', async (_, line, plannedInDays) => {
        const task = taskAt(line, 'a.md', 3);
        track(task, { planned: addDays(today, plannedInDays) });
        const li = await renderTask(task);
        expect(li.querySelector('.task-horizon-late')).toBeNull();
        expect(li.hasAttribute('data-task-lateness')).toEqual(false);
    });

    it('shows no badge for a task that is not tracked', async () => {
        track(taskAt('- [ ] Buy milk 🔭 today', 'a.md', 3), { planned: addDays(today, -50) });
        const li = await renderTask(taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3));
        expect(li.querySelector('.task-horizon-late')).toBeNull();
    });

    it('shows how late a done task was finished', async () => {
        const task = taskAt('- [x] Call Bob 🔭 today ✅ 2026-10-14', 'a.md', 3);
        track(task, { planned: '2026-10-02', status: 'done', closed: '2026-10-14', closedOn: today });
        const li = await renderTask(task);
        expect(li.querySelector('.task-horizon-late')?.textContent).toEqual('12d late');
    });
});

/**
 * The lines of a horizon menu, without the nail items at its end (fork-features/nails.md).
 */
function linesBeforeNailItems(menu: HorizonMenu): string[] {
    const lines = menuToString(menu).split('\n');
    expect(lines.slice(-2)).toEqual(['  ---', '  Add nail']);
    return lines.slice(0, -2);
}

describe('horizon menu', () => {
    it('ends with the history of a tracked open task, and Reset lateness', () => {
        const task = taskAt('- [ ] Call Bob 🔭 this week', 'a.md', 3);
        track(task, { planned: addDays(today, -5), pushes: 3, since: addDays(today, -5) });
        const listener = vi.fn();
        HorizonHistory.getInstance().setChangeListener(listener);

        const menu = new HorizonMenu(task);

        const lines = linesBeforeNailItems(menu);
        expect(lines.slice(-5)).toEqual([
            '  No horizon',
            '  ---',
            expect.stringMatching(/^ {2}Planned for .* · 5 days late$/),
            expect.stringMatching(/^ {2}Pushed 3 times · tracked since /),
            '  Reset lateness',
        ]);
        expect(setIsLabel).toHaveBeenCalledTimes(2);

        // @ts-expect-error TS2339: Property 'items' does not exist on type 'HorizonMenu'.
        const resetItem = menu.items[menu.items.length - 3];
        resetItem.callback();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(HorizonHistory.getInstance().daysLate(task)).toEqual(0);
    });

    it('offers no Reset lateness for a done task', () => {
        const task = taskAt('- [x] Call Bob 🔭 today ✅ 2026-10-14', 'a.md', 3);
        track(task, { planned: '2026-10-12', status: 'done', closed: '2026-10-14', closedOn: today });

        const lines = linesBeforeNailItems(new HorizonMenu(task));
        expect(lines[lines.length - 1]).toMatch(/^ {2}Never pushed · tracked since Mon 12 Oct( 2026)?$/);
        expect(lines).not.toContain('  Reset lateness');
    });

    it('shows when a task without a horizon was created', () => {
        const task = taskAt('- [ ] Buy milk ➕ 2026-03-02', 'a.md', 3);
        track(task, { horizon: 'none', planned: undefined, since: today });

        const lines = linesBeforeNailItems(new HorizonMenu(task));
        expect(lines.slice(-3)).toEqual([
            'x No horizon',
            '  ---',
            expect.stringMatching(/^ {2}Created Mon 2 Mar( 2026)?$/),
        ]);
    });

    it('adds nothing for a task that is not tracked', () => {
        HorizonHistory.getInstance().load(loadedFrom(), today);
        const lines = linesBeforeNailItems(new HorizonMenu(taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3)));
        expect(lines[lines.length - 1]).toEqual('  No horizon');
        expect(setIsLabel).not.toHaveBeenCalled();
    });
});
