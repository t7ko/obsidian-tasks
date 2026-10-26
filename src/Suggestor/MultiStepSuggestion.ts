import { MULTI_STEP_MARKER } from '../Task/MultiStepTask';
import type { SuggestorParameters } from './Suggestor';
import type { SuggestInfo } from '.';

/**
 * Fork feature: multi-step tasks. Spec: fork-features/multi-step-tasks.md
 *
 * Offers the steps marker among the task property suggestions, unless the line already has it.
 * Not in the Dataview format: its suggestions go inside brackets, and steps belong in the description.
 *
 * Tasks keeps the suggestion when the word at the cursor is part of `🪜 steps`. It is also kept when the word is
 * the start of `ladder`, at least `lad`.
 */
export function addMultiStepSuggestion(genericSuggestions: SuggestInfo[], parameters: SuggestorParameters) {
    const { line, dataviewMode } = parameters;
    if (dataviewMode || line.includes(MULTI_STEP_MARKER)) {
        return;
    }
    const suggestion: SuggestInfo = {
        displayText: `${MULTI_STEP_MARKER} steps`,
        appendText: `${MULTI_STEP_MARKER} `,
    };
    if (isLadderAtCursor(parameters)) {
        suggestion.textToMatch = `${suggestion.displayText} ${LADDER}`;
    }
    genericSuggestions.push(suggestion);
}

/**
 * Whether the word around the cursor, found as Tasks finds it for its task property suggestions, is the start of
 * `ladder`, at least `lad`.
 */
function isLadderAtCursor({ line, cursorPos }: SuggestorParameters) {
    const before = /[a-zA-Z'_-]*$/.exec(line.slice(0, cursorPos))![0];
    const after = /^[a-zA-Z'_-]*/.exec(line.slice(cursorPos))![0];
    const word = before + after;
    return before !== '' && word.length >= MIN_MATCH && LADDER.startsWith(word.toLowerCase());
}

const LADDER = 'ladder';
const MIN_MATCH = 'lad'.length;
