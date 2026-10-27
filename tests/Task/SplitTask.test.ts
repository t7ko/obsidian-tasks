/**
 * t7 fork feature: split tasks. Spec: fork-features/split-tasks.md
 */
import moment from 'moment';
import { GlobalFilter } from '../../src/Config/GlobalFilter';
import { resetSettings, updateSettings } from '../../src/Config/Settings';
import { DEFAULT_SYMBOLS, DefaultTaskSerializer } from '../../src/TaskSerializer/DefaultTaskSerializer';
import { splitDescription, splitTask } from '../../src/Task/SplitTask';
import { stepSegments } from '../../src/Task/MultiStepTask';
import { fromLine } from '../TestingTools/TestHelpers';

window.moment = moment;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26'));
});

afterEach(() => {
    vi.useRealTimers();
    resetSettings();
    GlobalFilter.getInstance().reset();
});

function splitLines(line: string): string[] | null {
    return splitTask(fromLine({ line }))?.map((task) => task.toFileLineString()) ?? null;
}

describe('stepSegments', () => {
    it('should split at separators with whitespace on both sides', () => {
        expect(stepSegments(' a // b //c // https://x.org a//b ')).toEqual([
            { text: 'a', done: false },
            { text: 'b //c', done: false },
            { text: 'https://x.org a//b', done: false },
        ]);
    });

    it('should leave out empty segments', () => {
        expect(stepSegments('a //  // b //')).toEqual([
            { text: 'a', done: false },
            { text: 'b', done: false },
        ]);
    });

    it('should unstrike done segments and keep their trailing tags', () => {
        expect(stepSegments('~~a~~ #home // ~~ b ~~ // ~~c // d~~')).toEqual([
            { text: 'a #home', done: true },
            { text: 'b', done: true },
            { text: '~~c', done: false },
            { text: 'd~~', done: false },
        ]);
    });
});

describe('splitDescription', () => {
    it.each([
        ['no separator', 'Renew passport'],
        ['one step', 'Renew passport 🪜 fill form'],
        ['no whitespace around //', 'see https://example.com and a//b'],
        ['a separator but one part', 'Renew passport // '],
        ['the separator before the marker only', 'a // b 🪜 c'],
    ])('should not split with %s', (_: string, description: string) => {
        expect(splitDescription(description)).toBeNull();
    });

    it('should prefix each step with the title and a colon', () => {
        expect(splitDescription('Renew passport 🪜 fill form // get photo // submit')).toEqual([
            { description: 'Renew passport: fill form', done: false },
            { description: 'Renew passport: get photo', done: false },
            { description: 'Renew passport: submit', done: false },
        ]);
    });

    it.each([
        ['with the variation selector', 'Renew passport 🪜️ fill form // submit'],
        ['with a colon after the title', 'Renew passport: 🪜 fill form // submit'],
        ['without spaces around the marker', 'Renew passport🪜fill form // submit'],
    ])('should find the title and steps %s', (_: string, description: string) => {
        expect(splitDescription(description)?.map((part) => part.description)).toEqual([
            'Renew passport: fill form',
            'Renew passport: submit',
        ]);
    });

    it('should not prefix steps without a title', () => {
        expect(splitDescription('🪜 a // b')?.map((part) => part.description)).toEqual(['a', 'b']);
    });

    it('should not split the title', () => {
        expect(splitDescription('x // y 🪜 a // b')?.map((part) => part.description)).toEqual([
            'x // y: a',
            'x // y: b',
        ]);
    });

    it('should mark done steps and remove their strikes', () => {
        expect(splitDescription('Bake 🪜 ~~buy flour~~ #shop // mix')).toEqual([
            { description: 'Bake: buy flour #shop', done: true },
            { description: 'Bake: mix #shop', done: false },
        ]);
    });

    it('should split without a marker, with no prefix', () => {
        expect(splitDescription('buy milk // buy eggs #shop // ~~call Bob~~')).toEqual([
            { description: 'buy milk #shop', done: false },
            { description: 'buy eggs #shop', done: false },
            { description: 'call Bob #shop', done: true },
        ]);
    });

    it('should give nails at the start to every part', () => {
        expect(splitDescription('⚠️⚠️ buy milk // buy eggs')?.map((part) => part.description)).toEqual([
            '⚠️⚠️ buy milk',
            '⚠️⚠️ buy eggs',
        ]);
        expect(splitDescription('⚠️ 🪜 a // b')?.map((part) => part.description)).toEqual(['⚠️ a', '⚠️ b']);
        expect(splitDescription('⚠️ Renew 🪜 a // b')?.map((part) => part.description)).toEqual([
            '⚠️ Renew: a',
            '⚠️ Renew: b',
        ]);
    });

    it('should give every tag of a part to every part, in order, before the horizon', () => {
        expect(
            splitDescription(
                '#home Fix 🪜 call #urgent plumber // buy #shop/hardware pipe #home // test 🔭 today',
            )?.map((part) => part.description),
        ).toEqual([
            '#home Fix: call #urgent plumber #shop/hardware 🔭 today',
            '#home Fix: buy #shop/hardware pipe #home #urgent 🔭 today',
            '#home Fix: test #urgent #shop/hardware 🔭 today',
        ]);
    });

    it('should give nails and tags at the start to the start of every part', () => {
        expect(
            splitDescription('⚠️ #shop #today buy milk // buy eggs #dairy')?.map((part) => part.description),
        ).toEqual(['⚠️ #shop #today buy milk #dairy', '⚠️ #shop #today buy eggs #dairy']);
    });

    it('should give the tags of a part holding only tags to the other parts', () => {
        expect(splitDescription('#shop // buy eggs // buy milk')?.map((part) => part.description)).toEqual([
            'buy eggs #shop',
            'buy milk #shop',
        ]);
        expect(splitDescription('Bake 🪜 mix // bake // #home')?.map((part) => part.description)).toEqual([
            'Bake: mix #home',
            'Bake: bake #home',
        ]);
        expect(splitDescription('buy eggs // #shop')).toBeNull();
    });

    it('should not add a tag twice', () => {
        expect(splitDescription('a #x #y // b #x // c #y #x')?.map((part) => part.description)).toEqual([
            'a #x #y',
            'b #x #y',
            'c #y #x',
        ]);
    });

    it('should not take an anchor or a word with # for a tag', () => {
        expect(splitDescription('see [[Note#Heading]] // C# book')?.map((part) => part.description)).toEqual([
            'see [[Note#Heading]]',
            'C# book',
        ]);
    });

    it('should give a horizon at the end to every part', () => {
        expect(splitDescription('Renew 🪜 ~~a~~ // b 🔭 this week')).toEqual([
            { description: 'Renew: a 🔭 this week', done: true },
            { description: 'Renew: b 🔭 this week', done: false },
        ]);
        expect(splitDescription('a // b 🔭 today')?.map((part) => part.description)).toEqual([
            'a 🔭 today',
            'b 🔭 today',
        ]);
    });
});

describe('splitTask', () => {
    it('should return null for a task that does not split', () => {
        expect(splitTask(fromLine({ line: '- [ ] Renew passport 📅 2026-10-30' }))).toBeNull();
    });

    it('should copy every field, and the id to the last task only', () => {
        const line =
            '  - [/] Renew 🪜 a // b #admin ⏫ 🔁 every week 🏁 delete ➕ 2026-10-01 🛫 2026-10-02 ⏳ 2026-10-03 📅 2026-10-30 🆔 abc123 ⛔ def456';
        expect(splitLines(line)).toEqual([
            '  - [/] Renew: a #admin ⛔ def456 ⏫ 🔁 every week 🏁 delete ➕ 2026-10-01 🛫 2026-10-02 ⏳ 2026-10-03 📅 2026-10-30',
            '  - [/] Renew: b #admin 🆔 abc123 ⛔ def456 ⏫ 🔁 every week 🏁 delete ➕ 2026-10-01 🛫 2026-10-02 ⏳ 2026-10-03 📅 2026-10-30',
        ]);
    });

    it('should keep the id on the last task that is not done', () => {
        expect(splitLines('- [ ] ~~a~~ // b // ~~c~~ // ~~d~~ 🆔 abc123')).toEqual([
            '- [x] a ✅ 2026-10-26',
            '- [ ] b 🆔 abc123',
            '- [x] c ✅ 2026-10-26',
            '- [x] d ✅ 2026-10-26',
        ]);
    });

    it('should keep the id on the last task if all are done', () => {
        expect(splitLines('- [ ] ~~a~~ // ~~b~~ 🆔 abc123')).toEqual([
            '- [x] a ✅ 2026-10-26',
            '- [x] b 🆔 abc123 ✅ 2026-10-26',
        ]);
        expect(splitLines('- [x] a // b 🆔 abc123 ✅ 2026-10-20')).toEqual([
            '- [x] a ✅ 2026-10-20',
            '- [x] b 🆔 abc123 ✅ 2026-10-20',
        ]);
    });

    it('should keep the block link on the first task only', () => {
        expect(splitLines('- [ ] a // b 📅 2026-10-30 ^link')).toEqual([
            '- [ ] a 📅 2026-10-30 ^link',
            '- [ ] b 📅 2026-10-30',
        ]);
    });

    it('should complete done steps with a done date and no new occurrence', () => {
        expect(splitLines('- [ ] Bake 🪜 ~~buy flour~~ // mix 🔁 every day 📅 2026-10-26')).toEqual([
            '- [x] Bake: buy flour 🔁 every day 📅 2026-10-26 ✅ 2026-10-26',
            '- [ ] Bake: mix 🔁 every day 📅 2026-10-26',
        ]);
    });

    it('should complete done steps without a done date if the setting is off', () => {
        updateSettings({ setDoneDate: false });
        expect(splitLines('- [ ] ~~a~~ // b')).toEqual(['- [x] a', '- [ ] b']);
    });

    it('should complete done steps of a cancelled task', () => {
        expect(splitLines('- [-] ~~a~~ // b ❌ 2026-10-20')).toEqual([
            '- [x] a ✅ 2026-10-26',
            '- [-] b ❌ 2026-10-20',
        ]);
    });

    it('should keep the status and dates of a completed task', () => {
        expect(splitLines('- [x] ~~a~~ // b ✅ 2026-10-20')).toEqual([
            '- [x] a ✅ 2026-10-20',
            '- [x] b ✅ 2026-10-20',
        ]);
    });

    it('should give every task the global filter', () => {
        GlobalFilter.getInstance().set('#task');
        expect(splitLines('- [ ] ⚠️ #task buy milk // buy eggs')).toEqual([
            '- [ ] ⚠️ #task buy milk',
            '- [ ] ⚠️ #task buy eggs',
        ]);
        expect(splitLines('- [ ] #task Renew 🪜 a // b')).toEqual(['- [ ] #task Renew: a', '- [ ] #task Renew: b']);
    });

    it('should give every task a global filter that is not a tag, after any nails', () => {
        GlobalFilter.getInstance().set('TODO');
        expect(splitLines('- [ ] TODO buy milk // buy eggs')).toEqual(['- [ ] TODO buy milk', '- [ ] TODO buy eggs']);
        expect(splitLines('- [ ] ⚠️ TODO buy milk // buy eggs')).toEqual([
            '- [ ] ⚠️ TODO buy milk',
            '- [ ] ⚠️ TODO buy eggs',
        ]);
        expect(splitLines('- [ ] buy milk TODO // buy eggs')).toEqual(['- [ ] buy milk TODO', '- [ ] TODO buy eggs']);
    });

    it('should keep a global filter tag in the middle by copying it as a tag', () => {
        GlobalFilter.getInstance().set('#task');
        expect(splitLines('- [ ] buy milk #task // buy eggs')).toEqual([
            '- [ ] buy milk #task',
            '- [ ] buy eggs #task',
        ]);
    });

    it('should write lines vanilla Tasks reads with the same fields', () => {
        const tasks = splitTask(fromLine({ line: '- [ ] Renew 🪜 a // b 🔭 today ⏫ 📅 2026-10-30 🆔 x1' }))!;
        const serializer = new DefaultTaskSerializer(DEFAULT_SYMBOLS);
        for (const task of tasks) {
            const details = serializer.deserialize(task.toString());
            expect(details.dueDate?.format('YYYY-MM-DD')).toEqual('2026-10-30');
            expect(details.priority).toEqual(task.priority);
            expect(details.id).toEqual(task.id);
        }
        expect(tasks.map((task) => task.id)).toEqual(['', 'x1']);
    });
});
