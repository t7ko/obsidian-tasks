import type { Editor, MarkdownFileInfo, MarkdownView, Menu, Plugin } from 'obsidian';
import { TasksFile } from '../Scripting/TasksFile';
import { splitTask } from '../Task/SplitTask';
import { Task } from '../Task/Task';
import { TaskLocation } from '../Task/TaskLocation';

/**
 * t7 fork feature: split tasks. Spec: `fork-features/split-tasks.md`.
 *
 * The editor command `Split task` for the task on the cursor's line, and the same item in the editor's context menu
 * (Live Preview and Source mode). Call once from the plugin's `onload()`.
 */
export function registerSplitTaskCommand(plugin: Plugin): void {
    plugin.addCommand({
        id: 'split-task',
        name: 'Split task',
        icon: SPLIT_ICON,
        editorCheckCallback: (checking: boolean, editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
            const lineNumber = editor.getCursor().line;
            const lines = splitTaskLine(editor.getLine(lineNumber), ctx.file?.path ?? '');
            if (checking || lines === null) {
                return lines !== null;
            }
            replaceLine(editor, lineNumber, lines);
            return true;
        },
    });

    plugin.registerEvent(
        plugin.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) =>
            addSplitTaskItem(menu, editor, info.file?.path ?? ''),
        ),
    );
}

// Lucide's split arrow, which Obsidian has.
const SPLIT_ICON = 'split';

/**
 * The lines the task on {@link line} splits into, or null if it is not a task or can't be split.
 */
export function splitTaskLine(line: string, path: string): string[] | null {
    const task = Task.fromLine({
        line,
        taskLocation: TaskLocation.fromUnknownPosition(new TasksFile(path)),
        fallbackDate: null,
    });
    if (task === null) {
        return null;
    }
    return splitTask(task)?.map((newTask) => newTask.toFileLineString()) ?? null;
}

/**
 * Add `Split task` to an editor's context menu, when the cursor is on a task line that can be split.
 * A right-click puts the cursor where it clicks, unless it clicks inside the selection.
 */
export function addSplitTaskItem(menu: Menu, editor: Editor, path: string): void {
    const lineNumber = editor.getCursor().line;
    if (splitTaskLine(editor.getLine(lineNumber), path) === null) {
        return;
    }
    menu.addItem((item) =>
        item
            .setTitle('Split task')
            .setIcon(SPLIT_ICON)
            .onClick(() => {
                // Work out the change from the line as it is now.
                const lines = splitTaskLine(editor.getLine(lineNumber), path);
                if (lines !== null) {
                    replaceLine(editor, lineNumber, lines);
                }
            }),
    );
}

function replaceLine(editor: Editor, lineNumber: number, lines: string[]): void {
    const end = editor.getLine(lineNumber).length;
    editor.replaceRange(lines.join('\n'), { line: lineNumber, ch: 0 }, { line: lineNumber, ch: end });
}
