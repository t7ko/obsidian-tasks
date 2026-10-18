import moment from 'moment';
import { GlobalQuery } from '../../src/Config/GlobalQuery';
import { globalQueryMatcher } from '../../src/HorizonHistory/globalQueryMatcher';
import { taskAt } from './HorizonHistoryTestHelpers';

window.moment = moment;

const tasks = {
    inTodo: taskAt('- [ ] Call Bob 🔭 today', 'TODO/work.md', 1),
    hidden: taskAt('- [ ] Secret #hide 🔭 today', 'TODO/work.md', 2),
    elsewhere: taskAt('- [ ] Buy milk 🔭 today', 'Journal/2026-10-18.md', 3),
};

function matching(globalQuery: string) {
    GlobalQuery.getInstance().set(globalQuery);
    const matches = globalQueryMatcher(Object.values(tasks));
    return Object.entries(tasks)
        .filter(([_, task]) => matches(task))
        .map(([name]) => name);
}

afterEach(() => {
    GlobalQuery.getInstance().reset();
});

describe('globalQueryMatcher', () => {
    it('applies the global query filters', () => {
        expect(matching('path includes TODO/\ntags do not include #hide')).toEqual(['inTodo']);
    });

    it('lets every task through without a global query', () => {
        expect(matching('')).toEqual(['inTodo', 'hidden', 'elsewhere']);
    });

    it('lets every task through when the global query is invalid', () => {
        expect(matching('path includes TODO/\nthis is not an instruction')).toEqual(['inTodo', 'hidden', 'elsewhere']);
    });

    it('ignores the global query layout and sort instructions', () => {
        expect(matching('path includes TODO/\nsort by due\nhide due date')).toEqual(['inTodo', 'hidden']);
    });
});
