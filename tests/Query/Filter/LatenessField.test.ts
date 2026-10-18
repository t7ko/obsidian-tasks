import moment from 'moment';
import { resetSettings, updateSettings } from '../../../src/Config/Settings';
import { HorizonHistory } from '../../../src/HorizonHistory/HorizonHistory';
import { addDays, todayAsDay } from '../../../src/HorizonHistory/HorizonPeriod';
import { LatenessField, latenessGroupNamer } from '../../../src/Query/Filter/LatenessField';
import { SearchInfo } from '../../../src/Query/SearchInfo';
import type { Task } from '../../../src/Task/Task';
import { entryForTask, loadedFrom, taskAt } from '../../HorizonHistory/HorizonHistoryTestHelpers';

window.moment = moment;

const today = todayAsDay();

const tasks: Record<string, Task> = {
    late100: taskAt('- [ ] Hundred days 🔭 today', 'a.md', 0),
    late40: taskAt('- [ ] Forty days 🔭 today', 'a.md', 1),
    late10: taskAt('- [ ] Ten days 🔭 today', 'a.md', 2),
    late3: taskAt('- [ ] Three days 🔭 today', 'a.md', 3),
    onTime: taskAt('- [ ] On time 🔭 next month', 'a.md', 4),
    doneLate: taskAt('- [x] Done late 🔭 today ✅ 2026-10-14', 'a.md', 5),
    doneOnTime: taskAt('- [x] Done on time 🔭 today ✅ 2026-10-12', 'a.md', 6),
    noHorizon: taskAt('- [ ] No horizon', 'a.md', 7),
    untracked: taskAt('- [ ] Not tracked 🔭 today', 'a.md', 8),
};

beforeEach(() => {
    HorizonHistory.resetInstance();
    HorizonHistory.getInstance().load(
        loadedFrom([
            entryForTask(tasks.late100, { planned: addDays(today, -100) }),
            entryForTask(tasks.late40, { planned: addDays(today, -40) }),
            entryForTask(tasks.late10, { planned: addDays(today, -10) }),
            entryForTask(tasks.late3, { planned: addDays(today, -3) }),
            entryForTask(tasks.onTime, { planned: today }),
            entryForTask(tasks.doneLate, {
                planned: '2026-10-11',
                status: 'done',
                closed: '2026-10-14',
                closedOn: today,
            }),
            entryForTask(tasks.doneOnTime, {
                planned: '2026-10-12',
                status: 'done',
                closed: '2026-10-12',
                closedOn: today,
            }),
            entryForTask(tasks.noHorizon, { since: addDays(today, -200) }),
        ]),
        today,
    );
});

afterEach(() => {
    resetSettings();
});

afterAll(() => {
    HorizonHistory.resetInstance();
});

function matchingTasks(instruction: string) {
    const filter = new LatenessField().createFilterOrErrorMessage(instruction);
    expect(filter).toBeValid();
    return Object.entries(tasks)
        .filter(([_, task]) => filter.filterFunction!(task, SearchInfo.fromAllTasks(Object.values(tasks))))
        .map(([name]) => name);
}

describe('filtering by lateness', () => {
    it('is late', () => {
        expect(matchingTasks('is late')).toEqual(['late100', 'late40', 'late10', 'late3', 'doneLate']);
    });

    it('is not late', () => {
        expect(matchingTasks('IS NOT  LATE')).toEqual(['onTime', 'doneOnTime', 'noHorizon', 'untracked']);
    });

    it('claims only its own lines', () => {
        const field = new LatenessField();
        expect(field.canCreateFilterForLine('is late')).toEqual(true);
        expect(field.canCreateFilterForLine('is not late')).toEqual(true);
        expect(field.canCreateFilterForLine('is lately')).toEqual(false);
        expect(field.canCreateFilterForLine('is recurring')).toEqual(false);
    });
});

describe('sorting by lateness', () => {
    it('puts the latest first, then tasks on time, then tasks without a planned date', () => {
        const comparator = new LatenessField().comparator();
        const sorted = Object.keys(tasks).sort((a, b) => comparator(tasks[a], tasks[b], SearchInfo.fromAllTasks([])));
        expect(sorted).toEqual([
            'late100',
            'late40',
            'late10',
            'late3',
            'doneLate',
            'onTime',
            'doneOnTime',
            'noHorizon',
            'untracked',
        ]);
    });
});

describe('grouping by lateness', () => {
    it.each([
        ['late100', '%%1%%Late 90+ days'],
        ['late40', '%%2%%Late 30–89 days'],
        ['late10', '%%3%%Late 7–29 days'],
        ['late3', '%%4%%Late 1–6 days'],
        ['doneLate', '%%4%%Late 1–6 days'],
        ['onTime', '%%5%%On time'],
        ['doneOnTime', '%%5%%On time'],
        ['noHorizon', '%%6%%Not planned'],
        ['untracked', '%%6%%Not planned'],
    ])('puts %s under %s', (name, heading) => {
        expect(new LatenessField().grouper()(tasks[name], SearchInfo.fromAllTasks([]))).toEqual([heading]);
    });

    it('follows the days-late settings', () => {
        updateSettings({ t7: { horizonHistory: { track: 'horizon', lateDays: { low: 2, medium: 14, high: 60 } } } });
        expect(new LatenessField().grouper()(tasks.late40, SearchInfo.fromAllTasks([]))).toEqual([
            '%%2%%Late 14–59 days',
        ]);
    });

    it('names short ranges', () => {
        const name = latenessGroupNamer({ low: 2, medium: 3, high: 4 });
        expect([1, 2, 3, 4].map(name)).toEqual([
            '%%4%%Late 1 day',
            '%%3%%Late 2 days',
            '%%2%%Late 3 days',
            '%%1%%Late 4+ days',
        ]);
    });
});
