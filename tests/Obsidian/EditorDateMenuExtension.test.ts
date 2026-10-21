import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import moment from 'moment';
import { Menu } from 'obsidian';
import { GlobalFilter } from '../../src/Config/GlobalFilter';
import { resetSettings, updateSettings } from '../../src/Config/Settings';
import { dateFieldsInLine, editorDateMenuExtension, editorTaskSaver } from '../../src/Obsidian/EditorDateMenuExtension';
import { Task } from '../../src/Task/Task';
import { EditorDateMenu, PICK_A_DATE_TITLE } from '../../src/ui/Menus/EditorDateMenu';
import type { MenuItem } from '../__mocks__/obsidian';

window.moment = moment;

// The mock Menu has no showAtPosition(), so add one that records the menus that would be shown.
const showAtPosition = vi.fn();

beforeEach(() => {
    Menu.prototype.showAtPosition = showAtPosition;
    showAtPosition.mockClear();
});

afterEach(() => {
    // @ts-expect-error TS2790: The operand of a 'delete' operator must be optional.
    delete Menu.prototype.showAtPosition;
    GlobalFilter.getInstance().reset();
    resetSettings();
});

function datesIn(line: string) {
    const found = dateFieldsInLine(line);
    if (found === null) {
        return null;
    }
    return found.dateFields.map(({ field, from, to }) => `${field}: ${line.slice(from, to)}`);
}

describe('dateFieldsInLine', () => {
    it('should find every date of a task, in line order', () => {
        const line =
            '- [x] Call Bob ➕ 2026-10-01 🛫 2026-10-21 ⏳ 2026-10-22 📅 2026-10-24 ❌ 2026-10-25 ✅ 2026-10-26';
        expect(datesIn(line)).toEqual([
            'createdDate: ➕ 2026-10-01',
            'startDate: 🛫 2026-10-21',
            'scheduledDate: ⏳ 2026-10-22',
            'dueDate: 📅 2026-10-24',
            'cancelledDate: ❌ 2026-10-25',
            'doneDate: ✅ 2026-10-26',
        ]);
    });

    it('should give columns in the line, with its indentation', () => {
        const line = '    - [ ] Call Bob 🛫 2026-10-21';
        const found = dateFieldsInLine(line);
        expect(found?.dateFields).toEqual([{ field: 'startDate', from: 19, to: 19 + '🛫 2026-10-21'.length }]);
    });

    it('should find the field, not the same text in the description', () => {
        const line = '- [ ] Read 📅 2026-10-24 notes 📅 2026-10-24';
        const found = dateFieldsInLine(line);
        expect(found?.dateFields).toEqual([{ field: 'dueDate', from: line.lastIndexOf('📅'), to: line.length }]);
    });

    it('should find no date in a description that is followed by text', () => {
        expect(datesIn('- [ ] 📅 2026-10-24 is the deadline')).toEqual([]);
    });

    it('should find dates followed by tags and a block link', () => {
        expect(datesIn('- [ ] Call Bob 📅 2026-10-24 #work 🛫 2026-10-21 ^abc123')).toEqual([
            'dueDate: 📅 2026-10-24',
            'startDate: 🛫 2026-10-21',
        ]);
    });

    it('should find dates with variation selectors and without spaces', () => {
        expect(datesIn('- [ ] Call Bob ⏳️2026-10-22 📆 2026-10-24')).toEqual([
            'scheduledDate: ⏳️2026-10-22',
            'dueDate: 📆 2026-10-24',
        ]);
    });

    it('should find dates in a task in a quote', () => {
        expect(datesIn('> - [ ] Call Bob 🛫 2026-10-21')).toEqual(['startDate: 🛫 2026-10-21']);
    });

    it('should return null for lines that are not tasks', () => {
        expect(dateFieldsInLine('Call Bob 🛫 2026-10-21')).toBeNull();
        expect(dateFieldsInLine('- Call Bob 🛫 2026-10-21')).toBeNull();
    });

    it('should return null for a task without the global filter', () => {
        GlobalFilter.getInstance().set('#task');
        expect(dateFieldsInLine('- [ ] Call Bob 🛫 2026-10-21')).toBeNull();
        expect(datesIn('- [ ] #task Call Bob 🛫 2026-10-21')).toEqual(['startDate: 🛫 2026-10-21']);
    });

    it('should find dates in the Dataview format', () => {
        updateSettings({ taskFormat: 'dataview' });
        expect(datesIn('- [ ] Call Bob [start:: 2026-10-21]  (due:: 2026-10-24)')).toEqual([
            'startDate: [start:: 2026-10-21]',
            'dueDate: (due:: 2026-10-24)',
        ]);
    });
});

describe('editorTaskSaver', () => {
    const line = '- [ ] Call Bob 📅 2026-10-24';

    function viewWith(doc: string) {
        return new EditorView({ doc });
    }

    function taskFrom(text: string) {
        return dateFieldsInLine(text)!.task;
    }

    function withDueDate(task: Task, date: string) {
        return new Task({ ...task, dueDate: moment(date) });
    }

    it('should replace the line', async () => {
        const view = viewWith(['# Plan', line, 'after'].join('\n'));
        const task = taskFrom(line);

        await editorTaskSaver(view, 2, line)(task, [withDueDate(task, '2026-10-25')]);

        expect(view.state.doc.toString()).toEqual(['# Plan', '- [ ] Call Bob 📅 2026-10-25', 'after'].join('\n'));
    });

    it('should leave the line alone when the task is unchanged', async () => {
        // Not the canonical text, which a rewrite would change.
        const text = '- [ ] Call Bob   📅 2026-10-24';
        const view = viewWith(text);
        const task = taskFrom(text);

        await editorTaskSaver(view, 1, text)(task, [task]);

        expect(view.state.doc.toString()).toEqual(text);
    });

    it('should find the line after lines were added above it', async () => {
        const view = viewWith(['# Plan', line].join('\n'));
        const task = taskFrom(line);
        const saver = editorTaskSaver(view, 2, line);
        view.dispatch({ changes: { from: 0, insert: 'new line\n' } });

        await saver(task, withDueDate(task, '2026-10-25'));

        expect(view.state.doc.toString()).toEqual(['new line', '# Plan', '- [ ] Call Bob 📅 2026-10-25'].join('\n'));
    });

    it('should change nothing when the line was edited meanwhile', async () => {
        const view = viewWith(line);
        const task = taskFrom(line);
        const saver = editorTaskSaver(view, 1, line);
        view.dispatch({ changes: { from: line.length, insert: ' #work' } });

        await saver(task, withDueDate(task, '2026-10-25'));

        expect(view.state.doc.toString()).toEqual(line + ' #work');
    });

    it('should change nothing when the line moved and two lines match it', async () => {
        const view = viewWith(['# Plan', line, 'between', line].join('\n'));
        const task = taskFrom(line);
        const saver = editorTaskSaver(view, 2, line);
        view.dispatch({ changes: { from: 0, insert: 'new line\n' } });

        await saver(task, withDueDate(task, '2026-10-25'));

        expect(view.state.doc.toString()).toEqual(['new line', '# Plan', line, 'between', line].join('\n'));
    });
});

describe('editorDateMenuExtension', () => {
    const line = '- [ ] Call Bob 🛫 2026-10-21 📅 2026-10-24';
    const lineStart = '# Plan\n'.length;
    const startColumn = line.indexOf('🛫');
    const dueColumn = line.indexOf('📅');

    // jsdom has no layout: give every text range one box, which the mouse is over.
    const box = { left: 0, right: 50, top: 0, bottom: 20, width: 50, height: 20, x: 0, y: 0 } as DOMRect;
    const mouse = { clientX: 10, clientY: 10 };

    let view: EditorView;

    function newView(...extensions: Extension[]) {
        const editorView = new EditorView({
            doc: ['# Plan', line].join('\n'),
            extensions: [editorDateMenuExtension(), ...extensions],
        });
        document.body.appendChild(editorView.dom);
        return editorView;
    }

    beforeEach(() => {
        Range.prototype.getClientRects = () => [box] as unknown as DOMRectList;
        Range.prototype.getBoundingClientRect = () => box;
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        vi.setSystemTime(new Date('2026-10-21'));
        view = newView();
    });

    afterEach(() => {
        view.destroy();
        view.dom.remove();
        document.body.querySelectorAll('.flatpickr-calendar').forEach((element) => element.remove());
        vi.useRealTimers();
        // @ts-expect-error TS2790: The operand of a 'delete' operator must be optional.
        delete Range.prototype.getClientRects;
        // @ts-expect-error TS2790: The operand of a 'delete' operator must be optional.
        delete Range.prototype.getBoundingClientRect;
    });

    function lineElement(index: number) {
        return view.contentDOM.querySelectorAll('.cm-line')[index] as HTMLElement;
    }

    // jsdom has no layout, so tell the editor which position the mouse is at.
    function rightClickAt(pos: number | null, target: Element = lineElement(1), at = mouse) {
        vi.spyOn(view, 'posAtCoords').mockReturnValue(pos as number);
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ...at });
        target.dispatchEvent(event);
        return event;
    }

    function shownMenus(): Menu[] {
        return showAtPosition.mock.contexts as Menu[];
    }

    function itemStartingWith(menu: Menu, title: string): MenuItem {
        // @ts-expect-error TS2339: Property 'items' does not exist on type 'Menu'.
        const items: MenuItem[] = menu.items;
        const item = items.find((menuItem) => menuItem.title.toString().startsWith(title));
        expect(item).toBeDefined();
        return item!;
    }

    it('should open the date menu for the date right-clicked, instead of the editor menu', () => {
        const event = rightClickAt(lineStart + dueColumn + 3);

        expect(event.defaultPrevented).toEqual(true);
        expect(shownMenus().length).toEqual(1);
        expect(shownMenus()[0]).toBeInstanceOf(EditorDateMenu);
        expect(itemStartingWith(shownMenus()[0], 'Due tomorrow').title).toEqual('Due tomorrow, on Thu 22nd Oct');
    });

    it('should open the menu at both ends of a date', () => {
        rightClickAt(lineStart + startColumn);
        rightClickAt(lineStart + startColumn + '🛫 2026-10-21'.length);

        expect(shownMenus().length).toEqual(2);
        expect(itemStartingWith(shownMenus()[0], 'Start tomorrow')).toBeDefined();
        expect(itemStartingWith(shownMenus()[1], 'Start tomorrow')).toBeDefined();
    });

    it('should leave right-clicks elsewhere to Obsidian', () => {
        const onDescription = rightClickAt(lineStart + 10);
        const onHeading = rightClickAt(2, lineElement(0));
        const outsideText = rightClickAt(null);
        const afterLineEnd = rightClickAt(lineStart + line.length, lineElement(1), { clientX: 200, clientY: 10 });

        expect(onDescription.defaultPrevented).toEqual(false);
        expect(onHeading.defaultPrevented).toEqual(false);
        expect(outsideText.defaultPrevented).toEqual(false);
        expect(afterLineEnd.defaultPrevented).toEqual(false);
        expect(shownMenus().length).toEqual(0);
    });

    it('should leave right-clicks in selected text to Obsidian', () => {
        const pos = lineStart + dueColumn + 3;
        view.dispatch({ selection: { anchor: pos - 5, head: pos + 5 } });

        const event = rightClickAt(pos);

        expect(event.defaultPrevented).toEqual(false);
        expect(shownMenus().length).toEqual(0);
    });

    it('should leave right-clicks in a read-only editor to Obsidian', () => {
        view.destroy();
        view.dom.remove();
        view = newView(EditorState.readOnly.of(true));

        const event = rightClickAt(lineStart + dueColumn + 3);

        expect(event.defaultPrevented).toEqual(false);
        expect(shownMenus().length).toEqual(0);
    });

    it('should write the date chosen into the editor', async () => {
        rightClickAt(lineStart + startColumn + 3);

        await itemStartingWith(shownMenus()[0], 'Start tomorrow').callback(new MouseEvent('click'));

        expect(view.state.doc.line(2).text).toEqual('- [ ] Call Bob 🛫 2026-10-22 📅 2026-10-24');
    });

    it('should open the calendar for Pick a date, and write its Today button into the editor', async () => {
        rightClickAt(lineStart + dueColumn + 3);

        itemStartingWith(shownMenus()[0], PICK_A_DATE_TITLE).callback(new MouseEvent('click'));
        vi.runAllTimers();

        // promptForDate adds Clear, then Today. (The test createEl() doesn't set their text.)
        const buttons = document.body.querySelectorAll<HTMLElement>('.flatpickr-calendar .flatpickr-button');
        expect(buttons.length).toEqual(2);
        buttons[1].click();

        await vi.waitFor(() =>
            expect(view.state.doc.line(2).text).toEqual('- [ ] Call Bob 🛫 2026-10-21 📅 2026-10-21'),
        );
        // The element the calendar was placed by is gone with it.
        expect(document.body.querySelectorAll('body > span').length).toEqual(0);
    });
});
