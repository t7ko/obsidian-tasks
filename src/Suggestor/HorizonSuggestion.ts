import { HORIZON_MARKER, horizons } from '../Task/Horizon';
import { allTaskPluginEmojis } from '../TaskSerializer/DefaultTaskSerializer';
import type { SuggestInfo } from '.';

/**
 * t7 fork feature: horizon. Spec: `fork-features/horizon.md`.
 *
 * Right after the horizon marker, offers the horizons that start with what has been typed after it.
 * Elsewhere, offers the marker itself, `🔭 horizon`, when the word before the cursor is the start of
 * `horizon` (at least `hor`), but only where a horizon is safe: the line has no marker yet and no
 * Tasks field comes before the cursor. A horizon after the fields would hide them from Tasks.
 *
 * Not in the Dataview format: its suggestions go inside brackets, and the horizon belongs in the description.
 */
export function horizonSuggestions(line: string, cursorPos: number, dataviewMode: boolean): SuggestInfo[] {
    if (dataviewMode) {
        return [];
    }
    const beforeCursor = line.slice(0, cursorPos);
    return valueSuggestions(beforeCursor) ?? markerSuggestions(line, beforeCursor);
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

function markerSuggestions(line: string, beforeCursor: string): SuggestInfo[] {
    if (line.includes(HORIZON_MARKER) || allTaskPluginEmojis().some((emoji) => beforeCursor.includes(emoji))) {
        return [];
    }
    const word = /[a-z]*$/i.exec(beforeCursor)![0];
    if (word.length < MIN_MARKER_MATCH || !'horizon'.startsWith(word.toLowerCase())) {
        return [];
    }
    return [
        {
            suggestionType: 'match',
            displayText: `${HORIZON_MARKER} horizon`,
            appendText: `${HORIZON_MARKER} `,
            insertAt: beforeCursor.length - word.length,
            insertSkip: word.length,
        },
    ];
}
