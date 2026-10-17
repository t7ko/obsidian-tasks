import { MULTI_STEP_MARKER } from './MultiStepTask';

/**
 * t7 fork feature: horizon. Spec: `fork-features/horizon.md`.
 *
 * A task's description can say when the task is meant to be done, with {@link HORIZON_MARKER}
 * followed by one of the {@link horizons}:
 *
 *     Draft the quarterly report 🔭 this week
 *
 * The horizon is plain description text, so the serializers (and vanilla Tasks) need no change.
 * This module only works on description strings, so it imports nothing from Task.
 */

export const HORIZON_MARKER = '🔭';

/**
 * The horizons in their order of meaning, as written in descriptions.
 */
export const horizons = ['today', 'tomorrow', 'this week', 'next week', 'this month', 'next month'] as const;

export type Horizon = (typeof horizons)[number];

/**
 * A description's horizon: one of the {@link horizons}, `'invalid'` for a marker not followed by one,
 * or `'none'` for no marker.
 */
export type HorizonState = Horizon | 'invalid' | 'none';

const VARIATION_SELECTOR = '\uFE0F';

// Applied to the text after the marker. The value must end at whitespace or the end of the description.
const VALUE_AFTER_MARKER = /^\s+(today|tomorrow|(?:this|next)\s+(?:week|month))(?=\s|$)/i;

export interface HorizonToken {
    state: Horizon | 'invalid';
    /** Position of the token in the text: the marker and, if valid, the whitespace and value after it */
    start: number;
    end: number;
}

/**
 * The first horizon marker in {@link text}, or null if it has none.
 *
 * An invalid horizon's token is the marker alone, so that editing it never touches the text after it.
 */
export function findHorizonToken(text: string): HorizonToken | null {
    const start = text.indexOf(HORIZON_MARKER);
    if (start === -1) {
        return null;
    }

    let markerEnd = start + HORIZON_MARKER.length;
    if (text.startsWith(VARIATION_SELECTOR, markerEnd)) {
        markerEnd += VARIATION_SELECTOR.length;
    }

    const match = VALUE_AFTER_MARKER.exec(text.slice(markerEnd));
    if (match === null) {
        return { state: 'invalid', start, end: markerEnd };
    }
    const horizon = match[1].toLowerCase().split(/\s+/).join(' ') as Horizon;
    return { state: horizon, start, end: markerEnd + match[0].length };
}

export function horizonOf(description: string): HorizonState {
    return findHorizonToken(description)?.state ?? 'none';
}

/**
 * Sort key for the order of meaning: invalid first, then the {@link horizons}, then no horizon.
 */
export function horizonRank(state: HorizonState): number {
    switch (state) {
        case 'invalid':
            return 0;
        case 'none':
            return horizons.length + 1;
        default:
            return horizons.indexOf(state) + 1;
    }
}

/**
 * The name shown in menus and group headings: `This week`, `No horizon`, `Invalid horizon`.
 */
export function horizonDisplayName(state: HorizonState): string {
    switch (state) {
        case 'none':
            return 'No horizon';
        case 'invalid':
            return 'Invalid horizon';
        default:
            return state.charAt(0).toUpperCase() + state.slice(1);
    }
}

/**
 * The value of the `data-task-horizon` attribute: `this-week`, `invalid`; null for no horizon.
 */
export function horizonAttributeValue(state: HorizonState): string | null {
    return state === 'none' ? null : state.replace(' ', '-');
}

/**
 * Return {@link description} with its horizon set to {@link horizon}, or removed if it is null.
 *
 * An existing horizon is replaced in place. A new one goes after the description's text, or just before
 * the multi-step marker if there is one, so that it doesn't become part of the last step.
 */
export function setHorizon(description: string, horizon: Horizon | null): string {
    const token = findHorizonToken(description);

    if (horizon === null) {
        if (token === null) {
            return description;
        }
        return joinWithSpace(description.slice(0, token.start), description.slice(token.end));
    }

    const newToken = `${HORIZON_MARKER} ${horizon}`;
    if (token !== null) {
        const after = description.slice(token.end);
        // After an invalid marker, the text may follow without a space: keep the value separate from it.
        const separator = after === '' || /^\s/.test(after) ? '' : ' ';
        return description.slice(0, token.start) + newToken + separator + after;
    }

    const stepsStart = description.indexOf(MULTI_STEP_MARKER);
    if (stepsStart !== -1) {
        return joinWithSpace(description.slice(0, stepsStart), newToken + ' ' + description.slice(stepsStart));
    }
    return joinWithSpace(description, newToken);
}

function joinWithSpace(before: string, after: string) {
    const left = before.trimEnd();
    const right = after.trimStart();
    if (left === '' || right === '') {
        return left + right;
    }
    return left + ' ' + right;
}
