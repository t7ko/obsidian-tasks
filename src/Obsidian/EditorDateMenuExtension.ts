import { EditorView } from '@codemirror/view';
import type flatpickr from 'flatpickr';
import { Notice, editorInfoField } from 'obsidian';
import { getUserSelectedTaskFormat } from '../Config/Settings';
import type { AllTaskDateFields } from '../DateTime/DateFieldTypes';
import { TasksFile } from '../Scripting/TasksFile';
import { Task } from '../Task/Task';
import { TaskLocation } from '../Task/TaskLocation';
import { DefaultTaskSerializer, type DefaultTaskSerializerSymbols } from '../TaskSerializer/DefaultTaskSerializer';
import { promptForDate } from '../ui/Menus/DatePicker';
import { EditorDateMenu } from '../ui/Menus/EditorDateMenu';
import { type TaskSaver, showMenu } from '../ui/Menus/TaskEditingMenu';

/**
 * t7 fork feature: the date menu in the editor. Spec: `fork-features/editor-date-menu.md`.
 *
 * In Live Preview and Source mode, a right-click on a date of a task opens {@link EditorDateMenu} instead of the
 * editor's context menu. Register with `plugin.registerEditorExtension(editorDateMenuExtension())`.
 *
 * Obsidian opens the editor's context menu from a `contextmenu` listener on the editor's container, which does
 * nothing for an event whose default is prevented; this handler runs first, on the editor's content.
 */
export function editorDateMenuExtension() {
    return EditorView.domEventHandlers({
        contextmenu: (event, view) => onEditorContextMenu(event, view),
    });
}

/**
 * A date field in a task line: `from` is the column of its emoji (or of the bracket in the Dataview format), `to`
 * the column after its date.
 */
export interface DateFieldInLine {
    field: AllTaskDateFields;
    from: number;
    to: number;
}

type TaskFormatRegexName = keyof DefaultTaskSerializerSymbols['TaskFormatRegularExpressions'];

const dateFieldRegexNames: Record<AllTaskDateFields, TaskFormatRegexName> = {
    cancelledDate: 'cancelledDateRegex',
    createdDate: 'createdDateRegex',
    doneDate: 'doneDateRegex',
    dueDate: 'dueDateRegex',
    scheduledDate: 'scheduledDateRegex',
    startDate: 'startDateRegex',
};

/**
 * The task in a line and where its dates are, in the order they are in the line.
 * Returns null for a line that is not a task, including one without the global filter.
 */
export function dateFieldsInLine(line: string): { task: Task; dateFields: DateFieldInLine[] } | null {
    const task = Task.fromLine({
        line,
        taskLocation: TaskLocation.fromUnknownPosition(new TasksFile('')),
        fallbackDate: null,
    });
    if (task === null) {
        return null;
    }

    const { taskSerializer } = getUserSelectedTaskFormat();
    if (!(taskSerializer instanceof DefaultTaskSerializer)) {
        return { task, dateFields: [] };
    }
    const regexes = taskSerializer.symbols.TaskFormatRegularExpressions;

    const dateFields: DateFieldInLine[] = [];
    for (const field of Task.allDateFields() as AllTaskDateFields[]) {
        if (task[field] === null) {
            continue;
        }
        const match = lastMatch(line, regexes[dateFieldRegexNames[field]]);
        if (match !== null) {
            dateFields.push({ field, from: match.index, to: match.index + match[0].length });
        }
    }
    return { task, dateFields: dateFields.sort((a, b) => a.from - b.from) };
}

/**
 * The last match of a field regex in a line. The regexes end with `$`, as Tasks reads fields from the end of the
 * line; without it they match anywhere. When the task has the field, the last match is the field: only other fields,
 * tags and a block link can follow it.
 */
function lastMatch(line: string, fieldRegex: RegExp): RegExpExecArray | null {
    const source = fieldRegex.source.endsWith('$') ? fieldRegex.source.slice(0, -1) : fieldRegex.source;
    const regex = new RegExp(source, fieldRegex.flags.replace('g', '') + 'g');
    let last: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
        last = match;
        if (match[0] === '') {
            regex.lastIndex++;
        }
    }
    return last;
}

/**
 * Open {@link EditorDateMenu} for a right-click on a date of a task. Returns false, leaving the event to Obsidian,
 * anywhere else.
 */
export function onEditorContextMenu(event: MouseEvent, view: EditorView): boolean {
    if (event.defaultPrevented || view.state.readOnly) {
        return false;
    }

    // Only text: not rendered widgets in Live Preview, such as callouts, tables, embeds and query results.
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') {
        return false;
    }
    if (!target.closest('.cm-line') || target.closest('[contenteditable="false"]')) {
        return false;
    }

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) {
        return false;
    }

    // Selected text keeps the editor's menu, with Copy.
    if (view.state.selection.ranges.some((range) => !range.empty && range.from <= pos && pos <= range.to)) {
        return false;
    }

    const line = view.state.doc.lineAt(pos);
    const found = dateFieldsInLine(line.text);
    if (found === null) {
        return false;
    }
    const clicked = found.dateFields.find((dateField) =>
        isMouseOverText(view, event, pos, line.from + dateField.from, line.from + dateField.to),
    );
    if (clicked === undefined) {
        return false;
    }

    const { task } = found;
    const from = line.from + clicked.from;
    const to = line.from + clicked.to;
    const taskSaver = editorTaskSaver(view, line.number, line.text);
    // Open the calendar once the menu has closed.
    const pickDate = () => {
        window.setTimeout(() => openDatePicker(view, from, to, task, clicked.field, taskSaver), 0);
    };
    showMenu(event, new EditorDateMenu(clicked.field, task, pickDate, taskSaver));
    return true;
}

/**
 * Whether the mouse is over the text from `from` to `to`. `posAtCoords` alone can't tell: it also gives a position for
 * the empty space after the end of a line.
 */
function isMouseOverText(view: EditorView, event: MouseEvent, pos: number, from: number, to: number): boolean {
    if (pos < from || pos > to) {
        return false;
    }
    const rects = textRects(view, from, to);
    if (rects === null) {
        // No layout to check against.
        return true;
    }
    const { clientX: x, clientY: y } = event;
    return rects.some((rect) => x >= rect.left - 1 && x <= rect.right + 1 && y >= rect.top - 3 && y <= rect.bottom + 3);
}

function textRects(view: EditorView, from: number, to: number): DOMRect[] | null {
    try {
        const start = view.domAtPos(from);
        const end = view.domAtPos(to);
        const range = view.dom.ownerDocument.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        const rects = Array.from(range.getClientRects());
        return rects.length > 0 ? rects : null;
    } catch {
        return null;
    }
}

/**
 * Open the calendar of {@link promptForDate} below the date. It needs an element to place itself by; the editor's own
 * elements belong to CodeMirror, so use an invisible one over the date, removed when the calendar goes.
 */
function openDatePicker(
    view: EditorView,
    from: number,
    to: number,
    task: Task,
    field: AllTaskDateFields,
    taskSaver: TaskSaver,
) {
    const rect = textRects(view, from, to)?.[0] ?? view.coordsAtPos(from);
    if (rect === null) {
        return;
    }

    const anchor = view.dom.ownerDocument.body.createSpan();
    Object.assign(anchor.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.right - rect.left}px`,
        height: `${rect.bottom - rect.top}px`,
        visibility: 'hidden',
        pointerEvents: 'none',
    });

    promptForDate(anchor, task, field, taskSaver);

    // promptForDate destroys its flatpickr when the calendar closes.
    const picker = (anchor as HTMLElement & { _flatpickr?: flatpickr.Instance })._flatpickr;
    if (picker === undefined) {
        anchor.remove();
        return;
    }
    picker.config.onDestroy.push(() => anchor.remove());
}

/**
 * A {@link TaskSaver} that writes through the editor, so that Undo undoes it. It replaces the line `lineNumber`,
 * or, if lines above it were added or removed meanwhile, the only line with the same text.
 * @param view
 * @param lineNumber - 1-based, as in CodeMirror.
 * @param lineText - the line's text when the menu opened.
 */
export function editorTaskSaver(view: EditorView, lineNumber: number, lineText: string): TaskSaver {
    const path = filePath(view);
    return async (originalTask: Task, newTasks: Task | Task[]) => {
        const tasks = Array.isArray(newTasks) ? newTasks : [newTasks];
        // The calendar saves its date also when it is closed without a change.
        if (tasks.length === 1 && tasks[0] === originalTask) {
            return;
        }
        const line = filePath(view) === path ? findLine(view.state.doc, lineNumber, lineText) : null;
        if (line === null) {
            new Notice('Tasks: the task line has changed, so the date was not changed.');
            return;
        }
        replaceLine(view, line, tasks);
    };
}

// The editor view is reused when the pane opens another file.
function filePath(view: EditorView): string | undefined {
    try {
        return view.state.field(editorInfoField, false)?.file?.path;
    } catch {
        return undefined;
    }
}

type Doc = EditorView['state']['doc'];
type Line = ReturnType<Doc['line']>;

function findLine(doc: Doc, lineNumber: number, lineText: string): Line | null {
    if (lineNumber <= doc.lines && doc.line(lineNumber).text === lineText) {
        return doc.line(lineNumber);
    }
    let found: Line | null = null;
    for (let n = 1; n <= doc.lines; n++) {
        if (doc.line(n).text === lineText) {
            if (found !== null) {
                return null;
            }
            found = doc.line(n);
        }
    }
    return found;
}

function replaceLine(view: EditorView, line: Line, tasks: Task[]) {
    const { state } = view;
    const insert = tasks.map((task) => task.toFileLineString()).join(state.lineBreak);
    if (insert === line.text) {
        return;
    }
    // No tasks: delete the line with its line break, as Live Preview's checkbox clicks do.
    const to = tasks.length === 0 && line.number < state.doc.lines ? state.doc.line(line.number + 1).from : line.to;
    view.dispatch({ changes: { from: line.from, to, insert } });
}
