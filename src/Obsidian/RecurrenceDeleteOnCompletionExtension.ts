import { type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import { deleteOnCompletionForTypedRecurrence } from '../Config/RecurrenceDeleteOnCompletionSetting';
import { TASK_FORMATS, getSettings } from '../Config/Settings';
import { TaskLayoutComponent } from '../Layout/TaskLayoutOptions';
import { TasksFile } from '../Scripting/TasksFile';
import { OnCompletion } from '../Task/OnCompletion';
import { Task } from '../Task/Task';
import { TaskLocation } from '../Task/TaskLocation';
import { DEFAULT_SYMBOLS } from '../TaskSerializer/DefaultTaskSerializer';

/**
 * t7 fork feature: 🏁 delete for recurrences typed in the editor. Spec:
 * `fork-features/recurrence-delete-on-completion.md`.
 *
 * With the setting on, when a 🔁 is typed into a task line, or picked from Tasks' auto-suggest, add ` 🏁 delete` right
 * after the cursor, as an edit of its own so that Undo takes it back. The rule is then typed between the two. If the 🔁
 * goes again while the cursor is still on the line, the 🏁 delete goes with it.
 * Register with `plugin.registerEditorExtension(recurrenceDeleteOnCompletionExtension())`.
 */
export function recurrenceDeleteOnCompletionExtension() {
    return ViewPlugin.fromClass(RecurrenceDeleteOnCompletionPlugin);
}

/** The history joins edits with no user event, or a typing one, to the previous edit next to them. */
const userEvent = 't7.deleteOnCompletion';

const recurrenceSymbol = DEFAULT_SYMBOLS.recurrenceSymbol;

type State = EditorView['state'];
type Doc = State['doc'];
type Line = ReturnType<Doc['line']>;
type Transaction = ViewUpdate['transactions'][number];

class RecurrenceDeleteOnCompletionPlugin {
    /** The 🏁 delete added on the cursor's line, while the cursor stays on that line */
    private added: { from: number; text: string } | null = null;
    /** The view is reused when the pane opens another file. */
    private path: string | undefined;
    private destroyed = false;

    constructor(private readonly view: EditorView) {
        this.path = filePath(view.state);
    }

    public update(update: ViewUpdate) {
        if (!update.docChanged && !update.selectionSet) {
            return;
        }

        const path = filePath(update.state);
        if (path !== this.path || update.transactions.some(isUndoOrRedo)) {
            this.path = path;
            this.added = null;
            return;
        }

        this.followAdded(update);

        // Pasted or dropped text, such as a task being moved, is left as it is.
        if (!update.docChanged || update.transactions.some(isPasteOrDrop)) {
            return;
        }
        const end = insertedRecurrenceEnd(update);
        if (end !== null && !update.state.readOnly && deleteOnCompletionForTypedRecurrence()) {
            this.addSoon(update.state.doc, end);
        }
    }

    public destroy() {
        this.destroyed = true;
    }

    /**
     * Add 🏁 delete once this update is over (an update can't start another one), and after Tasks' auto-suggest has
     * put the cursor after the 🔁: only if nothing changed meanwhile and the cursor is right after the inserted text.
     */
    private addSoon(doc: Doc, end: number) {
        queueMicrotask(() => {
            if (this.destroyed) {
                return;
            }
            const { state } = this.view;
            const { main } = state.selection;
            if (!state.doc.eq(doc) || state.selection.ranges.length !== 1 || !main.empty || main.head !== end) {
                return;
            }
            const text = deleteOnCompletionText(state.doc.lineAt(end).text);
            if (text === null) {
                return;
            }
            this.view.dispatch({ changes: { from: end, insert: text }, userEvent });
            this.added = { from: end, text };
        });
    }

    /**
     * Follow the added 🏁 delete through edits, and remove it if the line loses its 🔁 while the cursor is on it.
     * Forget it once the user removes it or the cursor leaves the line: the line is the user's from then on.
     */
    private followAdded(update: ViewUpdate) {
        if (this.added === null) {
            return;
        }
        const { text } = this.added;
        const from = update.changes.mapPos(this.added.from, 1);
        const { doc } = update.state;
        const line = cursorLine(update.state);
        if (doc.sliceString(from, from + text.length) !== text || from < line.from || from + text.length > line.to) {
            this.added = null;
            return;
        }
        this.added = { from, text };
        if (!line.text.includes(recurrenceSymbol)) {
            this.added = null;
            this.removeSoon(doc, from, text);
        }
    }

    private removeSoon(doc: Doc, from: number, text: string) {
        queueMicrotask(() => {
            if (this.destroyed || !this.view.state.doc.eq(doc)) {
                return;
            }
            this.view.dispatch({ changes: { from, to: from + text.length }, userEvent });
        });
    }
}

function isUndoOrRedo(tr: Transaction): boolean {
    return tr.isUserEvent('undo') || tr.isUserEvent('redo');
}

function isPasteOrDrop(tr: Transaction): boolean {
    return tr.isUserEvent('input.paste') || tr.isUserEvent('input.drop');
}

function cursorLine(state: State): Line {
    return state.doc.lineAt(state.selection.main.head);
}

function filePath(state: State): string | undefined {
    try {
        return state.field(editorInfoField, false)?.file?.path;
    } catch {
        return undefined;
    }
}

function count(text: string, symbol: string): number {
    return text.split(symbol).length - 1;
}

/**
 * Where the text ends that the update inserted with a 🔁 into the cursor's line, if that made the line recurring: the
 * update deleted no 🔁 anywhere (so it isn't a task being toggled or moved), and the line has no other 🔁.
 * Otherwise null.
 */
function insertedRecurrenceEnd(update: ViewUpdate): number | null {
    const line = cursorLine(update.state);
    let deleted = 0;
    let inserted = 0;
    let end: number | null = null;
    update.changes.iterChanges((fromA, toA, fromB, toB) => {
        deleted += count(update.startState.doc.sliceString(fromA, toA), recurrenceSymbol);
        const from = Math.max(fromB, line.from);
        const to = Math.min(toB, line.to);
        const onLine = from < to ? count(update.state.doc.sliceString(from, to), recurrenceSymbol) : 0;
        if (onLine > 0) {
            inserted += onLine;
            end = toB;
        }
    });
    if (deleted > 0 || inserted === 0 || count(line.text, recurrenceSymbol) !== inserted) {
        return null;
    }
    return end;
}

/**
 * The text to add to a line that has just got its 🔁: ` 🏁 delete`, or null when the line is left as it is. That is,
 * unless the task format is not the emoji one, the line is not a task (or lacks the global filter), the task is done or
 * cancelled, or the line has a 🏁 already, even with a value that Tasks doesn't know.
 */
export function deleteOnCompletionText(line: string): string | null {
    if (getSettings().taskFormat !== 'tasksPluginEmoji') {
        return null;
    }
    const task = Task.fromLine({
        line,
        taskLocation: TaskLocation.fromUnknownPosition(new TasksFile('')),
        fallbackDate: null,
    });
    if (task === null || task.isDone || line.includes(DEFAULT_SYMBOLS.onCompletionSymbol)) {
        return null;
    }
    return TASK_FORMATS.tasksPluginEmoji.taskSerializer.componentToString(
        new Task({ ...task, onCompletion: OnCompletion.Delete }),
        false,
        TaskLayoutComponent.OnCompletion,
    );
}
