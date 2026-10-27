import type { Editor, MarkdownFileInfo, MarkdownView, Menu, Plugin } from 'obsidian';
import { TasksFile } from '../Scripting/TasksFile';
import { completePermanently } from '../Task/CompletePermanently';
import { Task } from '../Task/Task';
import { TaskLocation } from '../Task/TaskLocation';

/**
 * t7 fork feature: complete permanently. Spec: `fork-features/complete-permanently.md`.
 *
 * The editor command `Complete permanently` for the recurring task on the cursor's line, and the same item in the
 * editor's context menu (Live Preview and Source mode). Call once from the plugin's `onload()`.
 */
export function registerCompletePermanentlyCommand(plugin: Plugin): void {
    plugin.addCommand({
        id: 'complete-permanently',
        name: 'Complete permanently',
        icon: COMPLETE_PERMANENTLY_ICON,
        editorCheckCallback: (checking: boolean, editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
            const lineNumber = editor.getCursor().line;
            const line = completePermanentlyLine(editor.getLine(lineNumber), ctx.file?.path ?? '');
            if (checking || line === null) {
                return line !== null;
            }
            replaceLine(editor, lineNumber, line);
            return true;
        },
    });

    plugin.registerEvent(
        plugin.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) =>
            addCompletePermanentlyItem(menu, editor, info.file?.path ?? ''),
        ),
    );
}

// Lucide's double check mark, which Obsidian has.
const COMPLETE_PERMANENTLY_ICON = 'check-check';

/**
 * The line of the task on {@link line} completed permanently, or null if it is not a task or can't be.
 */
export function completePermanentlyLine(line: string, path: string): string | null {
    const task = Task.fromLine({
        line,
        taskLocation: TaskLocation.fromUnknownPosition(new TasksFile(path)),
        fallbackDate: null,
    });
    if (task === null) {
        return null;
    }
    return completePermanently(task)?.toFileLineString() ?? null;
}

/**
 * Add `Complete permanently` to an editor's context menu, when the cursor is on a task line that can be completed
 * permanently. A right-click puts the cursor where it clicks, unless it clicks inside the selection.
 */
export function addCompletePermanentlyItem(menu: Menu, editor: Editor, path: string): void {
    const lineNumber = editor.getCursor().line;
    if (completePermanentlyLine(editor.getLine(lineNumber), path) === null) {
        return;
    }
    menu.addItem((item) =>
        item
            .setTitle('Complete permanently')
            .setIcon(COMPLETE_PERMANENTLY_ICON)
            .onClick(() => {
                // Work out the change from the line as it is now.
                const line = completePermanentlyLine(editor.getLine(lineNumber), path);
                if (line !== null) {
                    replaceLine(editor, lineNumber, line);
                }
            }),
    );
}

function replaceLine(editor: Editor, lineNumber: number, line: string): void {
    const end = editor.getLine(lineNumber).length;
    editor.replaceRange(line, { line: lineNumber, ch: 0 }, { line: lineNumber, ch: end });
}
