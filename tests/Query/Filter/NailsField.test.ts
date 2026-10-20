import { NailsField } from '../../../src/Query/Filter/NailsField';
import { Query } from '../../../src/Query/Query';
import { SearchInfo } from '../../../src/Query/SearchInfo';
import type { Task } from '../../../src/Task/Task';
import {
    expectTaskComparesAfter,
    expectTaskComparesBefore,
    expectTaskComparesEqual,
} from '../../CustomMatchers/CustomMatchersForSorting';
import { fromLine } from '../../TestingTools/TestHelpers';

function withDescription(description: string) {
    return fromLine({ line: `- [ ] ${description}` });
}

const tasks: Record<string, Task> = {
    none: withDescription('Task'),
    one: withDescription('⚠️ Task'),
    two: withDescription('⚠️⚠️ Task'),
    three: withDescription('⚠️⚠️⚠️Task'),
    later: withDescription('Task ⚠️'),
};

function matchingTasks(instruction: string) {
    const filter = new NailsField().createFilterOrErrorMessage(instruction);
    expect(filter).toBeValid();
    return Object.entries(tasks)
        .filter(([_, task]) => filter.filterFunction!(task, SearchInfo.fromAllTasks([task])))
        .map(([name]) => name);
}

describe('filtering by nails', () => {
    it.each([
        ['has nails', ['one', 'two', 'three']],
        ['no nails', ['none', 'later']],
        ['nails is 2', ['two']],
        ['nails 2', ['two']],
        ['nails is 0', ['none', 'later']],
        ['nails is above 1', ['two', 'three']],
        ['nails above 1', ['two', 'three']],
        ['nails is below 2', ['none', 'one', 'later']],
        ['nails below 1', ['none', 'later']],
        ['nails is not 0', ['one', 'two', 'three']],
        ['nails not 2', ['none', 'one', 'three', 'later']],
        // Case and whitespace
        ['HAS NAILS', ['one', 'two', 'three']],
        ['nails  is   above\t2', ['three']],
    ])('"%s" matches %j', (instruction: string, expected: string[]) => {
        expect(matchingTasks(instruction)).toEqual(expected);
    });

    it.each([
        'nails',
        'nails is',
        'nails is many',
        'nails is above',
        'nails is -1',
        'nails is 1.5',
        'nails at least 2',
    ])('should give an error for "%s"', (instruction: string) => {
        const filter = new NailsField().createFilterOrErrorMessage(instruction);
        expect(filter).not.toBeValid();
        expect(filter.error).toContain('do not understand nails filter');
    });

    it('should parse nails filters in a query', () => {
        const query = new Query('has nails\nnails is above 1');
        expect(query.error).toBeUndefined();
        expect(query.filters.map((filter) => filter.instruction)).toEqual(['has nails', 'nails is above 1']);
    });

    it('should not claim other instructions', () => {
        const field = new NailsField();
        expect(field.canCreateFilterForLine('has nail')).toEqual(false);
        expect(field.canCreateFilterForLine('description includes nails')).toEqual(false);
        expect(field.canCreateFilterForLine('nailsx')).toEqual(false);
    });
});

describe('sorting by nails', () => {
    it('should support sorting', () => {
        expect(new NailsField().supportsSorting()).toEqual(true);
    });

    it('should put the most nails first', () => {
        const sorter = new NailsField().createNormalSorter();
        expectTaskComparesBefore(sorter, tasks.three, tasks.two);
        expectTaskComparesBefore(sorter, tasks.two, tasks.one);
        expectTaskComparesBefore(sorter, tasks.one, tasks.none);
        expectTaskComparesEqual(sorter, tasks.none, tasks.later);
        expectTaskComparesEqual(sorter, tasks.two, withDescription('⚠️ ⚠️ Other'));
    });

    it('should sort in reverse', () => {
        const sorter = new NailsField().createReverseSorter();
        expectTaskComparesAfter(sorter, tasks.three, tasks.one);
    });

    it('should parse "sort by nails reverse"', () => {
        const query = new Query('sort by nails reverse');
        expect(query.error).toBeUndefined();
        expect(query.sorting.length).toEqual(1);
    });
});

describe('grouping by nails', () => {
    it('should support grouping', () => {
        expect(new NailsField().supportsGrouping()).toEqual(true);
    });

    it.each([
        ['Task', '%%999%%No nails'],
        ['⚠️ Task', '%%998%%1 nail'],
        ['⚠️⚠️ Task', '%%997%%2 nails'],
        ['⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️ Task', '%%988%%11 nails'],
    ])('task "%s" should be in group "%s"', (description: string, group: string) => {
        const grouper = new NailsField().createNormalGrouper();
        expect({ grouper, tasks: [withDescription(description)] }).groupHeadingsToBe([group]);
    });

    it('should order the groups with the most nails first, by number (Obsidian hides the %%..%%)', () => {
        const grouper = new NailsField().createNormalGrouper();
        const eleven = withDescription('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️ Task');
        expect({ grouper, tasks: [...Object.values(tasks), eleven] }).groupHeadingsToBe([
            '%%988%%11 nails',
            '%%996%%3 nails',
            '%%997%%2 nails',
            '%%998%%1 nail',
            '%%999%%No nails',
        ]);
    });

    it('should reverse the groups', () => {
        const grouper = new NailsField().createReverseGrouper();
        expect({ grouper, tasks: Object.values(tasks) }).groupHeadingsToBe([
            '%%999%%No nails',
            '%%998%%1 nail',
            '%%997%%2 nails',
            '%%996%%3 nails',
        ]);
    });
});
