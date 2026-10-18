import moment from 'moment';
import { parseDay } from '../../src/HorizonHistory/HistoryFiles';
import { HorizonHistory, type PendingSave, observedTasks } from '../../src/HorizonHistory/HorizonHistory';
import type { Task } from '../../src/Task/Task';
import { loadedFrom, taskAt } from './HorizonHistoryTestHelpers';

window.moment = moment;

let history: HorizonHistory;

beforeEach(() => {
    HorizonHistory.resetInstance();
    history = HorizonHistory.getInstance();
});

afterAll(() => {
    HorizonHistory.resetInstance();
});

describe('before loading', () => {
    it('changes nothing and tracks nothing', () => {
        const task = taskAt('- [ ] Call Bob 🔭 today');
        history.observe([task], '2026-10-12');
        expect(history.isLoaded()).toEqual(false);
        expect(history.getEntries()).toEqual([]);
        expect(history.entryFor(task)).toBeNull();
        expect(history.pendingSave('2026-10-12')).toBeNull();
    });
});

describe('finding a task', () => {
    beforeEach(() => {
        history.load(loadedFrom(), '2026-10-12');
    });

    it('finds a task by file and text, whatever its horizon and checkbox', () => {
        history.observe([taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3)], '2026-10-12');
        const id = history.getEntries()[0].id;
        expect(history.entryFor(taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3))?.id).toEqual(id);
        expect(history.entryFor(taskAt('- [x] Call Bob 🔭 next week ✅ 2026-10-13', 'a.md', 7))?.id).toEqual(id);
        expect(history.entryFor(taskAt('- [ ] Call Bob', 'a.md', 3))?.id).toEqual(id);
        expect(history.entryFor(taskAt('- [ ] Call Bob 🔭 today', 'b.md', 3))).toBeNull();
        expect(history.entryFor(taskAt('- [ ] Call Bob 🔭 today', '', 3))).toBeNull();
    });

    it('prefers the same line, then the nearest line', () => {
        history.observe(
            [
                taskAt('- [ ] Water plants 🔭 today', 'a.md', 2),
                taskAt('- [x] Water plants 🔭 today ✅ 2026-10-10', 'a.md', 3),
                taskAt('- [ ] Water plants 🔭 tomorrow', 'a.md', 8),
            ],
            '2026-10-12',
        );
        // Only the open ones are tracked; the done one was done before tracking started.
        const [first, second] = history.getEntries();
        expect(history.entryFor(taskAt('- [ ] Water plants 🔭 tomorrow', 'a.md', 8))).toBe(second);
        expect(history.entryFor(taskAt('- [ ] Water plants 🔭 today', 'a.md', 2))).toBe(first);
        expect(history.entryFor(taskAt('- [ ] Water plants 🔭 next week', 'a.md', 6))).toBe(second);
    });

    it('does not find a dropped task', () => {
        const task = taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3);
        history.observe([task], '2026-10-12');
        history.observe([], '2026-10-12');
        expect(history.getEntries()[0].status).toEqual('dropped');
        expect(history.entryFor(task)).toBeNull();
    });

    it('gives the planned date and days late', () => {
        const task = taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3);
        history.observe([task], '2026-10-12');
        expect(history.plannedDate(task)?.format('YYYY-MM-DD')).toEqual('2026-10-12');
        expect(history.daysLate(task, '2026-10-17')).toEqual(5);
        const untracked = taskAt('- [ ] Buy milk', 'a.md', 4);
        expect(history.plannedDate(untracked)).toBeNull();
        expect(history.daysLate(untracked, '2026-10-17')).toBeNull();
    });

    it('gives the opened date: the created date, else the start of tracking', () => {
        const created = taskAt('- [ ] Call Bob 🔭 today ➕ 2026-03-02', 'a.md', 3);
        const notCreated = taskAt('- [ ] Buy milk 🔭 today', 'a.md', 4);
        history.observe([created, notCreated], '2026-10-12');
        expect(history.openedDate(created)?.format('YYYY-MM-DD')).toEqual('2026-03-02');
        expect(history.openedDate(notCreated)?.format('YYYY-MM-DD')).toEqual('2026-10-12');
        expect(history.openedDate(taskAt('- [ ] Fix shelf', 'a.md', 5))).toBeNull();
        expect(history.openedDate(taskAt('- [ ] Fix shelf ➕ 2026-01-05', 'a.md', 5))?.format('YYYY-MM-DD')).toEqual(
            '2026-01-05',
        );
    });
});

describe('tracking all open tasks', () => {
    const buyMilk = (horizon: string) => taskAt(`- [ ] Buy milk${horizon}`, 'a.md', 3);

    beforeEach(() => {
        history.load(loadedFrom(), '2026-10-12');
    });

    it('tracks tasks without a horizon, without a planned date', () => {
        history.observe([buyMilk(''), taskAt('- [x] Done before ✅ 2026-10-01', 'a.md', 4)], '2026-10-12', 'open');
        expect(history.getEntries()).toEqual([
            expect.objectContaining({ horizon: 'none', status: 'open', pushes: 0, since: '2026-10-12' }),
        ]);
        expect(history.getEntries()[0].planned).toBeUndefined();
        expect(history.daysLate(buyMilk(''), '2026-10-17')).toBeNull();
    });

    it('plans a task when it gets a horizon, and ends the plan when the horizon goes', () => {
        history.observe([buyMilk('')], '2026-10-12', 'open');
        history.observe([buyMilk(' 🔭 today')], '2026-10-13', 'open');
        expect(history.getEntries()[0]).toMatchObject({ planned: '2026-10-13', since: '2026-10-12', pushes: 0 });
        history.observe([buyMilk(' 🔭 next week')], '2026-10-14', 'open');
        expect(history.getEntries()[0]).toMatchObject({ planned: '2026-10-13', pushes: 1 });

        history.observe([buyMilk('')], '2026-10-15', 'open');
        expect(history.getEntries()[0]).toMatchObject({
            horizon: 'none',
            status: 'open',
            pushes: 0,
            since: '2026-10-12',
        });
        expect(history.getEntries()[0].planned).toBeUndefined();
    });

    it('drops tasks without a horizon when switched back to tasks with a horizon', () => {
        history.observe([buyMilk(''), taskAt('- [ ] Call Bob 🔭 today', 'a.md', 5)], '2026-10-12', 'open');
        history.observe([buyMilk(''), taskAt('- [ ] Call Bob 🔭 today', 'a.md', 5)], '2026-10-13', 'horizon');
        expect(history.getEntries().map((entry) => [entry.key, entry.status])).toEqual([
            ['Call Bob', 'open'],
            ['Buy milk', 'dropped'],
        ]);
    });
});

describe('resetting lateness', () => {
    beforeEach(() => {
        history.load(loadedFrom(), '2026-10-12');
    });

    it('plans an open task afresh and tells the listener', () => {
        const listener = vi.fn();
        history.setChangeListener(listener);
        history.observe([taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3)], '2026-10-12');
        history.observe([taskAt('- [ ] Call Bob 🔭 this week', 'a.md', 3)], '2026-10-13');
        expect(history.getEntries()[0]).toMatchObject({ planned: '2026-10-12', pushes: 1 });

        history.resetLateness(taskAt('- [ ] Call Bob 🔭 this week', 'a.md', 3), '2026-10-14');

        expect(history.getEntries()[0]).toMatchObject({ planned: '2026-10-18', pushes: 0, since: '2026-10-12' });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('leaves a done task alone', () => {
        const listener = vi.fn();
        history.setChangeListener(listener);
        history.observe([taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3)], '2026-10-12');
        const done = taskAt('- [x] Call Bob 🔭 today ✅ 2026-10-14', 'a.md', 3);
        history.observe([done], '2026-10-14');

        history.resetLateness(done, '2026-10-15');

        expect(history.getEntries()[0]).toMatchObject({ planned: '2026-10-12', status: 'done' });
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('saving', () => {
    const callBob = taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3);
    const buyMilk = taskAt('- [ ] Buy milk 🔭 tomorrow', 'a.md', 4);

    /**
     * Observe {@link tasks} on {@link day}, and "write" the file if there is something to write.
     */
    function saveDay(day: string, ...tasks: Task[]): PendingSave | null {
        history.observe(tasks, day);
        const save = history.pendingSave(day);
        if (save !== null) {
            history.markSaved(save);
        }
        return save;
    }

    function ids(save: PendingSave | null) {
        return save === null ? null : [save.kind, parseDay(save.content).records.map((record) => record.text)];
    }

    beforeEach(() => {
        history.load(loadedFrom(), '2026-10-12');
    });

    it('writes nothing for an empty history', () => {
        expect(saveDay('2026-10-12')).toBeNull();
    });

    it('writes a full file first, and rewrites it only when something changed', () => {
        expect(ids(saveDay('2026-10-12', callBob))).toEqual(['full', [callBob.originalMarkdown]]);
        expect(saveDay('2026-10-12', callBob)).toBeNull();
        expect(ids(saveDay('2026-10-12', callBob, buyMilk))).toEqual([
            'full',
            [callBob.originalMarkdown, buyMilk.originalMarkdown],
        ]);
    });

    it('writes only the changes on the next days, and nothing without changes', () => {
        saveDay('2026-10-12', callBob, buyMilk);

        expect(saveDay('2026-10-13', callBob, buyMilk)).toBeNull();

        const callBobTomorrow = taskAt('- [ ] Call Bob 🔭 tomorrow', 'a.md', 3);
        expect(ids(saveDay('2026-10-14', callBobTomorrow, buyMilk))).toEqual([
            'changes',
            [callBobTomorrow.originalMarkdown],
        ]);
        // Changes add up during the day.
        const doneMilk = taskAt('- [x] Buy milk 🔭 tomorrow ✅ 2026-10-14', 'a.md', 4);
        expect(ids(saveDay('2026-10-14', callBobTomorrow, doneMilk))).toEqual([
            'changes',
            [callBobTomorrow.originalMarkdown, doneMilk.originalMarkdown],
        ]);
        expect(saveDay('2026-10-15', callBobTomorrow, doneMilk)).toBeNull();
    });

    it('ignores tasks that only moved to another line', () => {
        saveDay('2026-10-12', callBob);
        expect(saveDay('2026-10-13', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 9))).toBeNull();
    });

    it('measures changes against the state at the start of the day', () => {
        saveDay('2026-10-12', callBob);
        const callBobTomorrow = taskAt('- [ ] Call Bob 🔭 tomorrow', 'a.md', 3);
        expect(ids(saveDay('2026-10-13', callBobTomorrow))).toEqual(['changes', [callBobTomorrow.originalMarkdown]]);
        // Back to today: the planned date and pushes stay as they were after the push, so it is still a change.
        expect(ids(saveDay('2026-10-13', callBob))).toEqual(['changes', [callBob.originalMarkdown]]);
    });

    it('writes a full file again a week after the last one', () => {
        saveDay('2026-10-12', callBob);
        const edited = taskAt('- [ ] Call Bob again 🔭 today', 'a.md', 3);
        expect(ids(saveDay('2026-10-18', edited, buyMilk))?.[0]).toEqual('changes');
        // The full file holds the open tasks and the ones dropped that day.
        expect(ids(saveDay('2026-10-19', edited))).toEqual([
            'full',
            [edited.originalMarkdown, buyMilk.originalMarkdown],
        ]);
    });

    it('knows that a file loaded for today is up to date', () => {
        saveDay('2026-10-12', callBob);
        const callBobTomorrow = taskAt('- [ ] Call Bob 🔭 tomorrow', 'a.md', 3);
        saveDay('2026-10-13', callBobTomorrow);
        const before = history.getEntries();

        HorizonHistory.resetInstance();
        const reloaded = HorizonHistory.getInstance();
        reloaded.load(
            { entries: [...before], entriesBeforeToday: [], latestFullDay: '2026-10-12', hasTodayFile: true },
            '2026-10-13',
        );
        reloaded.observe([callBobTomorrow], '2026-10-13');
        const save = reloaded.pendingSave('2026-10-13');
        // The baseline here is empty, so everything is a change; what matters is that the same content is not rewritten.
        expect(save).toBeNull();
    });
});

describe('observedTasks', () => {
    const tasks = [
        taskAt('- [ ] No horizon', 'a.md', 1),
        taskAt('- [ ] Call Bob 🔭 today 🔁 every day', 'a.md', 2),
        taskAt('- [x] Buy milk 🔭 tomorow ✅ 2026-10-13', 'b.md', 3),
        taskAt('- [-] Fix shelf 🔭 next week ❌ 2026-10-14', 'b.md', 4),
        taskAt('- [-] Paint wall 🔭 next week', 'b.md', 5),
    ];

    it('describes the tasks with a horizon', () => {
        expect(observedTasks(tasks)).toEqual([
            {
                path: 'a.md',
                line: 2,
                text: '- [ ] Call Bob 🔭 today 🔁 every day',
                key: 'Call Bob 🔁 every day',
                horizon: 'today',
                status: 'open',
                closedDate: null,
                recurring: true,
            },
            {
                path: 'b.md',
                line: 3,
                text: '- [x] Buy milk 🔭 tomorow ✅ 2026-10-13',
                key: 'Buy milk tomorow',
                horizon: 'invalid',
                status: 'done',
                closedDate: '2026-10-13',
                recurring: false,
            },
            {
                path: 'b.md',
                line: 4,
                text: '- [-] Fix shelf 🔭 next week ❌ 2026-10-14',
                key: 'Fix shelf',
                horizon: 'next week',
                status: 'cancelled',
                closedDate: '2026-10-14',
                recurring: false,
            },
            {
                path: 'b.md',
                line: 5,
                text: '- [-] Paint wall 🔭 next week',
                key: 'Paint wall',
                horizon: 'next week',
                status: 'cancelled',
                closedDate: null,
                recurring: false,
            },
        ]);
    });

    it('describes every task when tracking all open tasks', () => {
        expect(observedTasks(tasks, 'open').map((task) => [task.key, task.horizon])).toEqual([
            ['No horizon', 'none'],
            ['Call Bob 🔁 every day', 'today'],
            ['Buy milk tomorow', 'invalid'],
            ['Fix shelf', 'next week'],
            ['Paint wall', 'next week'],
        ]);
    });
});

describe('tracking only included tasks, such as those matching the global query', () => {
    const inTodo = (line: string) => taskAt(line, 'TODO/work.md', 1);
    const isIncluded = (task: Task) => task.path.startsWith('TODO/') && !task.description.includes('#hide');

    beforeEach(() => {
        history.load(loadedFrom(), '2026-10-12');
    });

    it('does not track open tasks that are not included', () => {
        history.observe(
            [inTodo('- [ ] Call Bob 🔭 today'), taskAt('- [ ] Buy milk 🔭 today', 'Journal.md', 2)],
            '2026-10-12',
            'horizon',
            isIncluded,
        );
        expect(history.getEntries().map((entry) => entry.key)).toEqual(['Call Bob']);
    });

    it('drops a tracked task that is no longer included', () => {
        history.observe([inTodo('- [ ] Call Bob 🔭 today')], '2026-10-12', 'horizon', isIncluded);
        history.observe([inTodo('- [ ] Call Bob #hide 🔭 today')], '2026-10-13', 'horizon', isIncluded);
        expect(history.getEntries()).toMatchObject([{ key: 'Call Bob', status: 'dropped' }]);
    });

    it('still sees the completion of a tracked task when done tasks are not included', () => {
        const notDone = (task: Task) => !task.isDone;
        history.observe([inTodo('- [ ] Call Bob 🔭 today')], '2026-10-12', 'horizon', notDone);
        history.observe([inTodo('- [x] Call Bob 🔭 today ✅ 2026-10-13')], '2026-10-13', 'horizon', notDone);
        expect(history.getEntries()).toMatchObject([{ key: 'Call Bob', status: 'done', closed: '2026-10-13' }]);
    });
});
