import { MULTI_STEP_MARKER } from '../Task/MultiStepTask';
import type { SuggestInfo } from '.';

/**
 * Fork feature: multi-step tasks. Spec: fork-features/multi-step-tasks.md
 *
 * Offers the steps marker among the task property suggestions, unless the line already has it.
 * Not in the Dataview format: its suggestions go inside brackets, and steps belong in the description.
 */
export function addMultiStepSuggestion(genericSuggestions: SuggestInfo[], line: string, dataviewMode: boolean) {
    if (dataviewMode || line.includes(MULTI_STEP_MARKER)) {
        return;
    }
    genericSuggestions.push({
        displayText: `${MULTI_STEP_MARKER} steps`,
        appendText: `${MULTI_STEP_MARKER} `,
    });
}
