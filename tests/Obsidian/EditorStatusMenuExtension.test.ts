import { EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import moment from 'moment';
import { Menu } from 'obsidian';
import { GlobalFilter } from '../../src/Config/GlobalFilter';
import { resetSettings } from '../../src/Config/Settings';
import { checkboxInLine, editorStatusMenuExtension } from '../../src/Obsidian/EditorStatusMenuExtension';
import { StatusMenu } from '../../src/ui/Menus/StatusMenu';
import type { MenuItem } from '../__mocks__/obsidian';
import { menuToString } from '../ui/Menus/MenuTestingHelpers';

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

function checkboxTextIn(line: string) {
    const found = checkboxInLine(line);
    return found === null ? null : line.slice(found.from, found.to);
}

describe('checkboxInLine', () => {
    it('should find the checkbox of a task', () => {
        const line = '- [ ] Call Bob [x]';
        expect(checkboxInLine(line)).toMatchObject({ from: 2, to: 5 });
        expect(checkboxInLine(line)?.task.description).toEqual('Call Bob [x]');
    });

    it('should find the checkbox after indentation, quotes and other list markers', () => {
        expect(checkboxTextIn('    * [/] Call Bob')).toEqual('[/]');
        expect(checkboxTextIn('> > 12. [x] Call Bob')).toEqual('[x]');
        expect(checkboxTextIn('+   [-] Call Bob')).toEqual('[-]');
        expect(checkboxInLine('> > 12. [x] Call Bob')).toMatchObject({ from: 8, to: 11 });
    });

    it('should count a status symbol outside the BMP as one character', () => {
        expect(checkboxTextIn('- [🔥] Call Bob')).toEqual('[🔥]');
    });

    it('should return null for lines that are not tasks', () => {
        expect(checkboxInLine('[ ] Call Bob')).toBeNull();
        expect(checkboxInLine('- Call Bob [ ]')).toBeNull();
    });

    it('should return null for a task without the global filter', () => {
        GlobalFilter.getInstance().set('#task');
        expect(checkboxInLine('- [ ] Call Bob')).toBeNull();
        expect(checkboxTextIn('- [ ] #task Call Bob')).toEqual('[ ]');
    });
});

/**
 * Stands for Live Preview's checkbox, which replaces the line's `- [ ] `.
 */
class CheckboxWidget extends WidgetType {
    toDOM() {
        const label = document.createElement('label');
        label.className = 'task-list-label';
        label.setAttribute('contenteditable', 'false');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'task-list-item-checkbox';
        label.appendChild(input);
        return label;
    }
}

describe('editorStatusMenuExtension', () => {
    const line = '- [ ] Call Bob 📅 2026-10-24';
    const lineStart = '# Plan\n'.length;
    const checkboxColumn = 2;

    // jsdom has no layout: give every text range one box, which the mouse is over.
    const box = { left: 0, right: 50, top: 0, bottom: 20, width: 50, height: 20, x: 0, y: 0 } as DOMRect;
    const mouse = { clientX: 10, clientY: 10 };

    let view: EditorView;

    function newView(doc: string[], ...extensions: Extension[]) {
        const editorView = new EditorView({
            doc: doc.join('\n'),
            extensions: [editorStatusMenuExtension(), ...extensions],
        });
        document.body.appendChild(editorView.dom);
        return editorView;
    }

    function replaceView(doc: string[], ...extensions: Extension[]) {
        view.destroy();
        view.dom.remove();
        view = newView(doc, ...extensions);
    }

    // Live Preview's checkboxes, over the `- [ ] ` of each line from `from`.
    function checkboxesAt(...from: number[]) {
        const widget = Decoration.replace({ widget: new CheckboxWidget() });
        return EditorView.decorations.of(Decoration.set(from.map((pos) => widget.range(pos, pos + '- [ ] '.length))));
    }

    beforeEach(() => {
        Range.prototype.getClientRects = () => [box] as unknown as DOMRectList;
        Range.prototype.getBoundingClientRect = () => box;
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-27'));
        view = newView(['# Plan', line]);
    });

    afterEach(() => {
        view.destroy();
        view.dom.remove();
        vi.useRealTimers();
        // @ts-expect-error TS2790: The operand of a 'delete' operator must be optional.
        delete Range.prototype.getClientRects;
        // @ts-expect-error TS2790: The operand of a 'delete' operator must be optional.
        delete Range.prototype.getBoundingClientRect;
    });

    function lineElement(index: number) {
        return view.contentDOM.querySelectorAll('.cm-line')[index] as HTMLElement;
    }

    function rightClick(target: Element, at = mouse) {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ...at });
        target.dispatchEvent(event);
        return event;
    }

    // jsdom has no layout, so tell the editor which position the mouse is at.
    function rightClickAt(pos: number | null, target: Element = lineElement(1), at = mouse) {
        vi.spyOn(view, 'posAtCoords').mockReturnValue(pos as number);
        return rightClick(target, at);
    }

    function shownMenus(): Menu[] {
        return showAtPosition.mock.contexts as Menu[];
    }

    function item(menu: Menu, title: string): MenuItem {
        // @ts-expect-error TS2339: Property 'items' does not exist on type 'Menu'.
        const items: MenuItem[] = menu.items;
        const found = items.find((menuItem) => menuItem.title === title);
        expect(found).toBeDefined();
        return found!;
    }

    describe('in Source mode', () => {
        it('should open the status menu for a right-click on the checkbox, instead of the editor menu', () => {
            const event = rightClickAt(lineStart + checkboxColumn + 1);

            expect(event.defaultPrevented).toEqual(true);
            expect(shownMenus().length).toEqual(1);
            expect(shownMenus()[0]).toBeInstanceOf(StatusMenu);
            expect(menuToString(shownMenus()[0])).toMatchInlineSnapshot(`
                "
                x Change status to: [ ] Todo
                  Change status to: [x] Done
                  Change status to: [/] In Progress
                  Change status to: [-] Cancelled"
            `);
        });

        it('should open the menu at both ends of the checkbox', () => {
            rightClickAt(lineStart + checkboxColumn);
            rightClickAt(lineStart + checkboxColumn + '[ ]'.length);

            expect(shownMenus().length).toEqual(2);
        });

        it('should leave right-clicks elsewhere to Obsidian', () => {
            const onListMarker = rightClickAt(lineStart);
            const onDescription = rightClickAt(lineStart + 10);
            const onHeading = rightClickAt(2, lineElement(0));
            const outsideText = rightClickAt(null);
            const besideCheckbox = rightClickAt(lineStart + checkboxColumn, lineElement(1), {
                clientX: 200,
                clientY: 10,
            });

            for (const event of [onListMarker, onDescription, onHeading, outsideText, besideCheckbox]) {
                expect(event.defaultPrevented).toEqual(false);
            }
            expect(shownMenus().length).toEqual(0);
        });

        it('should leave a checkbox in a line that is not a task to Obsidian', () => {
            GlobalFilter.getInstance().set('#task');

            const event = rightClickAt(lineStart + checkboxColumn + 1);

            expect(event.defaultPrevented).toEqual(false);
            expect(shownMenus().length).toEqual(0);
        });

        it('should leave right-clicks in selected text to Obsidian', () => {
            view.dispatch({ selection: { anchor: lineStart, head: lineStart + 10 } });

            const event = rightClickAt(lineStart + checkboxColumn + 1);

            expect(event.defaultPrevented).toEqual(false);
            expect(shownMenus().length).toEqual(0);
        });

        it('should leave right-clicks in a read-only editor to Obsidian', () => {
            replaceView(['# Plan', line], EditorState.readOnly.of(true));

            const event = rightClickAt(lineStart + checkboxColumn + 1);

            expect(event.defaultPrevented).toEqual(false);
            expect(shownMenus().length).toEqual(0);
        });

        it('should leave events already handled alone', () => {
            const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ...mouse });
            event.preventDefault();
            vi.spyOn(view, 'posAtCoords').mockReturnValue(lineStart + checkboxColumn + 1);

            lineElement(1).dispatchEvent(event);

            expect(shownMenus().length).toEqual(0);
        });

        it('should write the status chosen into the editor', async () => {
            rightClickAt(lineStart + checkboxColumn + 1);

            await item(shownMenus()[0], 'Change status to: [x] Done').callback(new MouseEvent('click'));

            expect(view.state.doc.toString()).toEqual(
                ['# Plan', '- [x] Call Bob 📅 2026-10-24 ✅ 2026-10-27'].join('\n'),
            );
        });

        it('should write both lines of a recurring task', async () => {
            const recurring = '- [ ] Water plants 🔁 every day 📅 2026-10-27';
            replaceView(['# Plan', recurring, 'after']);
            rightClickAt(lineStart + checkboxColumn + 1);

            await item(shownMenus()[0], 'Change status to: [x] Done').callback(new MouseEvent('click'));

            expect(view.state.doc.toString()).toEqual(
                [
                    '# Plan',
                    '- [ ] Water plants 🔁 every day 📅 2026-10-28',
                    '- [x] Water plants 🔁 every day 📅 2026-10-27 ✅ 2026-10-27',
                    'after',
                ].join('\n'),
            );
        });
    });

    describe('in Live Preview', () => {
        function checkboxElements() {
            return view.contentDOM.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox');
        }

        it('should open the status menu for a right-click on the checkbox', async () => {
            replaceView(['# Plan', line], checkboxesAt(lineStart));
            expect(checkboxElements().length).toEqual(1);

            const event = rightClick(checkboxElements()[0]);

            expect(event.defaultPrevented).toEqual(true);
            expect(shownMenus().length).toEqual(1);
            expect(shownMenus()[0]).toBeInstanceOf(StatusMenu);

            await item(shownMenus()[0], 'Change status to: [/] In Progress').callback(new MouseEvent('click'));
            expect(view.state.doc.line(2).text).toEqual('- [/] Call Bob 📅 2026-10-24');
        });

        it('should find the line of the checkbox among several', async () => {
            const second = '- [-] Call Alice';
            replaceView(['# Plan', line, second], checkboxesAt(lineStart, lineStart + line.length + 1));

            rightClick(checkboxElements()[1]);
            await item(shownMenus()[0], 'Change status to: [ ] Todo').callback(new MouseEvent('click'));

            expect(view.state.doc.line(2).text).toEqual(line);
            expect(view.state.doc.line(3).text).toEqual('- [ ] Call Alice');
        });

        it('should leave a checkbox that is not at the start of a task line to Obsidian', () => {
            // As in rendered blocks (callouts, tables, embeds), where the element's position is the block's start.
            const text = '- [ ] Call Bob - [ ] later';
            replaceView(['# Plan', text], checkboxesAt(lineStart + text.lastIndexOf('- [ ]')));
            expect(checkboxInLine(text)).not.toBeNull();

            const event = rightClick(checkboxElements()[0]);

            expect(event.defaultPrevented).toEqual(false);
            expect(shownMenus().length).toEqual(0);
        });

        it('should leave other parts of the line to Obsidian', () => {
            replaceView(['# Plan', line], checkboxesAt(lineStart));

            const event = rightClickAt(lineStart + 10);

            expect(event.defaultPrevented).toEqual(false);
            expect(shownMenus().length).toEqual(0);
        });
    });
});
