import { Occurrence } from '../Task/Occurrence';
import { Recurrence } from '../Task/Recurrence';
import type { SuggestInfo } from '.';

/**
 * t7 fork feature: recurrence suggestions that keep what was typed. Spec: `fork-features/recurrence-suggestions.md`.
 *
 * Tasks' parser skips words it doesn't know, so it reads `every week when d` as `every week`. Tasks then offered
 * `✅ every week`, and picking it, or pressing Enter, replaced the whole typed rule, dropping `when d`. These functions
 * keep the ✅ suggestion to rules that account for every typed word, and offer `<rule> when done` while it is typed.
 */

const WHEN_DONE = 'when done';

function words(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[\s,]+/)
        .filter((word) => word !== '');
}

/**
 * Whether the rule that Tasks reads from the text typed after 🔁 keeps every typed word, in order. A typed word may be
 * the start of a word of the rule, as `mon` is of `Monday`; the rule may have more words, as `every monday` reads as
 * `every week on Monday`.
 * @param typed - the text typed after 🔁
 * @param parsed - the rule Tasks reads from it, as `Recurrence.toText()` writes it
 */
export function keepsTypedWords(typed: string, parsed: string): boolean {
    const parsedWords = words(parsed);
    let next = 0;
    for (const word of words(typed)) {
        while (next < parsedWords.length && !parsedWords[next].startsWith(word)) {
            next++;
        }
        if (next === parsedWords.length) {
            return false;
        }
        next++;
    }
    return true;
}

/**
 * Whether the text matched after 🔁 is the rule of the ✅ suggestion followed by whitespace: the user has finished the
 * rule and typed on, so Tasks offers no recurrence suggestion (and Enter starts a new line). Tasks checks this only for
 * exactly the suggestion's text with its one trailing space.
 * @param match - 🔁 and the text after it
 * @param appendText - what the ✅ suggestion would write
 */
export function isRuleFollowedBySpace(match: string, appendText: string): boolean {
    return /\s$/.test(match) && match.trimEnd() === appendText.trimEnd();
}

/**
 * `<rule> when done` for text typed after 🔁 that is a rule followed by the start of `when done` (`every week w`,
 * `every week when d`), or null.
 */
export function whenDoneRule(typed: string): string | null {
    const match = typed.trimEnd().match(/^(.*\S)\s+(w[a-z ]*)$/i);
    if (match === null) {
        return null;
    }
    const partial = match[2].toLowerCase().replace(/ +/g, ' ');
    if (partial === WHEN_DONE || !WHEN_DONE.startsWith(partial)) {
        return null;
    }

    const base = match[1];
    const rule = Recurrence.fromText({
        recurrenceRuleText: base,
        occurrence: new Occurrence({ startDate: null, scheduledDate: null, dueDate: null }),
    })?.toText();
    if (!rule || rule.endsWith(WHEN_DONE) || !keepsTypedWords(base, rule)) {
        return null;
    }
    return `${rule} ${WHEN_DONE}`;
}

/**
 * The `<rule> when done` suggestion for the recurrence being typed, if {@link whenDoneRule} gives one. It replaces the
 * same text as Tasks' other recurrence suggestions.
 */
export function whenDoneSuggestions(
    typed: string,
    recurrencePrefix: string,
    insertAt: number | undefined,
    insertSkip: number,
    postfix: string,
): SuggestInfo[] {
    const rule = whenDoneRule(typed);
    if (rule === null) {
        return [];
    }
    return [
        {
            suggestionType: 'match',
            displayText: rule,
            appendText: `${recurrencePrefix} ${rule}` + postfix,
            insertAt,
            insertSkip,
        },
    ];
}
