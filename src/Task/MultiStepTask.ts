import { TaskRegularExpressions } from './TaskRegularExpressions';
import { withoutTrailingHorizon } from './Horizon';

/**
 * Fork feature: multi-step tasks. Spec: fork-features/multi-step-tasks.md
 *
 * A task's description can list steps after {@link MULTI_STEP_MARKER}, separated by `//`
 * with whitespace on both sides. A step struck through with `~~` is done; the first step
 * that is not struck through is the current one:
 *
 *     Renew passport 🪜 ~~fill form~~ // get photo // submit
 *
 * Steps are plain description text, so the serializers (and vanilla Tasks) need no change.
 * This module only works on description strings, so it imports nothing from Task.
 */

export const MULTI_STEP_MARKER = '🪜';

const VARIATION_SELECTOR = '\uFE0F';
// The whitespace after `//` is only looked at, not consumed: in `a //  // b` the second `//` needs it.
const STEP_SEPARATOR = /\s+\/\/(?=\s|$)/;
const STRIKE = '~~';

interface Step {
    /** Position of the step's text in the description, without surrounding whitespace and trailing tags */
    start: number;
    end: number;
    done: boolean;
}

export interface StepToggle {
    /** The description with one step struck through or reopened */
    description: string;
    /** True if open steps remain: the task keeps its status and dates */
    keepStatus: boolean;
}

/**
 * The steps in a description, in order. Empty if it has no marker or no steps.
 */
function findSteps(description: string): Step[] {
    const markerIndex = description.indexOf(MULTI_STEP_MARKER);
    if (markerIndex === -1) {
        return [];
    }

    let stepsStart = markerIndex + MULTI_STEP_MARKER.length;
    if (description.startsWith(VARIATION_SELECTOR, stepsStart)) {
        stepsStart += VARIATION_SELECTOR.length;
    }

    const steps: Step[] = [];
    const addStep = (segmentStart: number, segmentEnd: number) => {
        const step = findStepText(description, segmentStart, segmentEnd);
        if (step) {
            steps.push(step);
        }
    };

    const separator = new RegExp(STEP_SEPARATOR.source, 'g');
    separator.lastIndex = stepsStart;
    let segmentStart = stepsStart;
    let match: RegExpExecArray | null;
    while ((match = separator.exec(description)) !== null) {
        addStep(segmentStart, match.index);
        segmentStart = match.index + match[0].length;
    }
    addStep(segmentStart, description.length);
    return steps;
}

/**
 * The step in one segment between separators, or null if it holds nothing but whitespace, tags and a horizon.
 *
 * Trailing tags stay outside the strikethrough: the tag pattern allows `~`, so `~~bake #home~~`
 * would turn the tag into `#home~~`. So does a horizon at the end (t7 fork feature: horizon):
 * `~~submit 🔭 today~~` would make it invalid.
 */
function findStepText(description: string, segmentStart: number, segmentEnd: number): Step | null {
    let text = description.slice(segmentStart, segmentEnd);
    const leadingWhitespace = text.length - text.trimStart().length;
    text = text.trimStart();

    let rest = text;
    do {
        text = rest;
        rest = withoutTrailingHorizon(text.replace(TaskRegularExpressions.hashTagsFromEnd, '').trimEnd());
    } while (rest !== text);
    text = text.trimEnd();

    if (text === '') {
        return null;
    }

    const start = segmentStart + leadingWhitespace;
    const done = text.length >= 2 * STRIKE.length && text.startsWith(STRIKE) && text.endsWith(STRIKE);
    return { start, end: start + text.length, done };
}

function strike(description: string, step: Step) {
    const text = description.slice(step.start, step.end);
    return description.slice(0, step.start) + STRIKE + text + STRIKE + description.slice(step.end);
}

function reopen(description: string, step: Step) {
    const text = description.slice(step.start + STRIKE.length, step.end - STRIKE.length);
    return description.slice(0, step.start) + text + description.slice(step.end);
}

/**
 * What toggling a multi-step task does to its steps, or null if toggling should work as upstream.
 *
 * - Toggling into a DONE status strikes through the current step. If open steps remain after
 *   it, the task keeps its status ({@link StepToggle.keepStatus}); otherwise it is completed as usual.
 * - Toggling out of a DONE status, with every step struck through, reopens the last step.
 *
 * @param description - the task's description
 * @param wasDone - whether the task's status type is DONE
 * @param willBeDone - whether the status the toggle moves to has type DONE
 */
export function toggleStep(description: string, wasDone: boolean, willBeDone: boolean): StepToggle | null {
    const steps = findSteps(description);
    if (steps.length === 0) {
        return null;
    }

    if (!wasDone && willBeDone) {
        const openSteps = steps.filter((step) => !step.done);
        if (openSteps.length === 0) {
            return null;
        }
        return { description: strike(description, openSteps[0]), keepStatus: openSteps.length > 1 };
    }

    if (wasDone && !willBeDone && steps.every((step) => step.done)) {
        return { description: reopen(description, steps[steps.length - 1]), keepStatus: false };
    }

    return null;
}

/**
 * The description with every step reopened, for a new occurrence of a recurring task.
 */
export function resetSteps(description: string): string {
    return findSteps(description)
        .reverse()
        .reduce((result, step) => (step.done ? reopen(result, step) : result), description);
}

export interface StepsMarkerInsertion {
    /** The text from {@link from} to {@link to} is replaced by {@link text} */
    from: number;
    to: number;
    text: string;
    /** Where the cursor goes afterwards: just after the marker and a space, ready for the first step */
    cursor: number;
}

/**
 * How the edit modal's steps button inserts {@link MULTI_STEP_MARKER} into a description: in place of the
 * selection, as typing would, and kept apart from the text on both sides by a space.
 *
 * @param description - the description being edited
 * @param selectionStart - the start of the description field's selection, or its cursor
 * @param selectionEnd - the end of the selection; the same as {@link selectionStart} for a cursor
 */
export function stepsMarkerInsertion(
    description: string,
    selectionStart: number,
    selectionEnd: number,
): StepsMarkerInsertion {
    const from = selectionStart;
    const to = selectionEnd;
    const before = description.slice(0, from);
    const after = description.slice(to);

    const spaceBefore = before === '' || /\s$/.test(before) ? '' : ' ';
    const spaceAfter = after === '' || /^\s/.test(after) ? '' : ' ';
    const text = `${spaceBefore}${MULTI_STEP_MARKER} ${spaceAfter}`;
    return { from, to, text, cursor: from + text.length - spaceAfter.length };
}
