import { TaskRegularExpressions } from './TaskRegularExpressions';

/**
 * t7 fork feature: nails. Spec: `fork-features/nails.md`.
 *
 * A task waiting in the backlog gets a nail each time someone asks for it again: a {@link NAIL_MARKER}
 * at the start of its description. The more nails, the more urgent the task.
 *
 *     ⚠️⚠️ Ship the export feature
 *
 * Nails are plain description text, so the serializers (and vanilla Tasks) need no change.
 * This module only works on strings, so it imports nothing from Task.
 */

/**
 * The nail that is written: ⚠ (U+26A0) with the emoji variation selector (U+FE0F).
 * A ⚠ without the selector counts as a nail too.
 */
export const NAIL_MARKER = '\u26A0\uFE0F';

// The nails at the start of a text: ⚠, with or without U+FE0F, and any whitespace between and after them.
const LEADING_NAILS = /^(?:\u26A0\uFE0F?\s*)+/;
const FIRST_NAIL = /^\u26A0\uFE0F?/;

// Everything before a task line's description: indentation, list marker, checkbox and the spaces after it.
const BEFORE_DESCRIPTION = new RegExp(
    TaskRegularExpressions.indentationRegex.source +
        TaskRegularExpressions.listMarkerRegex.source +
        ' +' +
        TaskRegularExpressions.checkboxRegex.source +
        ' *',
    'u',
);

/**
 * The number of nails at the start of {@link text}, a task's description. Nails elsewhere in the text are ordinary text.
 */
export function nailCount(text: string): number {
    const match = LEADING_NAILS.exec(text);
    if (match === null) {
        return 0;
    }
    return match[0].split('\u26A0').length - 1;
}

/**
 * {@link text} with one more nail at its start. The first nail is followed by a space; later ones join the others.
 */
export function addNail(text: string): string {
    if (nailCount(text) > 0) {
        return NAIL_MARKER + text;
    }
    return text === '' ? NAIL_MARKER : `${NAIL_MARKER} ${text}`;
}

/**
 * {@link text} with its first nail, and the whitespace after it, removed. Unchanged if it has no nails.
 */
export function removeNail(text: string): string {
    if (nailCount(text) === 0) {
        return text;
    }
    return text.replace(FIRST_NAIL, '').trimStart();
}

/**
 * Where the description of a task line starts, or null if {@link line} has no checkbox.
 */
export function descriptionStart(line: string): number | null {
    const match = BEFORE_DESCRIPTION.exec(line);
    return match === null ? null : match[0].length;
}

/**
 * A change to one line: replace the text between {@link from} and {@link to} with {@link text}.
 */
export interface LineEdit {
    from: number;
    to: number;
    text: string;
}

/**
 * The change that adds a nail to the task on {@link line}, or null if it is not a task line.
 * Text is only inserted at the description's start, so an editor keeps the cursor on the same text.
 */
export function addNailEdit(line: string): LineEdit | null {
    const start = descriptionStart(line);
    if (start === null) {
        return null;
    }
    const description = line.slice(start);
    const added = addNail(description);
    const text = added.slice(0, added.length - description.length);
    // The description needs a space after the checkbox: '- [ ]x' becomes '- [ ] ⚠️ x'.
    const needsSpace = line[start - 1] === ']';
    return { from: start, to: start, text: needsSpace ? ' ' + text : text };
}

/**
 * The change that removes a nail from the task on {@link line}, or null if it is not a task line or has no nails.
 */
export function removeNailEdit(line: string): LineEdit | null {
    const start = descriptionStart(line);
    if (start === null) {
        return null;
    }
    const description = line.slice(start);
    if (nailCount(description) === 0) {
        return null;
    }
    const removedLength = description.length - removeNail(description).length;
    return { from: start, to: start + removedLength, text: '' };
}

/**
 * {@link line} with {@link edit} applied.
 */
export function applyLineEdit(line: string, edit: LineEdit): string {
    return line.slice(0, edit.from) + edit.text + line.slice(edit.to);
}
