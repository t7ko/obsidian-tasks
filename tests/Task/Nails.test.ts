import moment from 'moment';
import {
    NAIL_MARKER,
    addNail,
    addNailEdit,
    applyLineEdit,
    descriptionStart,
    nailCount,
    removeNail,
    removeNailEdit,
} from '../../src/Task/Nails';
import { Priority } from '../../src/Task/Priority';
import { fromLine } from '../TestingTools/TestHelpers';

window.moment = moment;

// A nail without the emoji variation selector, as some keyboards type it.
const BARE_NAIL = '\u26A0';

describe('nail marker', () => {
    it('should be the warning sign with the emoji variation selector', () => {
        expect(NAIL_MARKER).toEqual('⚠️');
        expect(NAIL_MARKER.length).toEqual(2);
    });
});

describe('nailCount', () => {
    it.each([
        ['Call Bob', 0],
        ['', 0],
        ['⚠️ Call Bob', 1],
        ['⚠️Call Bob', 1],
        ['⚠️⚠️ Call Bob', 2],
        ['⚠️⚠️⚠️pick shortlist items', 3],
        ['⚠️ ⚠️  ⚠️ Call Bob', 3],
        [`${BARE_NAIL} Call Bob`, 1],
        [`${BARE_NAIL}⚠️${BARE_NAIL} Call Bob`, 3],
        ['⚠️', 1],
        ['⚠️1: define the project', 1],
        // Only nails at the start count.
        ['Call Bob ⚠️', 0],
        ['#work ⚠️ Call Bob', 0],
        ['⚠️ Call ⚠️ Bob', 1],
    ])('"%s" has %i nails', (description: string, expected: number) => {
        expect(nailCount(description)).toEqual(expected);
    });
});

describe('addNail', () => {
    it.each([
        ['Call Bob', '⚠️ Call Bob'],
        ['⚠️ Call Bob', '⚠️⚠️ Call Bob'],
        ['⚠️Call Bob', '⚠️⚠️Call Bob'],
        ['⚠️⚠️ Call Bob', '⚠️⚠️⚠️ Call Bob'],
        ['', '⚠️'],
        ['Call Bob ⚠️', '⚠️ Call Bob ⚠️'],
    ])('"%s" becomes "%s"', (description: string, expected: string) => {
        expect(addNail(description)).toEqual(expected);
        expect(nailCount(addNail(description))).toEqual(nailCount(description) + 1);
    });
});

describe('removeNail', () => {
    it.each([
        ['⚠️ Call Bob', 'Call Bob'],
        ['⚠️Call Bob', 'Call Bob'],
        ['⚠️⚠️ Call Bob', '⚠️ Call Bob'],
        ['⚠️ ⚠️ Call Bob', '⚠️ Call Bob'],
        [`${BARE_NAIL} Call Bob`, 'Call Bob'],
        [`${BARE_NAIL}⚠️ Call Bob`, '⚠️ Call Bob'],
        ['⚠️', ''],
        ['Call Bob', 'Call Bob'],
        ['Call ⚠️ Bob', 'Call ⚠️ Bob'],
    ])('"%s" becomes "%s"', (description: string, expected: string) => {
        expect(removeNail(description)).toEqual(expected);
    });

    it('should undo addNail', () => {
        for (const description of ['Call Bob', '⚠️ Call Bob', '⚠️⚠️Call Bob', '']) {
            expect(removeNail(addNail(description))).toEqual(description);
        }
    });
});

describe('descriptionStart', () => {
    it.each([
        ['- [ ] Call Bob', 6],
        ['- [x] Call Bob', 6],
        ['    * [ ]   Call Bob', 12],
        ['> 1. [/] Call Bob', 9],
        ['- [ ]', 5],
        ['- [ ]Call Bob', 5],
    ])('the description of "%s" starts at %i', (line: string, expected: number) => {
        expect(descriptionStart(line)).toEqual(expected);
    });

    it.each(['Call Bob', '- Call Bob', '', '[ ] Call Bob'])('"%s" is not a task line', (line: string) => {
        expect(descriptionStart(line)).toBeNull();
    });
});

describe('editing task lines', () => {
    it.each([
        ['- [ ] Call Bob', '- [ ] ⚠️ Call Bob'],
        ['- [ ] ⚠️ Call Bob ⏫ 📅 2026-10-20', '- [ ] ⚠️⚠️ Call Bob ⏫ 📅 2026-10-20'],
        ['    - [ ] Call Bob ^abc', '    - [ ] ⚠️ Call Bob ^abc'],
        ['- [ ] ', '- [ ] ⚠️'],
        ['- [ ]', '- [ ] ⚠️'],
        ['- [ ]Call Bob', '- [ ] ⚠️ Call Bob'],
        ['- [x] Call Bob ✅ 2026-10-20', '- [x] ⚠️ Call Bob ✅ 2026-10-20'],
    ])('adding a nail to "%s" gives "%s"', (line: string, expected: string) => {
        const edit = addNailEdit(line)!;
        expect(edit.from).toEqual(edit.to);
        expect(applyLineEdit(line, edit)).toEqual(expected);
    });

    it.each([
        ['- [ ] ⚠️ Call Bob', '- [ ] Call Bob'],
        ['- [ ] ⚠️⚠️ Call Bob 📅 2026-10-20', '- [ ] ⚠️ Call Bob 📅 2026-10-20'],
        ['- [ ] ⚠️ 📅 2026-10-20', '- [ ] 📅 2026-10-20'],
        ['- [ ] ⚠️', '- [ ] '],
    ])('removing a nail from "%s" gives "%s"', (line: string, expected: string) => {
        const edit = removeNailEdit(line)!;
        expect(edit.text).toEqual('');
        expect(applyLineEdit(line, edit)).toEqual(expected);
    });

    it.each(['Call Bob', '- Call Bob', '# Heading'])('should not edit "%s", which is not a task', (line: string) => {
        expect(addNailEdit(line)).toBeNull();
        expect(removeNailEdit(line)).toBeNull();
    });

    it('should not remove a nail from a task without one', () => {
        expect(removeNailEdit('- [ ] Call Bob ⚠️')).toBeNull();
    });
});

describe('nails and the standard serializer', () => {
    it('should keep every standard field of a task with nails, as vanilla Tasks reads it', () => {
        const line = applyLineEdit(
            '- [ ] ⚠️ Call Bob #work ⏫ 🔁 every week 📅 2026-10-20',
            addNailEdit('- [ ] ⚠️ Call Bob #work ⏫ 🔁 every week 📅 2026-10-20')!,
        );
        const task = fromLine({ line });

        expect(task.description).toEqual('⚠️⚠️ Call Bob #work');
        expect(nailCount(task.description)).toEqual(2);
        expect(task.priority).toEqual(Priority.High);
        expect(task.recurrence?.toText()).toEqual('every week');
        expect(task.dueDate?.format('YYYY-MM-DD')).toEqual('2026-10-20');
        expect(task.tags).toEqual(['#work']);
    });
});
