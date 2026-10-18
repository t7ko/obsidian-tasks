import moment from 'moment';
import {
    type HistoryEntry,
    type HistoryRecord,
    daysLate,
    historyKey,
    similarity,
    toRecord,
} from '../../src/HorizonHistory/HistoryRecord';

window.moment = moment;

describe('historyKey', () => {
    it.each([
        ['- [ ] Call Bob 🔭 today 📅 2026-10-20', 'Call Bob 📅 2026-10-20'],
        ['- [x] Call Bob 🔭 today 📅 2026-10-20 ✅ 2026-10-21', 'Call Bob 📅 2026-10-20'],
        ['    - [-] Call Bob 🔭 today ❌ 2026-10-21', 'Call Bob'],
        ['> * [/] Call Bob 🔭 this  week', 'Call Bob'],
        ['1. [ ] Call Bob 🔭 next month', 'Call Bob'],
        ['- [ ] Write report 🔭 today 🪜 ~~draft~~ // review', 'Write report 🪜 draft // review'],
        ['- [x] Call Bob 🔭 today [due:: 2026-10-20] [completion:: 2026-10-21]', 'Call Bob [due:: 2026-10-20]'],
        ['- [-] Call Bob 🔭 today (cancelled:: 2026-10-21)', 'Call Bob'],
        ['- [ ] Call Bob 🔭 tomorow', 'Call Bob tomorow'],
        ['- [ ] Call Bob', 'Call Bob'],
    ])('the key of %j is %j', (line, expected) => {
        expect(historyKey(line)).toEqual(expected);
    });

    it('ignores the checkbox, the done date and the horizon', () => {
        expect(historyKey('- [x] Call Bob 🔭 next week ✅ 2026-10-21')).toEqual(historyKey('- [ ] Call Bob 🔭 today'));
    });
});

describe('similarity', () => {
    it.each([
        ['Call Bob', 'Call Bob', 1],
        ['Call Bob', 'Buy milk', 0],
        ['a b c', 'a b d', 0.5],
        ['a b', 'a b c', 2 / 3],
        ['', '', 1],
    ])('%j and %j are %d alike', (a, b, expected) => {
        expect(similarity(a, b)).toBeCloseTo(expected);
    });
});

function record(fields: Partial<HistoryRecord>): HistoryRecord {
    return {
        id: 'abc',
        path: 'notes.md',
        line: 3,
        text: '- [ ] Call Bob 🔭 today',
        horizon: 'today',
        status: 'open',
        planned: '2026-10-12',
        pushes: 0,
        since: '2026-10-02',
        ...fields,
    };
}

describe('daysLate', () => {
    it('counts an open task to today', () => {
        expect(daysLate(record({}), '2026-10-17')).toEqual(5);
        expect(daysLate(record({}), '2026-10-12')).toEqual(0);
        expect(daysLate(record({}), '2026-10-10')).toEqual(0);
    });

    it('counts a done or cancelled task to the day it was closed', () => {
        expect(daysLate(record({ status: 'done', closed: '2026-10-14' }), '2026-10-30')).toEqual(2);
        expect(daysLate(record({ status: 'cancelled', closed: '2026-10-11' }), '2026-10-30')).toEqual(0);
    });

    it('has no lateness for a dropped task', () => {
        expect(daysLate(record({ status: 'dropped', closed: '2026-10-14' }), '2026-10-17')).toBeNull();
    });
});

describe('toRecord', () => {
    it('keeps the stored fields, in file order', () => {
        const entry: HistoryEntry = { ...record({}), key: 'Call Bob', closedOn: '2026-10-17' };
        const stored = toRecord(entry);
        expect(Object.keys(stored)).toEqual([
            'id',
            'path',
            'line',
            'text',
            'horizon',
            'status',
            'planned',
            'pushes',
            'since',
        ]);
    });

    it('keeps the closing day of a closed task', () => {
        const entry: HistoryEntry = { ...record({ status: 'done', closed: '2026-10-14' }), key: 'Call Bob' };
        expect(Object.keys(toRecord(entry))).toEqual([
            'id',
            'path',
            'line',
            'text',
            'horizon',
            'status',
            'closed',
            'planned',
            'pushes',
            'since',
        ]);
    });
});
