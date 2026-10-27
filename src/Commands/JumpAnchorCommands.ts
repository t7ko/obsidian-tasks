import type { Editor, EditorPosition, Plugin } from 'obsidian';
import { Notice } from 'obsidian';

/**
 * t7 fork feature: jump anchor. Spec: `fork-features/jump-anchor.md`.
 *
 * The editor commands `Go to jump anchor` and `New entry at jump anchor`, which bring the cursor to the line with the
 * block ID `^jump-anchor` in the active note. Call once from the plugin's `onload()`.
 */
export function registerJumpAnchorCommands(plugin: Plugin): void {
    plugin.addCommand({
        id: 'go-to-jump-anchor',
        name: 'Go to jump anchor',
        icon: 'anchor',
        hotkeys: [{ modifiers: ['Mod'], key: 'J' }],
        editorCallback: (editor: Editor) => goToJumpAnchor(editor, false),
    });

    plugin.addCommand({
        id: 'new-entry-at-jump-anchor',
        name: 'New entry at jump anchor',
        icon: 'list-plus',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'J' }],
        editorCallback: (editor: Editor) => goToJumpAnchor(editor, true),
    });
}

const jumpAnchorRegex = /\s\^jump-anchor\s*$/;

// Indentation (with the '>' of quotes), list marker and the spaces after it, of a checkbox item.
const checkboxItemRegex = /^([\s>]*)(?:([-*+])|([0-9]+)([.)]))( +)\[.\]/u;

/**
 * Put the cursor at the end of the first line with `^jump-anchor` and scroll to it. With {@link newEntry}, then start
 * a new line under it, as Enter would, if it is a checkbox item; otherwise show a notice. Without an anchor, show a
 * notice and leave the cursor alone.
 */
export function goToJumpAnchor(editor: Editor, newEntry: boolean): void {
    const lineNumber = findJumpAnchor(editor);
    if (lineNumber === null) {
        new Notice('No ^jump-anchor in this note');
        return;
    }

    const line = editor.getLine(lineNumber);
    let cursor: EditorPosition = { line: lineNumber, ch: line.length };
    if (newEntry) {
        const prefix = newEntryPrefix(line);
        if (prefix === null) {
            new Notice('The ^jump-anchor line has no checkbox: no entry added');
        } else {
            editor.replaceRange('\n' + prefix, cursor);
            cursor = { line: lineNumber + 1, ch: prefix.length };
        }
    }
    editor.setCursor(cursor);
    editor.scrollIntoView({ from: cursor, to: cursor }, true);
    editor.focus();
}

/**
 * The number of the first line ending with the block ID `^jump-anchor`, or null if there is none.
 */
export function findJumpAnchor(editor: Editor): number | null {
    for (let lineNumber = 0; lineNumber < editor.lineCount(); lineNumber++) {
        if (jumpAnchorRegex.test(editor.getLine(lineNumber))) {
            return lineNumber;
        }
    }
    return null;
}

/**
 * The start of the line Enter would give after the checkbox item {@link anchorLine}: the same indentation and list
 * marker (the next number for a numbered item), and an empty checkbox. Null if the line is not a checkbox item.
 */
export function newEntryPrefix(anchorLine: string): string | null {
    const match = anchorLine.match(checkboxItemRegex);
    if (match === null) {
        return null;
    }
    const [, indentation, bullet, number, punctuation, spaces] = match;
    const marker = bullet ?? `${Number(number) + 1}${punctuation}`;
    return indentation + marker + spaces + '[ ] ';
}
