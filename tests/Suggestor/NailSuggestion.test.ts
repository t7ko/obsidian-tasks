import moment from 'moment';
import { nailSuggestions } from '../../src/Suggestor/NailSuggestion';
import { makeDefaultSuggestionBuilder } from '../../src/Suggestor/Suggestor';
import { DEFAULT_SYMBOLS } from '../../src/TaskSerializer/DefaultTaskSerializer';
import { getSettings } from '../../src/Config/Settings';

window.moment = moment;

/**
 * Split a line with a '|' for the cursor into the line and the cursor position.
 */
function parse(lineWithCursor: string) {
    const cursorPos = lineWithCursor.indexOf('|');
    return { line: lineWithCursor.replace('|', ''), cursorPos };
}

function displayTexts(lineWithCursor: string, dataviewMode = false) {
    const { line, cursorPos } = parse(lineWithCursor);
    return nailSuggestions(line, cursorPos, dataviewMode).map((suggestion) => suggestion.displayText);
}

/**
 * Apply the suggestion as the editor would, and return the new line with a '|' at the new cursor.
 */
function apply(lineWithCursor: string, displayText: string) {
    const { line, cursorPos } = parse(lineWithCursor);
    const suggestion = nailSuggestions(line, cursorPos, false).find((s) => s.displayText === displayText)!;
    const insertAt = suggestion.insertAt ?? cursorPos;
    const newCursor = insertAt + suggestion.appendText.length;
    const newLine =
        line.slice(0, insertAt) + suggestion.appendText + line.slice(insertAt + (suggestion.insertSkip ?? 0));
    return newLine.slice(0, newCursor) + '|' + newLine.slice(newCursor);
}

describe('nail suggestions', () => {
    it.each([
        '- [ ] Call Bob nai|',
        '- [ ] Call Bob nail|',
        '- [ ] Call Bob NAIL|',
        '- [ ] nai|',
        '- [ ] Call Bob nai| 📅 2026-10-20',
    ])('should offer to add a nail in "%s"', (line: string) => {
        expect(displayTexts(line)).toEqual(['⚠️ add nail']);
    });

    it('should also offer to remove a nail from a task with nails', () => {
        expect(displayTexts('- [ ] ⚠️ Call Bob nai|')).toEqual(['⚠️ add nail', '⚠️ remove nail']);
    });

    it.each([
        '- [ ] Call Bob na|',
        '- [ ] Call Bob nails|',
        '- [ ] Call Bob snail|',
        '- [ ] Call Bob nai |',
        '- Call Bob nai|',
        'Call Bob nai|',
        '- [nai|] Call Bob',
    ])('should offer nothing in "%s"', (line: string) => {
        expect(displayTexts(line)).toEqual([]);
    });

    it('should offer nothing in the Dataview format', () => {
        expect(displayTexts('- [ ] Call Bob nai|', true)).toEqual([]);
    });

    it.each([
        ['- [ ] Call Bob nai|', '- [ ] ⚠️ Call Bob |'],
        ['- [ ] Call Bob nail| 📅 2026-10-20', '- [ ] ⚠️ Call Bob| 📅 2026-10-20'],
        ['- [ ] ⚠️ Call Bob nai|', '- [ ] ⚠️⚠️ Call Bob |'],
        ['- [ ] nai|', '- [ ] ⚠️ |'],
        ['- [ ] nai| Call Bob', '- [ ] ⚠️ | Call Bob'],
    ])('adding a nail to "%s" gives "%s"', (line: string, expected: string) => {
        expect(apply(line, '⚠️ add nail')).toEqual(expected);
    });

    it.each([
        ['- [ ] ⚠️⚠️ Call Bob nai|', '- [ ] ⚠️ Call Bob |'],
        ['- [ ] ⚠️ Call Bob nail| 📅 2026-10-20', '- [ ] Call Bob| 📅 2026-10-20'],
        ['- [ ] ⚠️ nai|', '- [ ] |'],
        // The removed whitespace reaches past the cursor: the rest of the line is replaced.
        ['- [ ] ⚠️nai| Call Bob', '- [ ] Call Bob|'],
    ])('removing a nail from "%s" gives "%s"', (line: string, expected: string) => {
        expect(apply(line, '⚠️ remove nail')).toEqual(expected);
    });
});

describe('nail suggestions in the default suggestion builder', () => {
    it('should offer to add a nail while typing nai', () => {
        const builder = makeDefaultSuggestionBuilder(DEFAULT_SYMBOLS, 6, false);
        const { line, cursorPos } = parse('- [ ] Call Bob nai|');

        const suggestions = builder(line, cursorPos, getSettings(), [], true);

        expect(suggestions.map((suggestion) => suggestion.displayText)).toContain('⚠️ add nail');
        // A match, so Enter accepts it instead of adding a new line.
        expect(suggestions[0].suggestionType).toEqual('match');
    });
});
