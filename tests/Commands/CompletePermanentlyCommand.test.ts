/**
 * t7 fork feature: complete permanently. Spec: fork-features/complete-permanently.md
 */
import moment from 'moment';
import type { Editor, Menu, Plugin } from 'obsidian';
import {
    addCompletePermanentlyItem,
    completePermanentlyLine,
    registerCompletePermanentlyCommand,
} from '../../src/Commands/CompletePermanentlyCommand';
import { GlobalFilter } from '../../src/Config/GlobalFilter';
import { resetSettings, updateSettings } from '../../src/Config/Settings';
import { StatusRegistry } from '../../src/Statuses/StatusRegistry';
import { NailMenu } from '../../src/ui/Menus/NailMenu';
import { StatusMenu } from '../../src/ui/Menus/StatusMenu';
import { fromLine } from '../TestingTools/TestHelpers';
import { TestableTaskSaver, menuToString } from '../ui/Menus/MenuTestingHelpers';

window.moment = moment;

const recurring = '- [ ] Water plants 🔁 every day 🏁 delete 📅 2026-10-27';
const completed = '- [x] Water plants 🔁 every day 🏁 delete 📅 2026-10-27 ✅ 2026-10-27';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27'));
    TestableTaskSaver.reset();
});

afterEach(() => {
    vi.useRealTimers();
    resetSettings();
    GlobalFilter.getInstance().reset();
});

/**
 * An editor holding {@link lines}, with the cursor on line {@link cursorLine}; replaceRange() edits the lines.
 */
function fakeEditor(lines: string[], cursorLine = 0) {
    const editor = {
        getCursor: () => ({ line: cursorLine, ch: 0 }),
        getLine: (n: number) => lines[n],
        replaceRange: (text: string, from: { line: number; ch: number }, to: { line: number; ch: number }) => {
            const line = lines[from.line];
            lines.splice(from.line, 1, ...(line.slice(0, from.ch) + text + line.slice(to.ch)).split('\n'));
        },
    };
    return { editor: editor as unknown as Editor, lines };
}

interface FakeItem {
    title: string;
    icon: string;
    callback: () => void;
}

function fakeMenu() {
    const items: FakeItem[] = [];
    const menu = {
        addItem: (cb: (item: unknown) => void) => {
            const item: FakeItem = { title: '', icon: '', callback: () => {} };
            const builder = {
                setTitle: (title: string) => ((item.title = title), builder),
                setIcon: (icon: string) => ((item.icon = icon), builder),
                onClick: (callback: () => void) => ((item.callback = callback), builder),
            };
            cb(builder);
            items.push(item);
            return menu;
        },
    };
    return { menu: menu as unknown as Menu, items };
}

async function clickItem(menu: Menu, title: string) {
    // @ts-expect-error TS2339: Property 'items' does not exist on type 'Menu'.
    const item = menu.items.find((i: { title: string }) => i.title === title);
    await item.callback();
}

describe('completePermanentlyLine', () => {
    it('should complete a recurring task line', () => {
        expect(completePermanentlyLine(recurring, 'a.md')).toEqual(completed);
    });

    it.each(['- [ ] Call Bob', '- [x] Water plants 🔁 every day', '- Water plants 🔁 every day', ''])(
        'should not complete "%s"',
        (line: string) => {
            expect(completePermanentlyLine(line, 'a.md')).toBeNull();
        },
    );

    it('should not complete a checkbox without the global filter', () => {
        GlobalFilter.getInstance().set('#task');
        expect(completePermanentlyLine(recurring, 'a.md')).toBeNull();
    });
});

describe('Complete permanently in the editor menu', () => {
    it('should offer nothing on a task that does not recur', () => {
        const { menu, items } = fakeMenu();
        addCompletePermanentlyItem(menu, fakeEditor(['- [ ] Call Bob']).editor, 'a.md');

        expect(items).toEqual([]);
    });

    it('should replace the line with the cursor by the done task only', () => {
        const { menu, items } = fakeMenu();
        const { editor, lines } = fakeEditor(['# Heading', recurring, 'next'], 1);
        addCompletePermanentlyItem(menu, editor, 'a.md');

        expect(items.map((item) => [item.title, item.icon])).toEqual([['Complete permanently', 'check-check']]);
        items[0].callback();
        expect(lines).toEqual(['# Heading', completed, 'next']);
    });
});

describe('Complete permanently command', () => {
    function registeredCommand() {
        let command: any;
        const plugin = {
            addCommand: (c: unknown) => (command = c),
            registerEvent: () => {},
            app: { workspace: { on: () => ({}) } },
        };
        registerCompletePermanentlyCommand(plugin as unknown as Plugin);
        return command;
    }

    it('should be offered only on a recurring task', () => {
        const command = registeredCommand();
        const ctx = { file: { path: 'a.md' } };

        expect(command.id).toEqual('complete-permanently');
        expect(command.name).toEqual('Complete permanently');
        expect(command.editorCheckCallback(true, fakeEditor(['- [ ] Call Bob']).editor, ctx)).toEqual(false);
        expect(command.editorCheckCallback(true, fakeEditor([recurring]).editor, ctx)).toEqual(true);
    });

    it('should complete the task on the cursor line', () => {
        const command = registeredCommand();
        const { editor, lines } = fakeEditor(['a', recurring], 1);

        command.editorCheckCallback(false, editor, { file: null });
        expect(lines).toEqual(['a', completed]);
    });
});

describe('Complete permanently in the status menu', () => {
    it('should not be offered for a task that does not recur', () => {
        const menu = new StatusMenu(new StatusRegistry(), fromLine({ line: '- [ ] Call Bob' }));

        expect(menuToString(menu)).not.toContain('Complete permanently');
    });

    it('should not be offered for a done recurring task', () => {
        const task = fromLine({ line: '- [x] Water plants 🔁 every day' });
        const menu = new StatusMenu(new StatusRegistry(), task);

        expect(menuToString(menu)).not.toContain('Complete permanently');
    });

    it('should end the menu and save only the done task', async () => {
        const task = fromLine({ line: recurring });
        const menu = new StatusMenu(new StatusRegistry(), task, TestableTaskSaver.testableTaskSaver);
        expect(menuToString(menu)).toMatchInlineSnapshot(`
            "
            x Change status to: [ ] Todo
              Change status to: [x] Done
              Change status to: [/] In Progress
              Change status to: [-] Cancelled
              ---
              Complete permanently"
        `);

        await clickItem(menu, 'Complete permanently');

        expect(TestableTaskSaver.taskBeingOverwritten).toBe(task);
        expect(TestableTaskSaver.tasksBeingSaved?.map((t) => t.toFileLineString())).toEqual([completed]);
    });

    it('should save only the done task with the next occurrence on the next line', async () => {
        updateSettings({ recurrenceOnNextLine: true });
        const task = fromLine({ line: '- [ ] Water plants 🔁 every day 📅 2026-10-27' });
        const menu = new StatusMenu(new StatusRegistry(), task, TestableTaskSaver.testableTaskSaver);

        await clickItem(menu, 'Complete permanently');

        expect(TestableTaskSaver.tasksBeingSaved?.map((t) => t.toFileLineString())).toEqual([
            '- [x] Water plants 🔁 every day 📅 2026-10-27 ✅ 2026-10-27',
        ]);
    });
});

describe('Complete permanently in the rendered task menu', () => {
    it('should not be offered for a task that does not recur', () => {
        const menu = new NailMenu(fromLine({ line: '- [ ] Call Bob' }), TestableTaskSaver.testableTaskSaver);

        expect(menuToString(menu)).toEqual('\n  Add nail');
    });

    it('should end the menu and save only the done task', async () => {
        const task = fromLine({ line: recurring });
        const menu = new NailMenu(task, TestableTaskSaver.testableTaskSaver);
        expect(menuToString(menu)).toEqual('\n  Add nail\n  ---\n  Complete permanently');

        await clickItem(menu, 'Complete permanently');

        expect(TestableTaskSaver.taskBeingOverwritten).toBe(task);
        expect(TestableTaskSaver.tasksBeingSaved?.map((t) => t.toFileLineString())).toEqual([completed]);
    });
});
