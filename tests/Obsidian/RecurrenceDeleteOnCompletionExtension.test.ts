import { EditorSelection, EditorState, type Extension, type Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import moment from 'moment';
import { GlobalFilter } from '../../src/Config/GlobalFilter';
import {
    deleteOnCompletionForTypedRecurrence,
    saveDeleteOnCompletionForTypedRecurrence,
} from '../../src/Config/RecurrenceDeleteOnCompletionSetting';
import { TASK_FORMATS, getSettings, resetSettings, updateSettings } from '../../src/Config/Settings';
import {
    deleteOnCompletionText,
    recurrenceDeleteOnCompletionExtension,
} from '../../src/Obsidian/RecurrenceDeleteOnCompletionExtension';
import { TasksFile } from '../../src/Scripting/TasksFile';
import { OnCompletion } from '../../src/Task/OnCompletion';
import { Task } from '../../src/Task/Task';
import { TaskLocation } from '../../src/Task/TaskLocation';

window.moment = moment;

afterEach(() => {
    GlobalFilter.getInstance().reset();
    resetSettings();
});

function taskFrom(line: string) {
    return Task.fromLine({
        line,
        taskLocation: TaskLocation.fromUnknownPosition(new TasksFile('')),
        fallbackDate: null,
    });
}

describe('deleteOnCompletionText', () => {
    it('should give 🏁 delete for a task that has just got its 🔁', () => {
        expect(deleteOnCompletionText('- [ ] Pay rent 🔁')).toEqual(' 🏁 delete');
        expect(deleteOnCompletionText('- [ ] Pay rent 🔁 ')).toEqual(' 🏁 delete');
        expect(deleteOnCompletionText('    - [/] Pay rent 🔁 📅 2026-11-01')).toEqual(' 🏁 delete');
    });

    it('should leave a task that has a 🏁 already', () => {
        expect(deleteOnCompletionText('- [ ] Pay rent 🔁 🏁 keep')).toBeNull();
        expect(deleteOnCompletionText('- [ ] Pay rent 🔁 🏁 delete')).toBeNull();
        expect(deleteOnCompletionText('- [ ] Pay rent 🔁 🏁 later')).toBeNull();
    });

    it('should leave done and cancelled tasks, and lines that are not tasks', () => {
        expect(deleteOnCompletionText('- [x] Pay rent 🔁 ✅ 2026-10-21')).toBeNull();
        expect(deleteOnCompletionText('- [-] Pay rent 🔁 ❌ 2026-10-21')).toBeNull();
        expect(deleteOnCompletionText('Pay rent 🔁')).toBeNull();
        expect(deleteOnCompletionText('- Pay rent 🔁')).toBeNull();
    });

    it('should leave a task without the global filter', () => {
        GlobalFilter.getInstance().set('#task');
        expect(deleteOnCompletionText('- [ ] Pay rent 🔁')).toBeNull();
        expect(deleteOnCompletionText('- [ ] #task Pay rent 🔁')).toEqual(' 🏁 delete');
    });

    it('should do nothing in the Dataview format', () => {
        updateSettings({ taskFormat: 'dataview' });
        expect(deleteOnCompletionText('- [ ] Pay rent 🔁')).toBeNull();
    });
});

describe('the setting', () => {
    it('should be off by default', () => {
        expect(deleteOnCompletionForTypedRecurrence()).toEqual(false);
    });

    it('should be off for settings saved before it was added', () => {
        updateSettings({ t7: { horizonHistory: getSettings().t7.horizonHistory } });
        expect(deleteOnCompletionForTypedRecurrence()).toEqual(false);
    });

    it('should save the toggle', async () => {
        const plugin = { saveSettings: vi.fn(async () => {}) };
        await saveDeleteOnCompletionForTypedRecurrence(plugin, true);
        expect(deleteOnCompletionForTypedRecurrence()).toEqual(true);
        expect(getSettings().t7.horizon?.placeholder).toEqual(true);
        expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    });
});

describe('recurrenceDeleteOnCompletionExtension', () => {
    const plugin = { saveSettings: async () => {} };
    let view: EditorView;
    let transactions: Transaction[];

    /** A view with the cursor at the end of its first line */
    function newView(doc: string[], ...extensions: Extension[]) {
        transactions = [];
        const editorView = new EditorView({
            doc: doc.join('\n'),
            selection: EditorSelection.cursor(doc[0].length),
            extensions: [
                recurrenceDeleteOnCompletionExtension(),
                EditorView.updateListener.of((update) => transactions.push(...update.transactions)),
                ...extensions,
            ],
        });
        document.body.appendChild(editorView.dom);
        return editorView;
    }

    function replaceView(doc: string[], ...extensions: Extension[]) {
        view.destroy();
        view.dom.remove();
        view = newView(doc, ...extensions);
    }

    function head() {
        return view.state.selection.main.head;
    }

    function setCursor(pos: number) {
        view.dispatch({ selection: EditorSelection.cursor(pos), userEvent: 'select' });
    }

    function type(text: string, userEvent = 'input.type') {
        const from = head();
        view.dispatch({
            changes: { from, insert: text },
            selection: EditorSelection.cursor(from + text.length),
            userEvent,
        });
    }

    function backspace(length: number) {
        view.dispatch({ changes: { from: head() - length, to: head() }, userEvent: 'delete.backward' });
    }

    /**
     * Pick a suggestion from Tasks' auto-suggest, as its popup does: `editor.replaceRange()`, then `editor.setCursor()`.
     */
    function pick(displayText: string) {
        const line = view.state.doc.lineAt(head());
        const cursorPos = head() - line.from;
        const suggestions = TASK_FORMATS.tasksPluginEmoji.buildSuggestions(
            line.text,
            cursorPos,
            getSettings(),
            [],
            true,
        );
        const suggestion = suggestions.find((s) => s.displayText === displayText);
        if (suggestion === undefined) {
            throw new Error(`No '${displayText}' in ${suggestions.map((s) => s.displayText).join(', ')}`);
        }
        const from = line.from + (suggestion.insertAt ?? cursorPos);
        const to = suggestion.insertSkip ? from + suggestion.insertSkip : from;
        view.dispatch({ changes: { from, to, insert: suggestion.appendText } });
        setCursor(from + suggestion.appendText.length);
    }

    function lines() {
        return view.state.doc.toString().split('\n');
    }

    /** Let the extension's edits run */
    async function settle() {
        await Promise.resolve();
    }

    beforeEach(async () => {
        await saveDeleteOnCompletionForTypedRecurrence(plugin, true);
        view = newView(['- [ ] Pay rent', '']);
    });

    afterEach(() => {
        view.destroy();
        view.dom.remove();
    });

    it('should add 🏁 delete as soon as 🔁 is typed, with the cursor before it', async () => {
        type(' 🔁');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 🏁 delete');
        expect(head()).toEqual('- [ ] Pay rent 🔁'.length);

        type(' every month');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 every month 🏁 delete');
        const task = taskFrom(lines()[0])!;
        expect(task.onCompletion).toEqual(OnCompletion.Delete);
        expect(task.recurrence?.toText()).toEqual('every month');
        expect(task.description).toEqual('Pay rent');
    });

    it('should add it when 🔁 is picked from the auto-suggest, then the rule', async () => {
        type(' rec');
        pick('🔁 recurring (repeat)');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁  🏁 delete');
        expect(head()).toEqual('- [ ] Pay rent 🔁 '.length);

        pick('every month');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 every month 🏁 delete');
    });

    it('should add it when the 🔁 goes in after the cursor and the cursor follows', async () => {
        type(' ');
        // replaceRange() at the cursor leaves the cursor before the text, until setCursor().
        view.dispatch({ changes: { from: head(), insert: '🔁 ' } });
        expect(head()).toEqual('- [ ] Pay rent '.length);
        setCursor(head() + '🔁 '.length);
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁  🏁 delete');
    });

    it('should add it before other fields', async () => {
        replaceView(['- [ ] Pay rent 📅 2026-11-01', '']);
        setCursor('- [ ] Pay rent'.length);
        type(' 🔁');
        await settle();
        type(' every month');
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 every month 🏁 delete 📅 2026-11-01');
        expect(taskFrom(lines()[0])?.dueDate?.format('YYYY-MM-DD')).toEqual('2026-11-01');
    });

    it('should add it as an edit of its own', async () => {
        type(' 🔁');
        transactions = [];
        await settle();
        expect(transactions.length).toEqual(1);
        expect(transactions[0].isUserEvent('t7.deleteOnCompletion')).toEqual(true);
        expect(transactions[0].isUserEvent('input')).toEqual(false);
    });

    it('should do nothing with the setting off', async () => {
        await saveDeleteOnCompletionForTypedRecurrence(plugin, false);
        type(' 🔁');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁');
    });

    it('should leave a task that has a 🏁 already', async () => {
        replaceView(['- [ ] Pay rent 🏁 keep', '']);
        setCursor('- [ ] Pay rent'.length);
        type(' 🔁');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 🏁 keep');
    });

    it('should leave a task that was recurring already', async () => {
        replaceView(['- [ ] Pay rent 🔁 every month', '']);
        type(' 🔁');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 every month 🔁');
    });

    it('should leave lines that are not tasks', async () => {
        replaceView(['Pay rent', '']);
        type(' 🔁');
        await settle();
        expect(lines()[0]).toEqual('Pay rent 🔁');
    });

    it('should leave pasted and dropped text', async () => {
        type(' 🔁 every month', 'input.paste');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 every month');

        replaceView(['- [ ] Pay rent', '']);
        type(' 🔁 every month', 'input.drop');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 every month');
    });

    it('should leave a recurring task that is moved', async () => {
        replaceView(['- [ ] Pay rent 🔁 every month', '- [ ] Call Bob']);
        const moved = '- [ ] Pay rent 🔁 every month';
        const end = view.state.doc.length;
        view.dispatch({
            changes: [
                { from: 0, to: view.state.doc.line(2).from },
                { from: end, insert: '\n' + moved },
            ],
            selection: EditorSelection.cursor(end - view.state.doc.line(2).from + 1 + moved.length),
            userEvent: 'move.line',
        });
        await settle();
        expect(lines()).toEqual(['- [ ] Call Bob', moved]);
    });

    it('should leave a 🔁 that is not inserted at the cursor, as by a change to the file', async () => {
        replaceView(['- [ ] Pay rent 📅 2026-11-01', '']);
        view.dispatch({ changes: { from: '- [ ] Pay rent'.length, insert: ' 🔁 every month' } });
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 every month 📅 2026-11-01');
    });

    it('should leave a 🔁 put back by undo or redo', async () => {
        type(' 🔁', 'undo');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁');
    });

    it('should remove the 🏁 delete when the 🔁 goes while the cursor is on the line', async () => {
        type(' 🔁');
        await settle();
        backspace('🔁'.length);
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent ');
    });

    it('should keep the 🏁 delete when the 🔁 goes after the cursor has left the line', async () => {
        type(' 🔁');
        await settle();
        type(' every month');
        setCursor(view.state.doc.line(2).from);
        setCursor('- [ ] Pay rent 🔁 every month'.length);
        backspace('🔁 every month'.length);
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent  🏁 delete');
    });

    it('should not add it again after the user removed it', async () => {
        type(' 🔁');
        await settle();
        const line = view.state.doc.line(1);
        view.dispatch({ changes: { from: line.to - ' 🏁 delete'.length, to: line.to }, userEvent: 'delete.forward' });
        type(' every month');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁 every month');
    });

    it('should do nothing in a read-only editor', async () => {
        replaceView(['- [ ] Pay rent', ''], EditorState.readOnly.of(true));
        type(' 🔁');
        await settle();
        expect(lines()[0]).toEqual('- [ ] Pay rent 🔁');
    });
});
