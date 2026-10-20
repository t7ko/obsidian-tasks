import type { Editor, Menu, Plugin } from 'obsidian';
import { type LineEdit, addNailEdit, removeNailEdit } from '../Task/Nails';

/**
 * t7 fork feature: nails. Spec: `fork-features/nails.md`.
 *
 * Editor commands `Add nail` and `Remove nail` for the task on the cursor's line, and the same two items in the
 * editor's context menu (Live Preview and Source mode). Call once from the plugin's `onload()`.
 */
export function registerNailCommands(plugin: Plugin): void {
    for (const action of nailActions) {
        plugin.addCommand({
            id: action.id,
            name: action.name,
            icon: NAIL_ICON,
            editorCheckCallback: (checking: boolean, editor: Editor) => {
                const lineNumber = editor.getCursor().line;
                const edit = action.edit(editor.getLine(lineNumber));
                if (checking || edit === null) {
                    return edit !== null;
                }
                applyEdit(editor, lineNumber, edit);
                return true;
            },
        });
    }

    plugin.registerEvent(
        plugin.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => addNailItems(menu, editor)),
    );
}

interface NailAction {
    id: string;
    name: string;
    edit: (line: string) => LineEdit | null;
}

const nailActions: NailAction[] = [
    { id: 'add-nail', name: 'Add nail', edit: addNailEdit },
    { id: 'remove-nail', name: 'Remove nail', edit: removeNailEdit },
];

// Lucide's warning triangle, which Obsidian has, for the ⚠️ of a nail.
const NAIL_ICON = 'triangle-alert';

/**
 * Add `Add nail` and, if the task has nails, `Remove nail` to an editor's context menu, when the cursor is on a
 * task line. A right-click puts the cursor where it clicks, unless it clicks inside the selection.
 */
export function addNailItems(menu: Menu, editor: Editor): void {
    const lineNumber = editor.getCursor().line;
    const line = editor.getLine(lineNumber);
    for (const action of nailActions) {
        if (action.edit(line) === null) {
            continue;
        }
        menu.addItem((item) =>
            item
                .setTitle(action.name)
                .setIcon(NAIL_ICON)
                .onClick(() => {
                    // Work out the change from the line as it is now.
                    const edit = action.edit(editor.getLine(lineNumber));
                    if (edit !== null) {
                        applyEdit(editor, lineNumber, edit);
                    }
                }),
        );
    }
}

/**
 * Apply {@link edit} with a replacement of just the changed text, so the editor keeps the cursor on the same text.
 */
function applyEdit(editor: Editor, lineNumber: number, edit: LineEdit): void {
    editor.replaceRange(edit.text, { line: lineNumber, ch: edit.from }, { line: lineNumber, ch: edit.to });
}
