import { DEFAULT_SYMBOLS, DefaultTaskSerializer } from '../TaskSerializer/DefaultTaskSerializer';
import { TaskRegularExpressions } from '../Task/TaskRegularExpressions';
import { HORIZON_MARKER, horizons, setHorizon } from '../Task/Horizon';
import type { SuggestInfo } from '.';

/**
 * t7 fork feature: horizon. Spec: `fork-features/horizon.md`.
 *
 * Right after the horizon marker, offers the horizons that start with what has been typed after it.
 * Elsewhere, when the word before the cursor is the start of `horizon` (at least `hor`) and the line has no
 * marker yet, offers the marker itself, `🔭 horizon`. After the Tasks fields (⏫, 📅 2026-10-20 ...) a horizon
 * would hide them from Tasks, so there it offers the horizons themselves, `🔭 today` and so on, which go
 * before the fields.
 *
 * Not in the Dataview format: its suggestions go inside brackets, and the horizon belongs in the description.
 */
export function horizonSuggestions(line: string, cursorPos: number, dataviewMode: boolean): SuggestInfo[] {
    if (dataviewMode) {
        return [];
    }
    return valueSuggestions(line.slice(0, cursorPos)) ?? markerSuggestions(line, cursorPos);
}

const MIN_MARKER_MATCH = 'hor'.length;

// The marker and the start of a value, up to the cursor. No 'u' flag: the marker is matched as two code units.
const markerAndTypedValue = new RegExp(`${HORIZON_MARKER}\\uFE0F?(\\s*)([a-z]*(?:\\s[a-z]*)?)$`, 'i');

/**
 * Suggestions for a horizon value, or null if the cursor is not just after a marker and the start of a value.
 */
function valueSuggestions(beforeCursor: string): SuggestInfo[] | null {
    const match = markerAndTypedValue.exec(beforeCursor);
    if (match === null) {
        return null;
    }
    const typed = match[2].toLowerCase().replace(/\s+/, ' ');
    return horizons
        .filter((horizon) => horizon.startsWith(typed))
        .map((horizon) => ({
            suggestionType: 'match',
            displayText: horizon,
            appendText: `${HORIZON_MARKER} ${horizon} `,
            insertAt: match.index,
            insertSkip: match[0].length,
        }));
}

function markerSuggestions(line: string, cursorPos: number): SuggestInfo[] {
    if (line.includes(HORIZON_MARKER)) {
        return [];
    }
    const word = /[a-z]*$/i.exec(line.slice(0, cursorPos))![0];
    if (word.length < MIN_MARKER_MATCH || !'horizon'.startsWith(word.toLowerCase())) {
        return [];
    }
    const wordStart = cursorPos - word.length;

    const description = descriptionRange(line.slice(0, wordStart) + line.slice(cursorPos));
    if (description !== null && line.slice(description.end, wordStart).trim() !== '') {
        return horizonsBeforeFields(line, cursorPos, wordStart, description);
    }
    return [
        {
            suggestionType: 'match',
            displayText: `${HORIZON_MARKER} horizon`,
            appendText: `${HORIZON_MARKER} `,
            insertAt: wordStart,
            insertSkip: word.length,
        },
    ];
}

interface TextRange {
    start: number;
    end: number;
}

/**
 * Where the description is in {@link line}, or null if it is not a task line. The description is what Tasks
 * leaves of the text after the checkbox when it has read the fields (⏫, 📅 2026-10-20 ...) and the tags among
 * them from its end.
 */
function descriptionRange(line: string): TextRange | null {
    const match = TaskRegularExpressions.taskRegex.exec(line);
    if (match === null) {
        return null;
    }
    const start = line.length - match[4].trimStart().length;
    // As in Task.extractTaskComponents: the block link at the end is not part of the fields.
    const body = line.slice(start).trimEnd().replace(TaskRegularExpressions.blockLinkRegex, '').trimEnd();
    const { description } = new DefaultTaskSerializer(DEFAULT_SYMBOLS).deserialize(body);

    // Tasks adds the tags it found among the fields back to the end of the description, so the description
    // matches the line only up to the first field.
    let length = 0;
    while (length < description.length && description[length] === body[length]) {
        length++;
    }
    return { start, end: start + length };
}

/**
 * The horizons, for a typed word after the Tasks fields. Choosing one deletes the word and adds the horizon at
 * the end of the {@link description}, before the fields. The cursor stays where the word was.
 */
function horizonsBeforeFields(
    line: string,
    cursorPos: number,
    wordStart: number,
    description: TextRange,
): SuggestInfo[] {
    const afterCursor = line.slice(cursorPos);
    let textEnd = wordStart;
    // 'Call Bob ⏫ hor 📅 ...' becomes 'Call Bob 🔭 today ⏫ 📅 ...', not 'Call Bob 🔭 today ⏫  📅 ...'.
    if (/\s/.test(line[wordStart - 1]) && /^\s/.test(afterCursor)) {
        textEnd--;
    }
    const fields = line.slice(description.end, textEnd).trimStart();
    const descriptionText = line.slice(description.start, description.end);

    return horizons.map((horizon) => ({
        suggestionType: 'match',
        displayText: `${HORIZON_MARKER} ${horizon}`,
        appendText: `${setHorizon(descriptionText, horizon)} ${fields}`,
        insertAt: description.start,
        insertSkip: cursorPos - description.start,
    }));
}
