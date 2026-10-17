import moment from 'moment';
import { State } from '../../src/Obsidian/Cache';
import { addFilterClearButton } from '../../src/Renderer/FilterClearButton';
import { QueryResultsRenderer } from '../../src/Renderer/QueryResultsRenderer';
import type { Task } from '../../src/Task/Task';
import { TaskBuilder } from '../TestingTools/TaskBuilder';
import { createTestTasksFile } from '../TestingTools/TasksFileHelpers';
import { mockApp } from '../__mocks__/obsidian';
import { makeHtmlQueryRendererParameters, mockHTMLRenderer } from './RenderingTestHelpers';

window.moment = moment;

function click(element: Element) {
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    element.dispatchEvent(ev);
    return ev;
}

function pressKey(element: Element, key: string, init: KeyboardEventInit = {}) {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    element.dispatchEvent(ev);
    return ev;
}

describe('addFilterClearButton', () => {
    let label: HTMLLabelElement;
    let icon: SVGSVGElement;
    let searchBox: HTMLInputElement;
    const clearFilter = vi.fn(() => Promise.resolve());

    beforeEach(() => {
        // The structure QueryResultsRenderer.addSearchBox() makes in Obsidian, where setIcon() adds an svg.
        label = document.body.createEl('label');
        icon = label.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
        searchBox = label.createEl('input');
        searchBox.placeholder = 'Filter by description...';
        addFilterClearButton(label, searchBox, clearFilter);
        clearFilter.mockClear();
    });

    afterEach(() => {
        label.remove();
    });

    it('should empty the box, focus it and clear the filter on a click on the button', () => {
        searchBox.value = 'milk';

        // A click on the label's ::after content has the label as its target.
        const ev = click(label);

        expect(searchBox.value).toEqual('');
        expect(document.activeElement).toBe(searchBox);
        expect(clearFilter).toHaveBeenCalledTimes(1);
        expect(ev.defaultPrevented).toEqual(true);
    });

    it('should do nothing when the box is already empty', () => {
        const ev = click(label);

        expect(clearFilter).not.toHaveBeenCalled();
        expect(ev.defaultPrevented).toEqual(false);
    });

    it.each([
        ['the box', () => searchBox],
        ['the filter icon', () => icon],
    ])('should ignore a click on %s', (_name: string, target: () => Element) => {
        searchBox.value = 'milk';

        const ev = click(target());

        expect(searchBox.value).toEqual('milk');
        expect(clearFilter).not.toHaveBeenCalled();
        expect(ev.defaultPrevented).toEqual(false);
    });

    it('should empty the box and clear the filter on Escape, and keep the key from the editor', () => {
        const editorListener = vi.fn();
        label.addEventListener('keydown', editorListener);
        searchBox.value = 'milk';

        const ev = pressKey(searchBox, 'Escape');

        expect(searchBox.value).toEqual('');
        expect(document.activeElement).toBe(searchBox);
        expect(clearFilter).toHaveBeenCalledTimes(1);
        expect(ev.defaultPrevented).toEqual(true);
        expect(editorListener).not.toHaveBeenCalled();
    });

    it('should leave Escape alone when the box is already empty', () => {
        const editorListener = vi.fn();
        label.addEventListener('keydown', editorListener);

        const ev = pressKey(searchBox, 'Escape');

        expect(clearFilter).not.toHaveBeenCalled();
        expect(ev.defaultPrevented).toEqual(false);
        expect(editorListener).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['another key', 'Enter', {}],
        ['Escape while composing text with an input method', 'Escape', { isComposing: true }],
    ])('should ignore %s', (_name: string, key: string, init: KeyboardEventInit) => {
        searchBox.value = 'milk';

        const ev = pressKey(searchBox, key, init);

        expect(searchBox.value).toEqual('milk');
        expect(clearFilter).not.toHaveBeenCalled();
        expect(ev.defaultPrevented).toEqual(false);
    });

    it('should ignore Escape that something else has handled already', () => {
        // Such as a listener that captures keys before they reach the box.
        const handler = (ev: Event) => ev.preventDefault();
        label.addEventListener('keydown', handler, { capture: true });
        searchBox.value = 'milk';

        pressKey(searchBox, 'Escape');

        expect(searchBox.value).toEqual('milk');
        expect(clearFilter).not.toHaveBeenCalled();
    });
});

describe('filter clear button in query results', () => {
    const tasks: Task[] = [
        new TaskBuilder().description('buy milk').build(),
        new TaskBuilder().description('call Bob').build(),
    ];

    async function renderQuery(source: string) {
        const renderer = new QueryResultsRenderer(
            'block-language-tasks',
            source,
            createTestTasksFile('file.md'),
            () => Promise.resolve(),
            null,
            mockApp,
            mockHTMLRenderer,
            makeHtmlQueryRendererParameters(tasks),
        );
        const container = document.createElement('div');
        await renderer.render(State.Warm, tasks, container);
        return { renderer, container };
    }

    it('should render the toolbar FilterClearButton.scss relies on', async () => {
        const { container } = await renderQuery('');

        // The stylesheet shows the button as the ::after content of this label, and only while
        // the box's placeholder is hidden, which needs a placeholder.
        const label = container.querySelector('.plugin-tasks-toolbar > label') as HTMLLabelElement;
        expect(label.lastElementChild?.tagName).toEqual('INPUT');
        expect((label.lastElementChild as HTMLInputElement).placeholder).not.toEqual('');
    });

    it('should show all results again after a click on the button', async () => {
        const { renderer, container } = await renderQuery('');
        const label = container.querySelector('.plugin-tasks-toolbar > label') as HTMLLabelElement;
        const searchBox = label.querySelector('input') as HTMLInputElement;

        // What the box's debounced input listener does after typing:
        searchBox.value = 'milk';
        await renderer.applySearchBoxFilterAndRerender(searchBox.value, container);
        expect(container.querySelectorAll('li.task-list-item')).toHaveLength(1);

        click(label);

        expect(renderer.filterString).toEqual('');
        await vi.waitFor(() => expect(container.querySelectorAll('li.task-list-item')).toHaveLength(2));
        expect(renderer.filteredQueryResult.totalTasksCount).toEqual(2);
        // The toolbar is kept, so the box keeps its focus.
        expect(container.querySelector('.plugin-tasks-toolbar > label > input')).toBe(searchBox);
    });

    it('should show all results again after Escape in the box', async () => {
        const { renderer, container } = await renderQuery('');
        const searchBox = container.querySelector('.plugin-tasks-toolbar > label > input') as HTMLInputElement;

        searchBox.value = 'milk';
        await renderer.applySearchBoxFilterAndRerender(searchBox.value, container);
        expect(container.querySelectorAll('li.task-list-item')).toHaveLength(1);

        pressKey(searchBox, 'Escape');

        expect(searchBox.value).toEqual('');
        await vi.waitFor(() => expect(container.querySelectorAll('li.task-list-item')).toHaveLength(2));
        expect(renderer.filterString).toEqual('');
    });
});
