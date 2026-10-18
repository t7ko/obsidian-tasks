import moment from 'moment';
import { observedTasks } from '../../src/HorizonHistory/HorizonHistory';
import { addDays } from '../../src/HorizonHistory/HorizonPeriod';
import { forgetOldEntries, updateEntries } from '../../src/HorizonHistory/HistoryMatcher';
import { type HistoryEntry, daysLate } from '../../src/HorizonHistory/HistoryRecord';
import type { Task } from '../../src/Task/Task';
import { taskAt } from './HorizonHistoryTestHelpers';

window.moment = moment;

let idCount = 0;

beforeEach(() => {
    idCount = 0;
});

/**
 * The tracked tasks after the vault was found to hold {@link tasks} on {@link today}.
 */
function step(entries: HistoryEntry[], today: string, ...tasks: Task[]): HistoryEntry[] {
    return updateEntries(entries, observedTasks(tasks), today, () => `id${++idCount}`);
}

function byId(entries: HistoryEntry[], id: string): HistoryEntry {
    const entry = entries.find((e) => e.id === id);
    expect(entry).toBeDefined();
    return entry!;
}

describe('starting to track', () => {
    it('tracks an open task with a valid horizon, planned for the end of its period', () => {
        const entries = step([], '2026-10-17', taskAt('- [ ] Call Bob 🔭 this week', 'notes.md', 4));
        expect(entries).toEqual([
            {
                id: 'id1',
                path: 'notes.md',
                line: 4,
                text: '- [ ] Call Bob 🔭 this week',
                key: 'Call Bob',
                horizon: 'this week',
                status: 'open',
                planned: '2026-10-18',
                pushes: 0,
                since: '2026-10-17',
            },
        ]);
    });

    it.each([
        ['no horizon', '- [ ] Call Bob'],
        ['an invalid horizon', '- [ ] Call Bob 🔭 tomorow'],
        ['done', '- [x] Call Bob 🔭 today ✅ 2026-10-17'],
        ['cancelled', '- [-] Call Bob 🔭 today'],
    ])('does not start tracking a task with %s', (_, line) => {
        expect(step([], '2026-10-17', taskAt(line))).toEqual([]);
    });

    it('does not track a task without a known file', () => {
        expect(step([], '2026-10-17', taskAt('- [ ] Call Bob 🔭 today', ''))).toEqual([]);
    });

    it('treats an in-progress task as open', () => {
        expect(step([], '2026-10-17', taskAt('- [/] Call Bob 🔭 today'))).toHaveLength(1);
    });
});

describe('planned date and pushes', () => {
    const line = (horizon: string) => taskAt(`- [ ] Call Bob 🔭 ${horizon}`, 'notes.md', 3);

    it('keeps the planned date of an unchanged task', () => {
        let entries = step([], '2026-10-12', line('today'));
        entries = step(entries, '2026-10-15', line('today'));
        expect(entries).toMatchObject([{ id: 'id1', planned: '2026-10-12', pushes: 0, since: '2026-10-12' }]);
        expect(daysLate(entries[0], '2026-10-17')).toEqual(5);
    });

    it('moves the planned date earlier when the horizon is pulled in', () => {
        let entries = step([], '2026-10-12', line('this week'));
        entries = step(entries, '2026-10-14', line('today'));
        expect(entries).toMatchObject([{ id: 'id1', planned: '2026-10-14', pushes: 0 }]);
    });

    it('counts a push and keeps the planned date', () => {
        let entries = step([], '2026-10-12', line('today'));
        entries = step(entries, '2026-10-12', line('next week'));
        expect(entries).toMatchObject([{ id: 'id1', planned: '2026-10-12', pushes: 1, horizon: 'next week' }]);
    });

    it('does not count moving tomorrow to today on the next day as a push', () => {
        let entries = step([], '2026-10-12', line('tomorrow'));
        entries = step(entries, '2026-10-13', line('today'));
        expect(entries).toMatchObject([{ id: 'id1', planned: '2026-10-13', pushes: 0 }]);
    });

    it('changes neither the planned date nor pushes for an invalid horizon', () => {
        let entries = step([], '2026-10-12', line('today'));
        entries = step(entries, '2026-10-14', line('tomorow'));
        expect(entries).toMatchObject([{ id: 'id1', planned: '2026-10-12', pushes: 0, horizon: 'invalid' }]);
        entries = step(entries, '2026-10-15', line('next week'));
        expect(entries).toMatchObject([{ id: 'id1', planned: '2026-10-12', pushes: 0, horizon: 'next week' }]);
    });

    it('follows the example in the spec', () => {
        const supplier = (horizon: string) => taskAt(`- [ ] Call the supplier 🔭 ${horizon}`, 'Work.md', 12);
        let entries = step([], '2026-10-02', supplier('next month'));
        expect(entries[0].planned).toEqual('2026-11-30');
        entries = step(entries, '2026-10-12', supplier('today'));
        expect(entries[0].planned).toEqual('2026-10-12');
        for (const evening of ['2026-10-12', '2026-10-13', '2026-10-14']) {
            entries = step(entries, evening, supplier('tomorrow'));
            entries = step(entries, addDays(evening, 1), supplier('today'));
        }
        expect(entries).toMatchObject([{ id: 'id1', planned: '2026-10-12', pushes: 3, since: '2026-10-02' }]);
        expect(daysLate(entries[0], '2026-10-17')).toEqual(5);
    });
});

describe('recognising tasks', () => {
    it('keeps a task through finished steps and completion', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Write report 🔭 today 🪜 draft // review', 'a.md', 2));
        entries = step(entries, '2026-10-13', taskAt('- [ ] Write report 🔭 today 🪜 ~~draft~~ // review', 'a.md', 2));
        entries = step(
            entries,
            '2026-10-15',
            taskAt('- [x] Write report 🔭 today 🪜 ~~draft~~ // ~~review~~ ✅ 2026-10-14', 'a.md', 2),
        );
        expect(entries).toMatchObject([
            { id: 'id1', status: 'done', closed: '2026-10-14', closedOn: '2026-10-15', planned: '2026-10-12' },
        ]);
        expect(daysLate(entries[0], '2026-10-30')).toEqual(2);
    });

    it('takes the closing day as the done date of a task without one', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Call Bob 🔭 today'));
        entries = step(entries, '2026-10-13', taskAt('- [-] Call Bob 🔭 today'));
        expect(entries).toMatchObject([{ id: 'id1', status: 'cancelled', closed: '2026-10-13' }]);
    });

    it('keeps a task reworded in place', () => {
        let entries = step(
            [],
            '2026-10-12',
            taskAt('- [ ] Call Bob about the invoice 🔭 today 📅 2026-10-20', 'a.md', 3),
        );
        entries = step(
            entries,
            '2026-10-13',
            taskAt('- [ ] Phone Bob about the bill 🔭 today 📅 2026-10-21', 'a.md', 3),
        );
        expect(entries).toMatchObject([{ id: 'id1', text: '- [ ] Phone Bob about the bill 🔭 today 📅 2026-10-21' }]);
    });

    it('keeps a task edited while lines above it changed', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Call Bob about the invoice 🔭 today', 'a.md', 3));
        entries = step(entries, '2026-10-13', taskAt('- [ ] Call Bob about the new invoice 🔭 today', 'a.md', 5));
        expect(entries).toMatchObject([{ id: 'id1', line: 5, status: 'open' }]);
    });

    it('does not take an unrelated task for an edited one', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3));
        entries = step(entries, '2026-10-13', taskAt('- [ ] Buy milk 🔭 today', 'a.md', 7));
        expect(entries).toMatchObject([
            { id: 'id2', status: 'open', since: '2026-10-13' },
            { id: 'id1', status: 'dropped', closed: '2026-10-13', closedOn: '2026-10-13' },
        ]);
    });

    it('keeps a task moved to another file', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3));
        entries = step(entries, '2026-10-13', taskAt('- [ ] Call Bob 🔭 today', 'b.md', 9));
        expect(entries).toMatchObject([{ id: 'id1', path: 'b.md', line: 9, planned: '2026-10-12' }]);
    });

    it('links identical lines by the nearest line', () => {
        let entries = step(
            [],
            '2026-10-12',
            taskAt('- [ ] Water plants 🔭 today', 'a.md', 2),
            taskAt('- [ ] Water plants 🔭 today', 'a.md', 5),
        );
        entries = step(
            entries,
            '2026-10-13',
            taskAt('- [ ] Water plants 🔭 today', 'a.md', 6),
            taskAt('- [ ] Water plants 🔭 today', 'a.md', 3),
        );
        expect(byId(entries, 'id1').line).toEqual(3);
        expect(byId(entries, 'id2').line).toEqual(6);
    });

    it('brings back a task dropped the day before', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3));
        entries = step(entries, '2026-10-12');
        expect(entries).toMatchObject([{ id: 'id1', status: 'dropped' }]);
        entries = step(entries, '2026-10-13', taskAt('- [ ] Call Bob 🔭 today', 'b.md', 1));
        expect(entries).toEqual([expect.objectContaining({ id: 'id1', status: 'open', planned: '2026-10-12' })]);
        expect(entries[0].closed).toBeUndefined();
        expect(entries[0].closedOn).toBeUndefined();
    });

    it('starts afresh for a task added two days after one with the same text was dropped', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3));
        entries = step(entries, '2026-10-12');
        entries = step(entries, '2026-10-14', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 3));
        expect(entries).toMatchObject([{ id: 'id2', planned: '2026-10-14' }]);
    });

    it('reopens a done task unchecked in place', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 4));
        entries = step(entries, '2026-10-14', taskAt('- [x] Call Bob 🔭 today ✅ 2026-10-14', 'a.md', 4));
        entries = step(entries, '2026-10-15', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 4));
        expect(entries).toEqual([expect.objectContaining({ id: 'id1', status: 'open', planned: '2026-10-12' })]);
        expect(entries[0].closed).toBeUndefined();
    });

    it('starts afresh for a new task with the text of a done one', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 4));
        entries = step(entries, '2026-10-14', taskAt('- [x] Call Bob 🔭 today ✅ 2026-10-14', 'a.md', 4));
        entries = step(
            entries,
            '2026-10-15',
            taskAt('- [x] Call Bob 🔭 today ✅ 2026-10-14', 'a.md', 4),
            taskAt('- [ ] Call Bob 🔭 today', 'a.md', 8),
        );
        expect(entries).toMatchObject([
            { id: 'id1', status: 'done', line: 4 },
            { id: 'id2', status: 'open', line: 8, planned: '2026-10-15' },
        ]);
    });

    it('starts afresh for a new task with the text of a done one whose line was deleted', () => {
        let entries = step([], '2026-10-12', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 4));
        entries = step(entries, '2026-10-14', taskAt('- [x] Call Bob 🔭 today ✅ 2026-10-14', 'a.md', 4));
        entries = step(entries, '2026-10-15', taskAt('- [ ] Call Bob 🔭 today', 'a.md', 8));
        expect(entries).toMatchObject([
            { id: 'id2', status: 'open', line: 8 },
            { id: 'id1', status: 'done', line: 4 },
        ]);
    });

    it('keeps a completed recurring task on its done line, and starts afresh for the next occurrence', () => {
        let entries = step(
            [],
            '2026-10-12',
            taskAt('- [ ] Water plants 🔭 today 🔁 every day 📅 2026-10-17', 'a.md', 2),
        );
        entries = step(
            entries,
            '2026-10-17',
            taskAt('- [ ] Water plants 🔭 today 🔁 every day 📅 2026-10-18', 'a.md', 2),
            taskAt('- [x] Water plants 🔭 today 🔁 every day 📅 2026-10-17 ✅ 2026-10-17', 'a.md', 3),
        );
        expect(entries).toMatchObject([
            { id: 'id2', status: 'open', line: 2, planned: '2026-10-17', since: '2026-10-17' },
            { id: 'id1', status: 'done', line: 3, closed: '2026-10-17', planned: '2026-10-12' },
        ]);
    });

    it('drops a recurring task whose done line was deleted, and starts afresh for the next occurrence', () => {
        let entries = step(
            [],
            '2026-10-12',
            taskAt('- [ ] Water plants 🔭 today 🔁 every day 📅 2026-10-17', 'a.md', 2),
        );
        entries = step(
            entries,
            '2026-10-17',
            taskAt('- [ ] Water plants 🔭 today 🔁 every day 📅 2026-10-18', 'a.md', 2),
        );
        expect(entries).toMatchObject([
            { id: 'id2', status: 'open', planned: '2026-10-17' },
            { id: 'id1', status: 'dropped' },
        ]);
    });
});

describe('forgetting', () => {
    function closedEntry(status: HistoryEntry['status'], closedOn: string): HistoryEntry {
        return {
            id: `${status}-${closedOn}`,
            path: 'a.md',
            line: 1,
            text: '- [x] Call Bob 🔭 today',
            key: 'Call Bob',
            horizon: 'today',
            status,
            closed: closedOn,
            closedOn,
            planned: '2026-09-01',
            pushes: 0,
            since: '2026-09-01',
        };
    }

    it('forgets done and cancelled tasks 35 days after their closing was recorded', () => {
        const entries = [
            closedEntry('done', '2026-09-12'),
            closedEntry('done', '2026-09-11'),
            closedEntry('cancelled', '2026-09-12'),
            closedEntry('cancelled', '2026-09-11'),
        ];
        expect(forgetOldEntries(entries, '2026-10-17').map((entry) => entry.id)).toEqual([
            'done-2026-09-12',
            'cancelled-2026-09-12',
        ]);
    });

    it('forgets dropped tasks after the next day', () => {
        const entries = [closedEntry('dropped', '2026-10-16'), closedEntry('dropped', '2026-10-15')];
        expect(forgetOldEntries(entries, '2026-10-17').map((entry) => entry.id)).toEqual(['dropped-2026-10-16']);
    });

    it('forgets old closed tasks when updating', () => {
        const entries = step([closedEntry('done', '2026-09-01')], '2026-10-17');
        expect(entries).toEqual([]);
    });
});

describe('tracking all open tasks', () => {
    function stepAll(entries: HistoryEntry[], today: string, ...tasks: Task[]): HistoryEntry[] {
        return updateEntries(entries, observedTasks(tasks, 'open'), today, () => `id${++idCount}`, 'open');
    }

    it('starts tracking open tasks without a horizon or with an invalid one, without a planned date', () => {
        const entries = stepAll(
            [],
            '2026-10-17',
            taskAt('- [ ] Buy milk', 'a.md', 1),
            taskAt('- [ ] Call Bob 🔭 tomorow', 'a.md', 2),
            taskAt('- [x] Fix shelf ✅ 2026-10-16', 'a.md', 3),
        );
        expect(entries.map((entry) => [entry.id, entry.horizon, entry.planned])).toEqual([
            ['id1', 'none', undefined],
            ['id2', 'invalid', undefined],
        ]);
    });

    it('records the completion of a task without a horizon', () => {
        let entries = stepAll([], '2026-10-12', taskAt('- [ ] Buy milk', 'a.md', 1));
        entries = stepAll(entries, '2026-10-14', taskAt('- [x] Buy milk ✅ 2026-10-13', 'a.md', 1));
        expect(entries).toMatchObject([{ id: 'id1', status: 'done', closed: '2026-10-13', since: '2026-10-12' }]);
        expect(daysLate(entries[0], '2026-10-17')).toBeNull();
    });
});
