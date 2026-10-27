/**
 * t7 fork feature: split tasks. Spec: fork-features/split-tasks.md
 */
import moment from 'moment';
import type { Editor, Menu, Plugin } from 'obsidian';
import { addSplitTaskItem, registerSplitTaskCommand, splitTaskLine } from '../../src/Commands/SplitTaskCommand';
import { GlobalFilter } from '../../src/Config/GlobalFilter';
import { fromLine } from '../TestingTools/TestHelpers';
import { NailMenu } from '../../src/ui/Menus/NailMenu';
import { TestableTaskSaver, menuToString } from '../ui/Menus/MenuTestingHelpers';

window.moment = moment;

afterEach(() => {
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

describe('splitTaskLine', () => {
    it('should split a task line', () => {
        expect(splitTaskLine('- [ ] Renew 🪜 a // b 📅 2026-10-30', 'a.md')).toEqual([
            '- [ ] Renew: a 📅 2026-10-30',
            '- [ ] Renew: b 📅 2026-10-30',
        ]);
    });

    it.each(['- [ ] Renew passport', 'a // b', '- a // b', ''])('should not split "%s"', (line: string) => {
        expect(splitTaskLine(line, 'a.md')).toBeNull();
    });

    it('should not split a checkbox without the global filter', () => {
        GlobalFilter.getInstance().set('#task');
        expect(splitTaskLine('- [ ] a // b', 'a.md')).toBeNull();
    });
});

describe('Split task in the editor menu', () => {
    it('should offer nothing on a task that does not split', () => {
        const { menu, items } = fakeMenu();
        addSplitTaskItem(menu, fakeEditor(['- [ ] Call Bob']).editor, 'a.md');

        expect(items).toEqual([]);
    });

    it('should replace the line with the cursor by the new tasks', () => {
        const { menu, items } = fakeMenu();
        const { editor, lines } = fakeEditor(['# Heading', '    - [ ] a // b ^x', 'next'], 1);
        addSplitTaskItem(menu, editor, 'a.md');

        expect(items.map((item) => [item.title, item.icon])).toEqual([['Split task', 'split']]);
        items[0].callback();
        expect(lines).toEqual(['# Heading', '    - [ ] a ^x', '    - [ ] b', 'next']);
    });
});

describe('Split task command', () => {
    function registeredCommand() {
        let command: any;
        const plugin = {
            addCommand: (c: unknown) => (command = c),
            registerEvent: () => {},
            app: { workspace: { on: () => ({}) } },
        };
        registerSplitTaskCommand(plugin as unknown as Plugin);
        return command;
    }

    it('should be offered only on a task that splits', () => {
        const command = registeredCommand();
        const ctx = { file: { path: 'a.md' } };

        expect(command.id).toEqual('split-task');
        expect(command.name).toEqual('Split task');
        expect(command.editorCheckCallback(true, fakeEditor(['- [ ] a']).editor, ctx)).toEqual(false);
        expect(command.editorCheckCallback(true, fakeEditor(['- [ ] a // b']).editor, ctx)).toEqual(true);
    });

    it('should split the task on the cursor line', () => {
        const command = registeredCommand();
        const { editor, lines } = fakeEditor(['- [ ] a // b'], 0);

        command.editorCheckCallback(false, editor, { file: null });
        expect(lines).toEqual(['- [ ] a', '- [ ] b']);
    });
});

describe('Split task in the rendered task menu', () => {
    beforeEach(() => {
        TestableTaskSaver.reset();
    });

    it('should not be offered for a task that does not split', () => {
        const menu = new NailMenu(fromLine({ line: '- [ ] Call Bob' }), TestableTaskSaver.testableTaskSaver);

        expect(menuToString(menu)).toEqual('\n  Add nail');
    });

    it('should end the menu and save the new tasks', async () => {
        const task = fromLine({ line: '- [ ] Renew 🪜 a // b' });
        const menu = new NailMenu(task, TestableTaskSaver.testableTaskSaver);
        expect(menuToString(menu)).toEqual('\n  Add nail\n  ---\n  Split task');

        // @ts-expect-error TS2339: Property 'items' does not exist on type 'NailMenu'.
        const item = menu.items.find((i: { title: string }) => i.title === 'Split task');
        await item.callback();

        expect(TestableTaskSaver.taskBeingOverwritten).toBe(task);
        expect(TestableTaskSaver.tasksBeingSaved?.map((t) => t.toFileLineString())).toEqual([
            '- [ ] Renew: a',
            '- [ ] Renew: b',
        ]);
    });
});
