import moment from 'moment';
import { Menu } from 'obsidian';
import { QueryLayoutOptions } from '../../src/Layout/QueryLayoutOptions';
import { TaskLayoutOptions } from '../../src/Layout/TaskLayoutOptions';
import { addNailMenuTargets } from '../../src/Renderer/NailMenuTargets';
import { TaskLineRenderer } from '../../src/Renderer/TaskLineRenderer';
import type { Task } from '../../src/Task/Task';
import { DateMenu } from '../../src/ui/Menus/DateMenu';
import { HorizonMenu } from '../../src/ui/Menus/HorizonMenu';
import { NailMenu, PriorityMenuWithNails } from '../../src/ui/Menus/NailMenu';
import { StatusMenu } from '../../src/ui/Menus/StatusMenu';
import { TaskBuilder } from '../TestingTools/TaskBuilder';
import { fromLine } from '../TestingTools/TestHelpers';
import { TestableTaskSaver, menuToString } from '../ui/Menus/MenuTestingHelpers';
import { mockApp } from '../__mocks__/obsidian';
import { mockHTMLRenderer } from './RenderingTestHelpers';

window.moment = moment;

// The mock Menu has no showAtPosition(), so add one that records the menus that would be shown.
const showAtPosition = vi.fn();

beforeEach(() => {
    Menu.prototype.showAtPosition = showAtPosition;
    showAtPosition.mockClear();
    TestableTaskSaver.reset();
});

afterEach(() => {
    // @ts-expect-error TS2790: The operand of a 'delete' operator must be optional.
    delete Menu.prototype.showAtPosition;
    document.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
});

function shownMenus(): Menu[] {
    return showAtPosition.mock.contexts as Menu[];
}

function shownMenuClasses() {
    return shownMenus().map((menu) => menu.constructor);
}

async function renderTask(task: Task) {
    const taskLineRenderer = new TaskLineRenderer({
        textRenderer: mockHTMLRenderer,
        obsidianApp: mockApp,
        obsidianComponent: null,
        taskLayoutOptions: new TaskLayoutOptions(),
        queryLayoutOptions: new QueryLayoutOptions(),
    });
    const ul = document.body.createEl('ul');
    const li = ul.createEl('li');
    await taskLineRenderer.renderTaskLine({ li, task, taskIndex: 0, isTaskInQueryFile: true });
    return li;
}

function descriptionText(li: HTMLElement) {
    return li.querySelector('.task-description > span') as HTMLElement;
}

function mouse(type: 'click' | 'contextmenu') {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
}

const withPath = (description: string) => new TaskBuilder().path('folder/file.md').description(description);

describe('rendering nails', () => {
    it('should give a task with nails a data-task-nails attribute', async () => {
        const li = await renderTask(withPath('⚠️⚠️ Buy milk').build());

        expect(li.getAttribute('data-task-nails')).toEqual('2');
        expect(descriptionText(li).textContent).toEqual('⚠️⚠️ Buy milk');
    });

    it('should give a task without nails no attribute', async () => {
        const li = await renderTask(withPath('Buy milk ⚠️').build());

        expect(li.hasAttribute('data-task-nails')).toEqual(false);
    });

    it('should mark a task in an unknown file too, without a menu', async () => {
        const li = await renderTask(new TaskBuilder().description('⚠️ Buy milk').build());

        expect(li.getAttribute('data-task-nails')).toEqual('1');
        descriptionText(li).dispatchEvent(mouse('contextmenu'));
        expect(shownMenus()).toEqual([]);
    });
});

describe('nail menu on rendered tasks', () => {
    it('should show the nail menu on contextmenu of the description text', async () => {
        const li = await renderTask(withPath('⚠️ Buy milk').build());

        const event = mouse('contextmenu');
        descriptionText(li).dispatchEvent(event);

        expect(event.defaultPrevented).toEqual(true);
        expect(showAtPosition).toHaveBeenCalledWith({ x: 10, y: 20 });
        expect(shownMenuClasses()).toEqual([NailMenu]);
        expect(menuToString(shownMenus()[0])).toMatchInlineSnapshot(`
            "
              Add nail
              Remove nail"
        `);
    });

    it('should show the nail menu on contextmenu of the task outside its text', async () => {
        const li = await renderTask(withPath('Buy milk').build());

        li.dispatchEvent(mouse('contextmenu'));

        expect(shownMenuClasses()).toEqual([NailMenu]);
        expect(menuToString(shownMenus()[0])).toContain('Add nail');
        expect(menuToString(shownMenus()[0])).not.toContain('Remove nail');
    });

    it('should leave a click on the description text alone', async () => {
        const li = await renderTask(withPath('Buy milk').build());

        const event = mouse('click');
        descriptionText(li).dispatchEvent(event);

        expect(event.defaultPrevented).toEqual(false);
        expect(shownMenus()).toEqual([]);
    });

    it.each([
        ['status', 'input', StatusMenu],
        ['date', '.task-due', DateMenu],
        ['priority', '.task-priority', PriorityMenuWithNails],
        ['horizon', '.task-horizon', HorizonMenu],
    ])('should open only the %s menu from its target', async (_name: string, selector: string, menuClass: unknown) => {
        const task = fromLine({ line: '- [ ] Buy milk 🔭 today ⏫ 📅 2026-10-20', path: 'folder/file.md' });
        const li = await renderTask(task);

        (li.querySelector(selector) as HTMLElement).dispatchEvent(mouse('contextmenu'));

        expect(shownMenuClasses()).toEqual([menuClass]);
    });

    it('should leave links and tags to Obsidian', async () => {
        const li = await renderTask(withPath('Buy milk').build());
        const link = descriptionText(li).createEl('a', { cls: 'internal-link', text: 'Shop' });
        const inner = link.createSpan({ text: 'inner' });

        const event = mouse('contextmenu');
        inner.dispatchEvent(event);

        expect(event.defaultPrevented).toEqual(false);
        expect(shownMenus()).toEqual([]);
    });

    it('should leave a nested list item alone', async () => {
        const li = await renderTask(withPath('Buy milk').build());
        const nested = li.createEl('ul').createEl('li', { text: 'a note under the task' });

        const event = mouse('contextmenu');
        nested.dispatchEvent(event);

        expect(event.defaultPrevented).toEqual(false);
        expect(shownMenus()).toEqual([]);
    });

    it('should leave a right-click on selected text to the menu with Copy', async () => {
        const li = await renderTask(withPath('Buy milk').build());
        document.getSelection()!.selectAllChildren(descriptionText(li));

        const event = mouse('contextmenu');
        descriptionText(li).dispatchEvent(event);

        expect(event.defaultPrevented).toEqual(false);
        expect(shownMenus()).toEqual([]);

        document.getSelection()!.collapseToStart();
        descriptionText(li).dispatchEvent(mouse('contextmenu'));
        expect(shownMenuClasses()).toEqual([NailMenu]);
    });

    it('should ignore text selected outside the task', async () => {
        const li = await renderTask(withPath('Buy milk').build());
        const other = document.body.createEl('p', { text: 'Elsewhere' });
        document.getSelection()!.selectAllChildren(other);

        descriptionText(li).dispatchEvent(mouse('contextmenu'));

        expect(shownMenuClasses()).toEqual([NailMenu]);
    });
});

describe('saving from the nail menu', () => {
    async function choose(line: string, title: string) {
        const task = fromLine({ line, path: 'folder/file.md' });
        const li = document.body.createEl('li');
        addNailMenuTargets(li, task, TestableTaskSaver.testableTaskSaver);
        li.dispatchEvent(mouse('contextmenu'));

        // @ts-expect-error TS2339: Property 'items' does not exist on type 'Menu'.
        const items: { title: string; callback: () => Promise<void> }[] = shownMenus()[0].items;
        await items.find((item) => item.title === title)!.callback();
        return task;
    }

    it('should add a nail at the start of the description and keep the fields', async () => {
        const task = await choose('- [ ] ⚠️ Buy milk #home ⏫ 📅 2026-10-20', 'Add nail');

        expect(Object.is(TestableTaskSaver.taskBeingOverwritten, task)).toEqual(true);
        expect(TestableTaskSaver.tasksBeingSaved!.map((saved) => saved.toFileLineString())).toEqual([
            '- [ ] ⚠️⚠️ Buy milk #home ⏫ 📅 2026-10-20',
        ]);
    });

    it('should remove a nail', async () => {
        await choose('- [ ] ⚠️ Buy milk 📅 2026-10-20', 'Remove nail');

        expect(TestableTaskSaver.tasksBeingSaved!.map((saved) => saved.toFileLineString())).toEqual([
            '- [ ] Buy milk 📅 2026-10-20',
        ]);
    });
});
