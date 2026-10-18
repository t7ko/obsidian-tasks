import moment from 'moment';
import { HorizonHistory } from '../../../src/HorizonHistory/HorizonHistory';
import { todayAsDay } from '../../../src/HorizonHistory/HorizonPeriod';
import { OpenedDateField } from '../../../src/Query/Filter/OpenedDateField';
import { SearchInfo } from '../../../src/Query/SearchInfo';
import type { Task } from '../../../src/Task/Task';
import { expectTaskComparesBefore } from '../../CustomMatchers/CustomMatchersForSorting';
import { entryForTask, loadedFrom, taskAt } from '../../HorizonHistory/HorizonHistoryTestHelpers';

window.moment = moment;

const today = todayAsDay();

const tasks: Record<string, Task> = {
    created: taskAt('- [ ] Created ➕ 2026-03-02', 'a.md', 1),
    tracked: taskAt('- [ ] Tracked', 'a.md', 2),
    trackedAndCreated: taskAt('- [ ] Tracked and created 🔭 today ➕ 2026-01-05', 'a.md', 3),
    neither: taskAt('- [ ] Neither', 'a.md', 4),
};

beforeEach(() => {
    HorizonHistory.resetInstance();
    HorizonHistory.getInstance().load(
        loadedFrom([
            entryForTask(tasks.tracked, { since: '2026-10-02' }),
            entryForTask(tasks.trackedAndCreated, { planned: '2026-10-12', since: '2026-10-02' }),
        ]),
        today,
    );
});

afterAll(() => {
    HorizonHistory.resetInstance();
});

function matchingTasks(instruction: string) {
    const filter = new OpenedDateField().createFilterOrErrorMessage(instruction);
    expect(filter).toBeValid();
    return Object.entries(tasks)
        .filter(([_, task]) => filter.filterFunction!(task, SearchInfo.fromAllTasks(Object.values(tasks))))
        .map(([name]) => name);
}

describe('filtering by opened date', () => {
    it.each([
        ['opened before 2026-03-03', ['created', 'trackedAndCreated']],
        ['opened on 2026-10-02', ['tracked']],
        ['opened after 2026-01-05', ['created', 'tracked']],
        ['has opened date', ['created', 'tracked', 'trackedAndCreated']],
        ['no opened date', ['neither']],
    ])('%s matches %j', (instruction, expected) => {
        expect(matchingTasks(instruction)).toEqual(expected);
    });
});

describe('sorting by opened date', () => {
    it('sorts the oldest first', () => {
        const sorter = new OpenedDateField().createNormalSorter();
        expectTaskComparesBefore(sorter, tasks.trackedAndCreated, tasks.created);
        expectTaskComparesBefore(sorter, tasks.created, tasks.tracked);
        expectTaskComparesBefore(sorter, tasks.tracked, tasks.neither);
    });
});
