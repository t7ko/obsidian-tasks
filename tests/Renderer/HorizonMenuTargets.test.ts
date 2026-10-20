import moment from 'moment';
import { Menu } from 'obsidian';
import { QueryLayout } from '../../src/Layout/QueryLayout';
import { QueryLayoutOptions } from '../../src/Layout/QueryLayoutOptions';
import { Query } from '../../src/Query/Query';
import { TaskLayoutOptions } from '../../src/Layout/TaskLayoutOptions';
import { addHorizonMenuTargets } from '../../src/Renderer/HorizonMenuTargets';
import { TaskLineRenderer } from '../../src/Renderer/TaskLineRenderer';
import { Priority } from '../../src/Task/Priority';
import type { Task } from '../../src/Task/Task';
import { HorizonMenu } from '../../src/ui/Menus/HorizonMenu';
import { NailMenu } from '../../src/ui/Menus/NailMenu';
import { PriorityMenu } from '../../src/ui/Menus/PriorityMenu';
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
});

function shownMenus(): Menu[] {
    return showAtPosition.mock.contexts as Menu[];
}

async function renderTask(task: Task, queryLayoutOptions = new QueryLayoutOptions()) {
    const taskLineRenderer = new TaskLineRenderer({
        textRenderer: mockHTMLRenderer,
        obsidianApp: mockApp,
        obsidianComponent: null,
        taskLayoutOptions: new TaskLayoutOptions(),
        queryLayoutOptions,
    });
    const li = document.createElement('div').createEl('li');
    await taskLineRenderer.renderTaskLine({ li, task, taskIndex: 0, isTaskInQueryFile: true });
    return li;
}

function textSpan(li: HTMLElement) {
    return li.querySelector('.tasks-list-text') as HTMLSpanElement;
}

function horizonSpan(li: HTMLElement) {
    return li.querySelector('.task-horizon') as HTMLSpanElement | null;
}

function mouse(type: 'click' | 'contextmenu') {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
}

function horizonMenuItems() {
    expect(shownMenus().length).toEqual(1);
    const menu = shownMenus()[0];
    expect(menu).toBeInstanceOf(HorizonMenu);
    return menuToString(menu);
}

const withPath = (description: string) => new TaskBuilder().path('folder/file.md').description(description);

describe('rendering a horizon', () => {
    it('should wrap the horizon in a span and mark the task', async () => {
        const li = await renderTask(withPath('Buy milk 🔭 this week #home').build());

        expect(li.getAttribute('data-task-horizon')).toEqual('this-week');
        const span = horizonSpan(li)!;
        expect(span.outerHTML).toEqual('<span class="task-horizon" data-task-horizon="this-week">🔭 this week</span>');
        expect(li.querySelector('.task-description')!.textContent).toEqual('Buy milk 🔭 this week #home');
    });

    it('should wrap only the marker of an invalid horizon', async () => {
        const li = await renderTask(withPath('Buy 🔭 tomorow milk').build());

        expect(li.getAttribute('data-task-horizon')).toEqual('invalid');
        expect(horizonSpan(li)!.textContent).toEqual('🔭');
    });

    it('should leave a task without a horizon as upstream renders it', async () => {
        const li = await renderTask(withPath('Buy milk').build());

        expect(li.hasAttribute('data-task-horizon')).toEqual(false);
        expect(horizonSpan(li)).toBeNull();
        expect(li.querySelector('.task-description')!.outerHTML).toEqual(
            '<span class="task-description"><span>Buy milk</span></span>',
        );
    });

    it('should still style the horizon of a task in an unknown file, without a menu', async () => {
        const li = await renderTask(new TaskBuilder().description('Buy milk 🔭 today').build());

        expect(horizonSpan(li)!.getAttribute('data-task-horizon')).toEqual('today');
        horizonSpan(li)!.dispatchEvent(mouse('click'));
        textSpan(li).dispatchEvent(mouse('click'));
        expect(shownMenus()).toEqual([]);
    });
});

describe('horizon menu on rendered tasks', () => {
    it.each(['click', 'contextmenu'] as const)('should show the horizon menu on %s of the horizon', async (type) => {
        const li = await renderTask(withPath('Buy milk 🔭 this week').build());

        const event = mouse(type);
        horizonSpan(li)!.dispatchEvent(event);

        expect(event.defaultPrevented).toEqual(true);
        expect(showAtPosition).toHaveBeenCalledWith({ x: 10, y: 20 });
        expect(horizonMenuItems()).toMatchInlineSnapshot(`
            "
              Today
              Tomorrow
            x This week
              Next week
              This month
              Next month
              ---
              No horizon
              ---
              Add nail"
        `);
    });

    it.each(['click', 'contextmenu'] as const)(
        'should show the horizon menu on %s of the placeholder of a task without horizon',
        async (type) => {
            const li = await renderTask(withPath('Buy milk').build());

            // A click on the text span's ::after content has the text span as its target.
            const event = mouse(type);
            textSpan(li).dispatchEvent(event);

            expect(event.defaultPrevented).toEqual(true);
            expect(horizonMenuItems()).toContain('x No horizon');
        },
    );

    it('should not open the menu from the text span of a task with a horizon', async () => {
        const li = await renderTask(withPath('Buy milk 🔭 today').build());

        textSpan(li).dispatchEvent(mouse('click'));

        expect(shownMenus()).toEqual([]);
    });

    it('should leave a click on the description text alone', async () => {
        const li = await renderTask(withPath('Buy milk').priority(Priority.High).build());

        const event = mouse('click');
        (li.querySelector('.task-description > span') as HTMLElement).dispatchEvent(event);

        expect(event.defaultPrevented).toEqual(false);
        expect(shownMenus()).toEqual([]);
    });

    it('should open the nail menu, not the horizon menu, on contextmenu of the description text', async () => {
        const li = await renderTask(withPath('Buy milk').priority(Priority.High).build());

        (li.querySelector('.task-description > span') as HTMLElement).dispatchEvent(mouse('contextmenu'));

        expect(shownMenus().map((menu) => menu.constructor)).toEqual([NailMenu]);
    });

    it('should open only the horizon menu, not the priority menu, from the horizon', async () => {
        const li = await renderTask(withPath('Buy milk 🔭 today').build());

        horizonSpan(li)!.dispatchEvent(mouse('click'));

        expect(horizonMenuItems()).toContain('x Today');
    });

    it('should keep the priority placeholder working on a task with a horizon', async () => {
        const li = await renderTask(withPath('Buy milk 🔭 today').build());

        li.querySelector('.task-description')!.dispatchEvent(mouse('click'));

        expect(shownMenus().length).toEqual(1);
        expect(shownMenus()[0]).toBeInstanceOf(PriorityMenu);
    });
});

describe('saving from the horizon menu', () => {
    async function chooseFromMenuOnHorizon(line: string, title: string) {
        const task = fromLine({ line, path: 'folder/file.md' });
        const li = document.createElement('div').createEl('li');
        const textSpan = li.createSpan();
        textSpan.classList.add('tasks-list-text');
        addHorizonMenuTargets(li, textSpan, task, TestableTaskSaver.testableTaskSaver);

        textSpan.dispatchEvent(mouse('contextmenu'));
        // @ts-expect-error TS2339: Property 'items' does not exist on type 'Menu'.
        const item = shownMenus()[0].items.find((item) => item.title === title);
        await item.callback();
        return task;
    }

    it('should add the chosen horizon after the description and keep the fields', async () => {
        const task = await chooseFromMenuOnHorizon('- [ ] Buy milk #home ⏫ 📅 2026-10-20', 'Next week');

        expect(Object.is(TestableTaskSaver.taskBeingOverwritten, task)).toEqual(true);
        expect(TestableTaskSaver.tasksBeingSaved!.map((task) => task.toFileLineString())).toEqual([
            '- [ ] Buy milk #home 🔭 next week ⏫ 📅 2026-10-20',
        ]);

        // The standard serializer, as in vanilla Tasks, still finds every field.
        const reread = fromLine({ line: TestableTaskSaver.tasksBeingSaved![0].toFileLineString() });
        expect(reread.description).toEqual('Buy milk #home 🔭 next week');
        expect(reread.priority).toEqual(Priority.High);
        expect(reread.dueDate?.format('YYYY-MM-DD')).toEqual('2026-10-20');
    });

    it('should save nothing when the current horizon is chosen', async () => {
        await chooseFromMenuOnHorizon('- [ ] Buy milk', 'No horizon');

        expect(TestableTaskSaver.tasksBeingSaved).toBeUndefined();
    });
});

describe('hide horizon', () => {
    // HorizonMenuTargets.scss hides the horizon and the placeholder under this class.
    const hiddenClass = 'tasks-layout-hide-horizon';

    function hiddenClasses(source: string) {
        const query = new Query(source);
        expect(query.error).toBeUndefined();
        return new QueryLayout(query.queryLayoutOptions).getHiddenClasses();
    }

    it('should show horizons by default', () => {
        expect(hiddenClasses('')).not.toContain(hiddenClass);
    });

    it.each(['hide horizon', 'hide horizons', 'HIDE HORIZON'])('should hide horizons with "%s"', (line) => {
        expect(hiddenClasses(line)).toContain(hiddenClass);
    });

    it('should show horizons again with "show horizon"', () => {
        expect(hiddenClasses('hide horizon\nshow horizon')).not.toContain(hiddenClass);
    });

    it('should render the task line as without it', async () => {
        // Hiding is CSS only, keyed on the class of the results' list.
        const queryLayoutOptions = new QueryLayoutOptions();
        queryLayoutOptions.hideHorizon = true;
        const task = withPath('Buy milk 🔭 this week').build();

        const hidden = await renderTask(task, queryLayoutOptions);

        expect(hidden.outerHTML).toEqual((await renderTask(task)).outerHTML);
        expect(horizonSpan(hidden)!.textContent).toEqual('🔭 this week');
    });
});
