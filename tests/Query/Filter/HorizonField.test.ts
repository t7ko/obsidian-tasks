import { HorizonField } from '../../../src/Query/Filter/HorizonField';
import { Query } from '../../../src/Query/Query';
import { SearchInfo } from '../../../src/Query/SearchInfo';
import type { Task } from '../../../src/Task/Task';
import {
    expectTaskComparesAfter,
    expectTaskComparesBefore,
    expectTaskComparesEqual,
} from '../../CustomMatchers/CustomMatchersForSorting';
import { fromLine } from '../../TestingTools/TestHelpers';

function withHorizon(horizonText: string) {
    return fromLine({ line: `- [ ] Task ${horizonText}`.trimEnd() });
}

const tasks: Record<string, Task> = {
    invalid: withHorizon('🔭 tomorow'),
    today: withHorizon('🔭 today'),
    tomorrow: withHorizon('🔭 tomorrow'),
    thisWeek: withHorizon('🔭 this week'),
    nextWeek: withHorizon('🔭 next week'),
    thisMonth: withHorizon('🔭 this month'),
    nextMonth: withHorizon('🔭 next month'),
    none: withHorizon(''),
};

function matchingTasks(instruction: string) {
    const filter = new HorizonField().createFilterOrErrorMessage(instruction);
    expect(filter).toBeValid();
    return Object.entries(tasks)
        .filter(([_, task]) => filter.filterFunction!(task, SearchInfo.fromAllTasks([task])))
        .map(([name]) => name);
}

describe('filtering by horizon', () => {
    it.each([
        ['horizon is today', ['today']],
        ['horizon is tomorrow', ['tomorrow']],
        ['horizon is this week', ['thisWeek']],
        ['horizon is next week', ['nextWeek']],
        ['horizon is this month', ['thisMonth']],
        ['horizon is next month', ['nextMonth']],
        ['horizon is none', ['none']],
        ['horizon is invalid', ['invalid']],
        ['horizon is not today', ['invalid', 'tomorrow', 'thisWeek', 'nextWeek', 'thisMonth', 'nextMonth', 'none']],
        ['horizon is not none', ['invalid', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'thisMonth', 'nextMonth']],
        ['horizon before next week', ['today', 'tomorrow', 'thisWeek']],
        ['horizon before today', []],
        ['horizon after this week', ['nextWeek', 'thisMonth', 'nextMonth']],
        ['horizon after next month', []],
        ['has horizon', ['invalid', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'thisMonth', 'nextMonth']],
        ['no horizon', ['none']],
        // Case and whitespace
        ['HORIZON IS THIS WEEK', ['thisWeek']],
        [
            'horizon  is   not\tthis  week',
            ['invalid', 'today', 'tomorrow', 'nextWeek', 'thisMonth', 'nextMonth', 'none'],
        ],
        ['Has Horizon', ['invalid', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'thisMonth', 'nextMonth']],
    ])('"%s" matches %j', (instruction: string, expected: string[]) => {
        expect(matchingTasks(instruction)).toEqual(expected);
    });

    it('should explain a filter by repeating its line', () => {
        const filter = new HorizonField().createFilterOrErrorMessage('horizon before next week');
        expect(filter).toHaveExplanation('horizon before next week');
    });

    it.each([
        'horizon',
        'horizon is',
        'horizon is someday',
        'horizon is this',
        'horizon before none',
        'horizon after invalid',
        'horizon on today',
        'horizon today',
    ])('should give an error for "%s"', (instruction: string) => {
        const field = new HorizonField();
        expect(field.canCreateFilterForLine(instruction)).toEqual(true);
        const filter = field.createFilterOrErrorMessage(instruction);
        expect(filter.filterFunction).toBeUndefined();
        expect(filter.error).toContain('do not understand horizon filter');
    });

    it.each(['horizontal', 'has horizons', 'description includes horizon'])(
        'should leave "%s" to other fields',
        (instruction: string) => {
            expect(new HorizonField().canCreateFilterForLine(instruction)).toEqual(false);
        },
    );

    it('should be recognised by Query', () => {
        const query = new Query('horizon is not today\nhas horizon');
        expect(query.error).toBeUndefined();
        expect(query.filters.length).toEqual(2);
    });
});

describe('sorting by horizon', () => {
    it('should support sorting', () => {
        expect(new HorizonField().supportsSorting()).toEqual(true);
    });

    it('should sort by meaning: invalid, today ... next month, then no horizon', () => {
        const sorter = new HorizonField().createNormalSorter();
        const inOrder = Object.values(tasks);
        for (let i = 0; i + 1 < inOrder.length; i++) {
            expectTaskComparesBefore(sorter, inOrder[i], inOrder[i + 1]);
        }
        expectTaskComparesEqual(sorter, tasks.thisWeek, withHorizon('🔭 This  Week'));
        expectTaskComparesEqual(sorter, tasks.none, withHorizon('#home'));
    });

    it('should sort in reverse', () => {
        const sorter = new HorizonField().createReverseSorter();
        expectTaskComparesAfter(sorter, tasks.today, tasks.tomorrow);
    });

    it('should be recognised by Query', () => {
        const query = new Query('sort by horizon reverse');
        expect(query.error).toBeUndefined();
        expect(query.sorting.length).toEqual(1);
    });
});

describe('grouping by horizon', () => {
    it('should support grouping', () => {
        expect(new HorizonField()).toSupportGroupingWithProperty('horizon');
    });

    it.each([
        ['🔭 tomorow', '%%0%%Invalid horizon'],
        ['🔭 today', '%%1%%Today'],
        ['🔭 tomorrow', '%%2%%Tomorrow'],
        ['🔭 this week', '%%3%%This week'],
        ['🔭 next week', '%%4%%Next week'],
        ['🔭 this month', '%%5%%This month'],
        ['🔭 next month', '%%6%%Next month'],
        ['', '%%7%%No horizon'],
    ])('task with "%s" should be in group "%s"', (horizonText: string, group: string) => {
        const grouper = new HorizonField().createNormalGrouper();
        expect({ grouper, tasks: [withHorizon(horizonText)] }).groupHeadingsToBe([group]);
    });

    const headingsInOrder = [
        '%%0%%Invalid horizon',
        '%%1%%Today',
        '%%2%%Tomorrow',
        '%%3%%This week',
        '%%4%%Next week',
        '%%5%%This month',
        '%%6%%Next month',
        '%%7%%No horizon',
    ];

    it('should order the groups by meaning, not alphabetically', () => {
        const grouper = new HorizonField().createNormalGrouper();
        expect({ grouper, tasks: Object.values(tasks) }).groupHeadingsToBe(headingsInOrder);
    });

    it('should reverse the order of the groups', () => {
        const grouper = new HorizonField().createReverseGrouper();
        expect({ grouper, tasks: Object.values(tasks) }).groupHeadingsToBe([...headingsInOrder].reverse());
    });

    it('should be recognised by Query', () => {
        const query = new Query('group by horizon');
        expect(query.error).toBeUndefined();
        expect(query.grouping.length).toEqual(1);
    });
});
