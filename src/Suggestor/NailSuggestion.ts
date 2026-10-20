import { NAIL_MARKER, addNail, descriptionStart, nailCount, removeNail } from '../Task/Nails';
import type { SuggestInfo } from '.';

/**
 * t7 fork feature: nails. Spec: `fork-features/nails.md`.
 *
 * When the word before the cursor is the start of `nail` (at least `nai`), offers `⚠️ add nail` and, if the task
 * has nails, `⚠️ remove nail`. Choosing one deletes the typed word and adds or removes a nail at the start of the
 * description, wherever the cursor is.
 *
 * Not in the Dataview format: its suggestions go inside brackets.
 */
export function nailSuggestions(line: string, cursorPos: number, dataviewMode: boolean): SuggestInfo[] {
    if (dataviewMode) {
        return [];
    }
    const start = descriptionStart(line);
    if (start === null || cursorPos < start) {
        return [];
    }
    const word = /[a-z]*$/i.exec(line.slice(start, cursorPos))![0];
    if (word.length < MIN_MATCH || !'nail'.startsWith(word.toLowerCase())) {
        return [];
    }

    const afterCursor = line.slice(cursorPos);
    let wordStart = cursorPos - word.length;
    // 'Call Bob nail 📅 ...' becomes 'Call Bob 📅 ...', not 'Call Bob  📅 ...'.
    if (wordStart > start && /\s/.test(line[wordStart - 1]) && /^\s/.test(afterCursor)) {
        wordStart--;
    }
    const description = line.slice(start, wordStart) + afterCursor;

    const suggestions = [suggestion('add nail', addNailForTyping(description), start, cursorPos, line)];
    if (nailCount(description) > 0) {
        suggestions.push(suggestion('remove nail', removeNail(description), start, cursorPos, line));
    }
    return suggestions;
}

const MIN_MATCH = 'nai'.length;

/**
 * Like {@link addNail}, but a description without text gets a space after the nail, ready for typing.
 */
function addNailForTyping(description: string): string {
    return description === '' ? `${NAIL_MARKER} ` : addNail(description);
}

/**
 * A suggestion that turns the description, from {@link start} to the end of {@link line}, into {@link newDescription}.
 * It replaces only the text up to the cursor if the text after it stays, so the cursor stays before that text.
 */
function suggestion(
    action: string,
    newDescription: string,
    start: number,
    cursorPos: number,
    line: string,
): SuggestInfo {
    const afterCursor = line.slice(cursorPos);
    const keepsAfterCursor = newDescription.endsWith(afterCursor);
    return {
        suggestionType: 'match',
        displayText: `${NAIL_MARKER} ${action}`,
        appendText: keepsAfterCursor
            ? newDescription.slice(0, newDescription.length - afterCursor.length)
            : newDescription,
        insertAt: start,
        insertSkip: (keepsAfterCursor ? cursorPos : line.length) - start,
    };
}
