import type { SuggestorParameters } from './Suggestor';
import type { SuggestInfo } from '.';

/**
 * t7 fork feature: `block` finds depends on. Spec: `fork-features/block-finds-depends-on.md`.
 *
 * Tasks keeps a task property suggestion when the word at the cursor is part of its text, so `block` found nothing:
 * the field that makes a task blocked is `⛔ depends on id`. This offers that suggestion, as Tasks offers it for
 * `dep`, when the word is the start of `blocked`, at least `blo`.
 *
 * @param genericSuggestions - Tasks' task property suggestions, before it keeps the ones that match the word. Depends
 *     on is among them only if the task can have it: the file can be saved, and the line has no depends on yet.
 * @param dependsOnSymbol - the symbol that starts the depends on field, in the task format in use
 * @param parameters - the line, the cursor and the settings
 */
export function dependsOnForBlocked(
    genericSuggestions: SuggestInfo[],
    dependsOnSymbol: string,
    parameters: SuggestorParameters,
): SuggestInfo[] {
    const dependsOn = genericSuggestions.find((suggestion) => suggestion.appendText === `${dependsOnSymbol} `);
    if (!dependsOn) {
        return [];
    }

    // The word around the cursor, found as Tasks finds it for its task property suggestions.
    const { line, cursorPos } = parameters;
    const before = /[a-zA-Z'_-]*$/.exec(line.slice(0, cursorPos))![0];
    const after = /^[a-zA-Z'_-]*/.exec(line.slice(cursorPos))![0];
    const word = before + after;
    const minMatch = Math.max(MIN_MATCH, parameters.settings.autoSuggestMinMatch);
    if (before === '' || word.length < minMatch || !BLOCKED.startsWith(word.toLowerCase())) {
        return [];
    }

    return [
        {
            suggestionType: 'match',
            displayText: dependsOn.displayText,
            appendText: dependsOn.appendText,
            insertAt: cursorPos - before.length,
            insertSkip: word.length,
        },
    ];
}

const BLOCKED = 'blocked';
const MIN_MATCH = 'blo'.length;
