import moment from 'moment';
import { HorizonHistory } from '../../../src/HorizonHistory/HorizonHistory';
import { addDays, todayAsDay } from '../../../src/HorizonHistory/HorizonPeriod';
import { PlannedDateField } from '../../../src/Query/Filter/PlannedDateField';
import { SearchInfo } from '../../../src/Query/SearchInfo';
import type { Task } from '../../../src/Task/Task';
import { expectTaskComparesAfter, expectTaskComparesBefore } from '../../CustomMatchers/CustomMatchersForSorting';
import { entryForTask, loadedFrom, taskAt } from '../../HorizonHistory/HorizonHistoryTestHelpers';

window.moment = moment;

const today = todayAsDay();

const tasks: Record<string, Task> = {
    late: taskAt('- [ ] Late 🔭 today', 'a.md', 1),
    onTime: taskAt('- [ ] On time 🔭 next month', 'a.md', 2),
    untracked: taskAt('- [ ] Not tracked 🔭 today', 'a.md', 3),
    noHorizon: taskAt('- [ ] No horizon', 'a.md', 4),
};

beforeEach(() => {
    HorizonHistory.resetInstance();
    HorizonHistory.getInstance().load(
        loadedFrom([
            entryForTask(tasks.late, { planned: addDays(today, -3) }),
            entryForTask(tasks.onTime, { planned: addDays(today, 20) }),
        ]),
        today,
    );
});

afterAll(() => {
    HorizonHistory.resetInstance();
});

function matchingTasks(instruction: string) {
    const filter = new PlannedDateField().createFilterOrErrorMessage(instruction);
    expect(filter).toBeValid();
    return Object.entries(tasks)
        .filter(([_, task]) => filter.filterFunction!(task, SearchInfo.fromAllTasks(Object.values(tasks))))
        .map(([name]) => name);
}

describe('filtering by planned date', () => {
    it.each([
        ['planned before today', ['late']],
        [`planned on ${addDays(today, -3)}`, ['late']],
        ['planned after today', ['onTime']],
        [`planned in ${addDays(today, -5)} ${addDays(today, 30)}`, ['late', 'onTime']],
        ['has planned date', ['late', 'onTime']],
        ['no planned date', ['untracked', 'noHorizon']],
    ])('%s matches %j', (instruction, expected) => {
        expect(matchingTasks(instruction)).toEqual(expected);
    });
});

describe('sorting and grouping by planned date', () => {
    it('sorts by planned date, then tasks without one', () => {
        const sorter = new PlannedDateField().createNormalSorter();
        expectTaskComparesBefore(sorter, tasks.late, tasks.onTime);
        expectTaskComparesAfter(sorter, tasks.untracked, tasks.onTime);
    });

    it('groups by planned date', () => {
        const grouper = new PlannedDateField().createNormalGrouper().grouper;
        const day = moment(addDays(today, -3));
        expect(grouper(tasks.late, SearchInfo.fromAllTasks([]))).toEqual([day.format('YYYY-MM-DD dddd')]);
        expect(grouper(tasks.untracked, SearchInfo.fromAllTasks([]))).toEqual(['No planned date']);
    });
});
