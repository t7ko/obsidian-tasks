import type { Editor, Menu, Plugin } from 'obsidian';
import { addNailItems, registerNailCommands } from '../../src/Commands/NailCommands';

/**
 * An editor holding {@link lines}, with the cursor on line {@link cursorLine}; replaceRange() edits the lines.
 */
function fakeEditor(lines: string[], cursorLine = 0) {
    const editor = {
        getCursor: () => ({ line: cursorLine, ch: 0 }),
        getLine: (n: number) => lines[n],
        replaceRange: (text: string, from: { line: number; ch: number }, to: { line: number; ch: number }) => {
            const line = lines[from.line];
            lines[from.line] = line.slice(0, from.ch) + text + line.slice(to.ch);
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

describe('nail items in the editor menu', () => {
    it('should offer Add nail on a task line without nails', () => {
        const { menu, items } = fakeMenu();
        addNailItems(menu, fakeEditor(['- [ ] Call Bob']).editor);

        expect(items.map((item) => item.title)).toEqual(['Add nail']);
        expect(items[0].icon).toEqual('triangle-alert');
    });

    it('should offer Add nail and Remove nail on a task line with nails', () => {
        const { menu, items } = fakeMenu();
        addNailItems(menu, fakeEditor(['- [ ] ⚠️ Call Bob']).editor);

        expect(items.map((item) => item.title)).toEqual(['Add nail', 'Remove nail']);
    });

    it.each(['Call Bob', '- Call Bob', ''])('should offer nothing on "%s"', (line: string) => {
        const { menu, items } = fakeMenu();
        addNailItems(menu, fakeEditor([line]).editor);

        expect(items).toEqual([]);
    });

    it('should edit the line with the cursor', () => {
        const { menu, items } = fakeMenu();
        const { editor, lines } = fakeEditor(['# Heading', '- [ ] ⚠️ Call Bob 📅 2026-10-20'], 1);
        addNailItems(menu, editor);

        items[0].callback();
        expect(lines).toEqual(['# Heading', '- [ ] ⚠️⚠️ Call Bob 📅 2026-10-20']);

        items[1].callback();
        items[1].callback();
        expect(lines).toEqual(['# Heading', '- [ ] Call Bob 📅 2026-10-20']);
    });
});

describe('nail commands', () => {
    type CheckCallback = (checking: boolean, editor: Editor) => boolean;

    function registeredCommands() {
        const commands: { id: string; name: string; editorCheckCallback: CheckCallback }[] = [];
        const events: string[] = [];
        const plugin = {
            addCommand: (command: { id: string; name: string; editorCheckCallback: CheckCallback }) =>
                commands.push(command),
            registerEvent: () => {},
            app: {
                workspace: {
                    on: (name: string) => events.push(name),
                },
            },
        };
        registerNailCommands(plugin as unknown as Plugin);
        return { commands, events };
    }

    it('should register the commands and the editor menu', () => {
        const { commands, events } = registeredCommands();

        expect(commands.map((command) => [command.id, command.name])).toEqual([
            ['add-nail', 'Add nail'],
            ['remove-nail', 'Remove nail'],
        ]);
        expect(events).toEqual(['editor-menu']);
    });

    it('should be available only where they can edit', () => {
        const [addCommand, removeCommand] = registeredCommands().commands;

        expect(addCommand.editorCheckCallback(true, fakeEditor(['- [ ] Call Bob']).editor)).toEqual(true);
        expect(addCommand.editorCheckCallback(true, fakeEditor(['Call Bob']).editor)).toEqual(false);
        expect(removeCommand.editorCheckCallback(true, fakeEditor(['- [ ] Call Bob']).editor)).toEqual(false);
        expect(removeCommand.editorCheckCallback(true, fakeEditor(['- [ ] ⚠️ Call Bob']).editor)).toEqual(true);
    });

    it('should edit only when run, not when checked', () => {
        const [addCommand] = registeredCommands().commands;
        const { editor, lines } = fakeEditor(['- [ ] Call Bob']);

        addCommand.editorCheckCallback(true, editor);
        expect(lines).toEqual(['- [ ] Call Bob']);

        addCommand.editorCheckCallback(false, editor);
        expect(lines).toEqual(['- [ ] ⚠️ Call Bob']);
    });
});
