/**
 * Fork feature: multi-step tasks. Spec: fork-features/multi-step-tasks.md
 */
import moment from 'moment';
import { resetSettings, updateSettings } from '../../src/Config/Settings';
import { toggleLine } from '../../src/Commands/ToggleDone';
import { Status } from '../../src/Statuses/Status';
import { StatusRegistry } from '../../src/Statuses/StatusRegistry';
import { resetSteps, toggleStep } from '../../src/Task/MultiStepTask';
import { fromLine } from '../TestingTools/TestHelpers';

window.moment = moment;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17'));
});

afterEach(() => {
    vi.useRealTimers();
    resetSettings();
    StatusRegistry.getInstance().resetToDefaultStatuses();
});

describe('MultiStepTask - toggleStep() when toggling into DONE', () => {
    function advance(description: string) {
        return toggleStep(description, false, true);
    }

    it.each([
        ['no marker', 'Call Bob // book table'],
        ['marker without steps', 'Call Bob 🪜'],
        ['only separators and tags', 'Call Bob 🪜 //  // #home'],
    ])('should leave a task with %s alone', (_, description: string) => {
        expect(advance(description)).toBeNull();
    });

    it('should strike through the first step and keep the status while steps remain', () => {
        expect(advance('Renew passport 🪜 fill form // get photo // submit')).toEqual({
            description: 'Renew passport 🪜 ~~fill form~~ // get photo // submit',
            keepStatus: true,
        });
    });

    it('should strike through the first step that is not done', () => {
        expect(advance('🪜 ~~a~~ // b // c')).toEqual({ description: '🪜 ~~a~~ // ~~b~~ // c', keepStatus: true });
        expect(advance('🪜 a // ~~b~~ // c')).toEqual({ description: '🪜 ~~a~~ // ~~b~~ // c', keepStatus: true });
    });

    it('should complete the task on the last open step', () => {
        expect(advance('🪜 ~~a~~ // b')).toEqual({ description: '🪜 ~~a~~ // ~~b~~', keepStatus: false });
        expect(advance('Call Bob 🪜 book table')).toEqual({
            description: 'Call Bob 🪜 ~~book table~~',
            keepStatus: false,
        });
    });

    it('should toggle as usual when every step is done', () => {
        expect(advance('🪜 ~~a~~ // ~~b~~')).toBeNull();
    });

    it('should only split on // with whitespace on both sides', () => {
        expect(advance('🪜 read https://example.com/a // b')).toEqual({
            description: '🪜 ~~read https://example.com/a~~ // b',
            keepStatus: true,
        });
        expect(advance('🪜 a//b')).toEqual({ description: '🪜 ~~a//b~~', keepStatus: false });
    });

    it('should skip empty steps', () => {
        expect(advance('🪜 a //  // b')).toEqual({ description: '🪜 ~~a~~ //  // b', keepStatus: true });
        expect(advance('🪜 a //')).toEqual({ description: '🪜 ~~a~~ //', keepStatus: false });
    });

    it('should keep the whitespace as typed', () => {
        expect(advance('🪜  a  //  b ')).toEqual({ description: '🪜  ~~a~~  //  b ', keepStatus: true });
    });

    it('should keep trailing tags outside the strikethrough', () => {
        expect(advance('🪜 a #x // b #home #y')).toEqual({
            description: '🪜 ~~a~~ #x // b #home #y',
            keepStatus: true,
        });
        expect(advance('🪜 ~~a~~ #x // b #home #y')).toEqual({
            description: '🪜 ~~a~~ #x // ~~b~~ #home #y',
            keepStatus: false,
        });
        expect(advance('🪜 buy #shop flour // mix')).toEqual({
            description: '🪜 ~~buy #shop flour~~ // mix',
            keepStatus: true,
        });
    });

    it('should keep a horizon at the end outside the strikethrough', () => {
        expect(advance('Renew 🪜 ~~fill form~~ // submit 🔭 this week')).toEqual({
            description: 'Renew 🪜 ~~fill form~~ // ~~submit~~ 🔭 this week',
            keepStatus: false,
        });
        expect(advance('🪜 ~~a~~ // b #home 🔭 today #x')).toEqual({
            description: '🪜 ~~a~~ // ~~b~~ #home 🔭 today #x',
            keepStatus: false,
        });
        expect(advance('🪜 a // 🔭 today')).toEqual({ description: '🪜 ~~a~~ // 🔭 today', keepStatus: false });
        expect(advance('🪜 a 🔭 tomorow')).toEqual({ description: '🪜 ~~a 🔭 tomorow~~', keepStatus: false });
    });

    it('should not count a segment holding only tags as a step', () => {
        expect(advance('🪜 a // #home')).toEqual({ description: '🪜 ~~a~~ // #home', keepStatus: false });
    });

    it('should accept the marker with a variation selector', () => {
        expect(advance('🪜\uFE0F a // b')).toEqual({ description: '🪜\uFE0F ~~a~~ // b', keepStatus: true });
    });

    it('should leave the text before the marker alone', () => {
        expect(advance('~~old~~ plan // x 🪜 a // b')).toEqual({
            description: '~~old~~ plan // x 🪜 ~~a~~ // b',
            keepStatus: true,
        });
    });

    it('should use the first marker only', () => {
        expect(advance('🪜 ~~a~~ // b 🪜 c')).toEqual({ description: '🪜 ~~a~~ // ~~b 🪜 c~~', keepStatus: false });
    });
});

describe('MultiStepTask - toggleStep() for other status changes', () => {
    it('should reopen the last step when un-checking a task with every step done', () => {
        expect(toggleStep('🪜 ~~a~~ // ~~b~~ #x', true, false)).toEqual({
            description: '🪜 ~~a~~ // b #x',
            keepStatus: false,
        });
    });

    it('should reopen the last step before a horizon', () => {
        expect(toggleStep('🪜 ~~a~~ // ~~b~~ 🔭 today', true, false)).toEqual({
            description: '🪜 ~~a~~ // b 🔭 today',
            keepStatus: false,
        });
    });

    it('should leave the steps alone when un-checking a task with open steps', () => {
        expect(toggleStep('🪜 ~~a~~ // b', true, false)).toBeNull();
    });

    it('should leave the steps alone when the toggle does not enter or leave DONE', () => {
        expect(toggleStep('🪜 a // b', false, false)).toBeNull();
        expect(toggleStep('🪜 ~~a~~ // ~~b~~', true, true)).toBeNull();
    });
});

describe('MultiStepTask - resetSteps()', () => {
    it('should reopen every step', () => {
        expect(resetSteps('Water 🪜 ~~a~~ // ~~b~~ #x // c')).toEqual('Water 🪜 a // b #x // c');
    });

    it('should leave descriptions without steps alone', () => {
        expect(resetSteps('Call ~~Bob~~ Alice')).toEqual('Call ~~Bob~~ Alice');
    });
});

describe('MultiStepTask - toggling tasks', () => {
    function toggle(line: string) {
        return fromLine({ line })
            .toggleWithRecurrenceInUsersOrder()
            .map((task) => task.toFileLineString());
    }

    function setStatus(line: string, status: Status) {
        return fromLine({ line })
            .handleNewStatusWithRecurrenceInUsersOrder(status)
            .map((task) => task.toFileLineString());
    }

    it('should advance one step per toggle, then complete the task', () => {
        const lines = [
            '- [ ] Renew passport 🪜 fill form // get photo // submit 📅 2026-10-30',
            '- [ ] Renew passport 🪜 ~~fill form~~ // get photo // submit 📅 2026-10-30',
            '- [ ] Renew passport 🪜 ~~fill form~~ // ~~get photo~~ // submit 📅 2026-10-30',
            '- [x] Renew passport 🪜 ~~fill form~~ // ~~get photo~~ // ~~submit~~ 📅 2026-10-30 ✅ 2026-10-17',
        ];
        for (let i = 1; i < lines.length; i++) {
            expect(toggle(lines[i - 1])).toEqual([lines[i]]);
        }
    });

    it('should complete a task with a horizon after its steps, keeping the horizon valid', () => {
        expect(toggle('- [ ] Renew 🪜 ~~a~~ // b 🔭 this week 📅 2026-10-30')).toEqual([
            '- [x] Renew 🪜 ~~a~~ // ~~b~~ 🔭 this week 📅 2026-10-30 ✅ 2026-10-17',
        ]);
    });

    it('should reopen the last step when un-checking', () => {
        expect(toggle('- [x] Renew 🪜 ~~a~~ // ~~b~~ 📅 2026-10-30 ✅ 2026-10-17')).toEqual([
            '- [ ] Renew 🪜 ~~a~~ // b 📅 2026-10-30',
        ]);
    });

    it('should keep an in-progress status while steps remain', () => {
        expect(toggle('- [/] Renew 🪜 a // b')).toEqual(['- [/] Renew 🪜 ~~a~~ // b']);
        expect(toggle('- [/] Renew 🪜 ~~a~~ // b')).toEqual(['- [x] Renew 🪜 ~~a~~ // ~~b~~ ✅ 2026-10-17']);
    });

    it('should leave the steps alone when the toggle goes to a status that is not done', () => {
        StatusRegistry.getInstance().add(Status.createFromImportedValue(['a', 'Status a', 'b', 'TODO']));
        StatusRegistry.getInstance().add(Status.createFromImportedValue(['b', 'Status b', 'x', 'IN_PROGRESS']));
        expect(toggle('- [a] Renew 🪜 one // two')).toEqual(['- [b] Renew 🪜 one // two']);
    });

    it('should keep the block link', () => {
        expect(toggle('- [ ] Renew 🪜 a // b ^abc')).toEqual(['- [ ] Renew 🪜 ~~a~~ // b ^abc']);
    });

    it('should not set a done date until the last step', () => {
        updateSettings({ setDoneDate: true });
        expect(toggle('- [ ] Renew 🪜 a // b')).toEqual(['- [ ] Renew 🪜 ~~a~~ // b']);
    });

    it('should start the next occurrence at step 1', () => {
        expect(toggle('- [ ] Water 🪜 ~~fill can~~ // water 🔁 every week 📅 2026-10-17')).toEqual([
            '- [ ] Water 🪜 fill can // water 🔁 every week 📅 2026-10-24',
            '- [x] Water 🪜 ~~fill can~~ // ~~water~~ 🔁 every week 📅 2026-10-17 ✅ 2026-10-17',
        ]);
    });

    it('should not create a new occurrence before the last step', () => {
        expect(toggle('- [ ] Water 🪜 fill can // water 🔁 every week 📅 2026-10-17')).toEqual([
            '- [ ] Water 🪜 ~~fill can~~ // water 🔁 every week 📅 2026-10-17',
        ]);
    });

    it('should not delete an "on completion: delete" task before the last step', () => {
        expect(toggle('- [ ] Renew 🪜 a // b 🏁 delete')).toEqual(['- [ ] Renew 🪜 ~~a~~ // b 🏁 delete']);
        expect(toggle('- [ ] Renew 🪜 ~~a~~ // b 🏁 delete')).toEqual([]);
    });

    it('should complete the whole task when the status is set, without touching the steps', () => {
        expect(setStatus('- [ ] Renew 🪜 ~~a~~ // b // c', Status.DONE)).toEqual([
            '- [x] Renew 🪜 ~~a~~ // b // c ✅ 2026-10-17',
        ]);
    });

    it('should start the next occurrence at step 1 when the status is set', () => {
        expect(setStatus('- [ ] Water 🪜 ~~fill can~~ // water 🔁 every week 📅 2026-10-17', Status.DONE)).toEqual([
            '- [ ] Water 🪜 fill can // water 🔁 every week 📅 2026-10-24',
            '- [x] Water 🪜 ~~fill can~~ // water 🔁 every week 📅 2026-10-17 ✅ 2026-10-17',
        ]);
    });

    it('should advance a step with the "Toggle task done" command', () => {
        expect(toggleLine('- [ ] Renew 🪜 a // b', 'a.md')).toEqual({
            text: '- [ ] Renew 🪜 ~~a~~ // b',
            moveTo: { line: 0 },
        });
    });

    it('should keep the standard fields readable by vanilla Tasks', () => {
        // The fork changes no serializer: what vanilla Tasks parses is what the fork parses.
        const task = fromLine({ line: '- [ ] Renew 🪜 ~~a~~ // b #home ⏫ 📅 2026-10-30' });
        expect(task.description).toEqual('Renew 🪜 ~~a~~ // b #home');
        expect(task.tags).toEqual(['#home']);
        expect(task.priority).toEqual('1');
        expect(task.dueDate).toEqualMoment(moment('2026-10-30'));
    });
});
