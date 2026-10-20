import moment from 'moment';
import { Menu } from 'obsidian';
import { QueryLayoutOptions } from '../../src/Layout/QueryLayoutOptions';
import { TaskLayoutComponent, TaskLayoutOptions } from '../../src/Layout/TaskLayoutOptions';
import { addPriorityMenuListeners } from '../../src/Renderer/PriorityMenuTargets';
import { TaskLineRenderer } from '../../src/Renderer/TaskLineRenderer';
import { Priority } from '../../src/Task/Priority';
import type { Task } from '../../src/Task/Task';
import { NailMenu } from '../../src/ui/Menus/NailMenu';
import { PriorityMenu } from '../../src/ui/Menus/PriorityMenu';
import { TaskBuilder } from '../TestingTools/TaskBuilder';
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

async function renderTask(task: Task, taskLayoutOptions = new TaskLayoutOptions()) {
    const taskLineRenderer = new TaskLineRenderer({
        textRenderer: mockHTMLRenderer,
        obsidianApp: mockApp,
        obsidianComponent: null,
        taskLayoutOptions,
        queryLayoutOptions: new QueryLayoutOptions(),
    });
    const li = document.createElement('div').createEl('li');
    await taskLineRenderer.renderTaskLine({ li, task, taskIndex: 0, isTaskInQueryFile: true });
    return li;
}

function descriptionSpan(li: HTMLElement) {
    return li.querySelector('.task-description') as HTMLSpanElement;
}

function priorityMenuItems() {
    expect(shownMenus().length).toEqual(1);
    const menu = shownMenus()[0];
    expect(menu).toBeInstanceOf(PriorityMenu);
    return menuToString(menu);
}

function mouse(type: 'click' | 'contextmenu') {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
}

describe('priority menu on rendered tasks', () => {
    const withPath = () => new TaskBuilder().path('folder/file.md').description('Buy milk');

    it.each(['click', 'contextmenu'] as const)('should show the priority menu on %s of the priority', async (type) => {
        const li = await renderTask(withPath().priority(Priority.High).build());

        const event = mouse(type);
        (li.querySelector('.task-priority') as HTMLElement).dispatchEvent(event);

        expect(event.defaultPrevented).toEqual(true);
        expect(showAtPosition).toHaveBeenCalledWith({ x: 10, y: 20 });
        expect(priorityMenuItems()).toMatchInlineSnapshot(`
            "
              Priority: Highest
            x Priority: High
              Priority: Medium
              Priority: Normal
              Priority: Low
              Priority: Lowest
              ---
              Add nail"
        `);
    });

    it.each(['click', 'contextmenu'] as const)(
        'should show the priority menu on %s of the placeholder of a task without priority',
        async (type) => {
            const li = await renderTask(withPath().build());

            // A click on the description's ::after content has the description span as its target.
            const event = mouse(type);
            descriptionSpan(li).dispatchEvent(event);

            expect(event.defaultPrevented).toEqual(true);
            expect(priorityMenuItems()).toContain('x Priority: Normal');
        },
    );

    it('should leave a click on the description text alone', async () => {
        const li = await renderTask(withPath().build());

        const event = mouse('click');
        (descriptionSpan(li).firstElementChild as HTMLElement).dispatchEvent(event);

        expect(event.defaultPrevented).toEqual(false);
        expect(shownMenus()).toEqual([]);
    });

    // A right-click elsewhere on the task opens the nail menu (fork-features/nails.md).
    it('should open the nail menu, not the priority menu, on contextmenu of the description text', async () => {
        const li = await renderTask(withPath().build());

        (descriptionSpan(li).firstElementChild as HTMLElement).dispatchEvent(mouse('contextmenu'));

        expect(shownMenus().map((menu) => menu.constructor)).toEqual([NailMenu]);
    });

    it('should not open the menu from the description of a task with a priority', async () => {
        const li = await renderTask(withPath().priority(Priority.Low).build());

        descriptionSpan(li).dispatchEvent(mouse('contextmenu'));

        expect(shownMenus().map((menu) => menu.constructor)).toEqual([NailMenu]);
    });

    it('should not open the menu from the description when the layout hides the priority', async () => {
        const taskLayoutOptions = new TaskLayoutOptions();
        taskLayoutOptions.hide(TaskLayoutComponent.Priority);
        const li = await renderTask(withPath().build(), taskLayoutOptions);

        descriptionSpan(li).dispatchEvent(mouse('contextmenu'));

        expect(shownMenus().map((menu) => menu.constructor)).toEqual([NailMenu]);
    });

    it('should not open the menu for a task without a known path', async () => {
        const li = await renderTask(new TaskBuilder().path('').priority(Priority.High).build());

        (li.querySelector('.task-priority') as HTMLElement).dispatchEvent(mouse('contextmenu'));

        expect(shownMenus()).toEqual([]);
    });

    it('should not change the rendered HTML of a task without priority', async () => {
        const li = await renderTask(withPath().build());

        // The placeholder is CSS only: the description span holds only the inner span with the text,
        // which is what tells a click on the placeholder from a click on the text.
        expect(descriptionSpan(li).outerHTML).toEqual('<span class="task-description"><span>Buy milk</span></span>');
        expect(li.querySelector('.task-priority')).toBeNull();
    });

    it('should save the priority chosen in the menu', () => {
        const task = withPath().build();
        const span = document.createElement('span');
        addPriorityMenuListeners(
            span,
            TaskLayoutComponent.Description,
            task,
            new TaskLayoutOptions(),
            TestableTaskSaver.testableTaskSaver,
        );

        span.dispatchEvent(mouse('contextmenu'));
        // @ts-expect-error TS2339: Property 'items' does not exist on type 'Menu'.
        const highest = shownMenus()[0].items[0];
        expect(highest.title).toEqual('Priority: Highest');
        highest.callback();

        expect(Object.is(TestableTaskSaver.taskBeingOverwritten, task)).toEqual(true);
        expect(TestableTaskSaver.tasksBeingSaved!.length).toEqual(1);
        expect(TestableTaskSaver.tasksBeingSaved![0].priority).toEqual(Priority.Highest);
        expect(TestableTaskSaver.tasksBeingSaved![0].description).toEqual('Buy milk');
    });

    it('should ignore other components', () => {
        const span = document.createElement('span');
        addPriorityMenuListeners(span, TaskLayoutComponent.DueDate, withPath().build(), new TaskLayoutOptions());

        span.dispatchEvent(mouse('contextmenu'));

        expect(shownMenus()).toEqual([]);
    });
});
