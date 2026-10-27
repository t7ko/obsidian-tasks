import { type EditorView, type PluginValue, ViewPlugin } from '@codemirror/view';
import { TasksFile } from '../Scripting/TasksFile';
import { StatusRegistry } from '../Statuses/StatusRegistry';
import { Task } from '../Task/Task';
import { TaskLocation } from '../Task/TaskLocation';
import { TaskRegularExpressions } from '../Task/TaskRegularExpressions';
import { StatusMenu } from '../ui/Menus/StatusMenu';
import { showMenu } from '../ui/Menus/TaskEditingMenu';
import { editorTaskSaver, isMouseOverText } from './EditorDateMenuExtension';

/**
 * t7 fork feature: the status menu in the editor. Spec: `fork-features/editor-status-menu.md`.
 *
 * In Live Preview and Source mode, a right-click on the checkbox of a task opens {@link StatusMenu}, the menu of a
 * right-click on a checkbox in query results and Reading mode, instead of the editor's context menu.
 * Register with `plugin.registerEditorExtension(editorStatusMenuExtension())`.
 *
 * Live Preview's checkbox is a widget, and CodeMirror's event handlers skip events in widgets, so this listens on the
 * editor's element, as `LivePreviewExtension` does for clicks. Obsidian opens the editor's context menu from a
 * `contextmenu` listener on the editor's container, which does nothing for an event whose default is prevented.
 */
export function editorStatusMenuExtension() {
    return ViewPlugin.fromClass(EditorStatusMenu);
}

class EditorStatusMenu implements PluginValue {
    constructor(private readonly view: EditorView) {
        this.view.dom.addEventListener('contextmenu', this.handleContextMenu);
    }

    public destroy(): void {
        this.view.dom.removeEventListener('contextmenu', this.handleContextMenu);
    }

    private readonly handleContextMenu = (event: MouseEvent) => {
        onEditorCheckboxContextMenu(event, this.view);
    };
}

/**
 * The checkbox of a task line: `from` is the column of its `[`, `to` the column after its `]`.
 */
export interface CheckboxInLine {
    task: Task;
    from: number;
    to: number;
}

const checkboxAtStartRegex = new RegExp(
    TaskRegularExpressions.indentationRegex.source +
        TaskRegularExpressions.listMarkerRegex.source +
        ' +(' +
        TaskRegularExpressions.checkboxRegex.source +
        ')',
    'u',
);

/**
 * The task in a line and where its checkbox is.
 * Returns null for a line that is not a task, including one without the global filter.
 */
export function checkboxInLine(line: string): CheckboxInLine | null {
    const task = Task.fromLine({
        line,
        taskLocation: TaskLocation.fromUnknownPosition(new TasksFile('')),
        fallbackDate: null,
    });
    if (task === null) {
        return null;
    }
    const match = line.match(checkboxAtStartRegex);
    if (match === null) {
        return null;
    }
    const to = match[0].length;
    return { task, from: to - match[3].length, to };
}

/**
 * Open {@link StatusMenu} for a right-click on the checkbox of a task: Live Preview's checkbox, or the `[ ]` text in
 * Source mode. Returns false, leaving the event to Obsidian, anywhere else.
 */
export function onEditorCheckboxContextMenu(event: MouseEvent, view: EditorView): boolean {
    if (event.defaultPrevented || view.state.readOnly) {
        return false;
    }

    // Only lines of text: not rendered blocks in Live Preview, such as callouts, tables, embeds and query results.
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') {
        return false;
    }
    if (!target.closest('.cm-line') || target.closest('.cm-embed-block, .internal-embed, .plugin-tasks-query-result')) {
        return false;
    }

    const clicked = isCheckboxElement(target) ? renderedCheckboxAt(view, target) : checkboxTextAt(view, event, target);
    if (clicked === null) {
        return false;
    }
    const { line, checkbox, pos } = clicked;

    // Selected text keeps the editor's menu, with Copy.
    if (view.state.selection.ranges.some((range) => !range.empty && range.from <= pos && pos <= range.to)) {
        return false;
    }

    const taskSaver = editorTaskSaver(
        view,
        line.number,
        line.text,
        'Tasks: the task line has changed, so the status was not changed.',
    );
    showMenu(event, new StatusMenu(StatusRegistry.getInstance(), checkbox.task, taskSaver));
    return true;
}

type Line = ReturnType<EditorView['state']['doc']['line']>;

interface ClickedCheckbox {
    line: Line;
    checkbox: CheckboxInLine;
    pos: number;
}

function isCheckboxElement(target: Element): target is HTMLInputElement {
    return target.matches('input[type="checkbox"]');
}

/**
 * Live Preview: the checkbox element stands for the start of the line up to the checkbox and the spaces after it.
 * `posAtDOM` gives the start or the end of that text.
 */
function renderedCheckboxAt(view: EditorView, target: HTMLInputElement): ClickedCheckbox | null {
    let pos: number;
    try {
        pos = view.posAtDOM(target);
    } catch {
        return null;
    }
    const line = view.state.doc.lineAt(pos);
    const checkbox = checkboxInLine(line.text);
    if (checkbox === null) {
        return null;
    }
    // A checkbox further along the line is not the task's.
    const spacesAfter = line.text.slice(checkbox.to).length - line.text.slice(checkbox.to).trimStart().length;
    if (pos > line.from + checkbox.to + spacesAfter) {
        return null;
    }
    return { line, checkbox, pos };
}

/**
 * Source mode, or Live Preview with the cursor on the checkbox: the mouse is over the `[ ]` text.
 */
function checkboxTextAt(view: EditorView, event: MouseEvent, target: Element): ClickedCheckbox | null {
    if (target.closest('[contenteditable="false"]')) {
        return null;
    }
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) {
        return null;
    }
    const line = view.state.doc.lineAt(pos);
    const checkbox = checkboxInLine(line.text);
    if (checkbox === null) {
        return null;
    }
    if (!isMouseOverText(view, event, pos, line.from + checkbox.from, line.from + checkbox.to)) {
        return null;
    }
    return { line, checkbox, pos };
}
