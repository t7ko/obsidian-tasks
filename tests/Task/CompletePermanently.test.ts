/**
 * t7 fork feature: complete permanently. Spec: fork-features/complete-permanently.md
 */
import moment from 'moment';
import { resetSettings, updateSettings } from '../../src/Config/Settings';
import { StatusConfiguration, StatusType } from '../../src/Statuses/StatusConfiguration';
import { StatusRegistry } from '../../src/Statuses/StatusRegistry';
import { canCompletePermanently, completePermanently } from '../../src/Task/CompletePermanently';
import { fromLine } from '../TestingTools/TestHelpers';

window.moment = moment;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27'));
});

afterEach(() => {
    vi.useRealTimers();
    resetSettings();
    StatusRegistry.getInstance().resetToDefaultStatuses();
});

function completedLine(line: string): string | null {
    return completePermanently(fromLine({ line }))?.toFileLineString() ?? null;
}

describe('canCompletePermanently', () => {
    it.each([
        '- [ ] Water plants 🔁 every day',
        '- [/] Water plants 🔁 every day 📅 2026-10-27',
        '- [ ] Water plants 🔁 every week when done 🏁 delete',
    ])('should be true for the open recurring task "%s"', (line: string) => {
        expect(canCompletePermanently(fromLine({ line }))).toEqual(true);
    });

    it.each([
        '- [ ] Call Bob 📅 2026-10-27',
        '- [x] Water plants 🔁 every day ✅ 2026-10-26',
        '- [-] Water plants 🔁 every day ❌ 2026-10-26',
    ])('should be false for "%s"', (line: string) => {
        expect(canCompletePermanently(fromLine({ line }))).toEqual(false);
        expect(completedLine(line)).toBeNull();
    });
});

describe('completePermanently', () => {
    it('should complete a recurring task without a next occurrence', () => {
        expect(completedLine('- [ ] Water plants 🔁 every day 📅 2026-10-27')).toEqual(
            '- [x] Water plants 🔁 every day 📅 2026-10-27 ✅ 2026-10-27',
        );
    });

    it('should keep the done task with 🏁 delete', () => {
        expect(completedLine('- [ ] Water plants 🔁 every day 🏁 delete 📅 2026-10-27')).toEqual(
            '- [x] Water plants 🔁 every day 🏁 delete 📅 2026-10-27 ✅ 2026-10-27',
        );
    });

    it('should complete a task recurring when done, which has no dates', () => {
        expect(completedLine('- [ ] Clean 🔁 every week when done')).toEqual(
            '- [x] Clean 🔁 every week when done ✅ 2026-10-27',
        );
    });

    it('should complete an in-progress task', () => {
        expect(completedLine('- [/] Water plants 🔁 every day')).toEqual(
            '- [x] Water plants 🔁 every day ✅ 2026-10-27',
        );
    });

    it('should keep everything else on the line, indentation, id and block link included', () => {
        expect(completedLine('    * [ ] Water plants 🆔 abc ⛔ def ⏫ 🔁 every day 📅 2026-10-27 ^water')).toEqual(
            '    * [x] Water plants 🆔 abc ⛔ def ⏫ 🔁 every day 📅 2026-10-27 ✅ 2026-10-27 ^water',
        );
    });

    it('should leave the steps of a multi-step task as they are', () => {
        expect(completedLine('- [ ] Review 🪜 ~~read~~ // reply 🔁 every week')).toEqual(
            '- [x] Review 🪜 ~~read~~ // reply 🔁 every week ✅ 2026-10-27',
        );
    });

    it('should not add a done date when the settings say not to', () => {
        updateSettings({ setDoneDate: false });
        expect(completedLine('- [ ] Water plants 🔁 every day')).toEqual('- [x] Water plants 🔁 every day');
    });

    it('should use the status a toggle gives, if it is a done status', () => {
        StatusRegistry.getInstance().add(new StatusConfiguration('!', 'Urgent', 'D', false, StatusType.TODO));
        StatusRegistry.getInstance().add(new StatusConfiguration('D', 'Did it', ' ', false, StatusType.DONE));

        expect(completedLine('- [!] Water plants 🔁 every day')).toEqual(
            '- [D] Water plants 🔁 every day ✅ 2026-10-27',
        );
    });

    it('should use the first done status, if a toggle gives no done status', () => {
        StatusRegistry.getInstance().add(new StatusConfiguration('!', 'Urgent', '?', false, StatusType.TODO));
        StatusRegistry.getInstance().add(new StatusConfiguration('?', 'Question', 'x', false, StatusType.TODO));

        expect(completedLine('- [!] Water plants 🔁 every day')).toEqual(
            '- [x] Water plants 🔁 every day ✅ 2026-10-27',
        );
    });
});
