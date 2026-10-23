import moment from 'moment';
import { type Settings, getSettings } from '../../src/Config/Settings';
import { makeDefaultSuggestionBuilder } from '../../src/Suggestor/Suggestor';
import { DEFAULT_SYMBOLS } from '../../src/TaskSerializer/DefaultTaskSerializer';
import { DATAVIEW_SYMBOLS } from '../../src/TaskSerializer/DataviewTaskSerializer';

window.moment = moment;

const DEPENDS_ON = '⛔ depends on id';

/**
 * Split a line with a '|' for the cursor into the line and the cursor position.
 */
function parse(lineWithCursor: string) {
    const cursorPos = lineWithCursor.indexOf('|');
    return { line: lineWithCursor.replace('|', ''), cursorPos };
}

interface SuggestOptions {
    dataviewMode?: boolean;
    canSaveEdits?: boolean;
    settings?: Settings;
}

function suggestionsFor(
    lineWithCursor: string,
    { dataviewMode = false, canSaveEdits = true, settings = getSettings() }: SuggestOptions = {},
) {
    const builder = makeDefaultSuggestionBuilder(dataviewMode ? DATAVIEW_SYMBOLS : DEFAULT_SYMBOLS, 6, dataviewMode);
    const { line, cursorPos } = parse(lineWithCursor);
    return builder(line, cursorPos, settings, [], canSaveEdits);
}

function matchTexts(lineWithCursor: string, options: SuggestOptions = {}) {
    return suggestionsFor(lineWithCursor, options)
        .filter((suggestion) => suggestion.suggestionType === 'match')
        .map((suggestion) => suggestion.displayText);
}

/**
 * Apply the suggestion as the editor would, and return the new line with a '|' at the new cursor.
 */
function apply(lineWithCursor: string, displayText: string, options: SuggestOptions = {}) {
    const { line, cursorPos } = parse(lineWithCursor);
    const suggestion = suggestionsFor(lineWithCursor, options).find((s) => s.displayText === displayText)!;
    const insertAt = suggestion.insertAt ?? cursorPos;
    const newCursor = insertAt + suggestion.appendText.length;
    const newLine =
        line.slice(0, insertAt) + suggestion.appendText + line.slice(insertAt + (suggestion.insertSkip ?? 0));
    return newLine.slice(0, newCursor) + '|' + newLine.slice(newCursor);
}

describe('block finds depends on', () => {
    it.each([
        '- [ ] Fix login blo|',
        '- [ ] Fix login bloc|',
        '- [ ] Fix login block|',
        '- [ ] Fix login blocked|',
        '- [ ] Fix login Block|',
        '- [ ] Fix login BLOCKED|',
        '- [ ] blo|',
        '- [ ] Fix login blo|cked',
        '- [ ] Fix login block| 📅 2026-10-20',
    ])('should offer only depends on in "%s"', (line: string) => {
        expect(matchTexts(line)).toEqual([DEPENDS_ON]);
    });

    it('should put depends on first, so Enter picks it', () => {
        expect(suggestionsFor('- [ ] Fix login block|')[0].displayText).toEqual(DEPENDS_ON);
    });

    it.each([
        '- [ ] Fix login b|',
        '- [ ] Fix login bl|',
        '- [ ] Fix login blocks|',
        '- [ ] Fix login blocker|',
        '- [ ] Fix login blocking|',
        '- [ ] Fix login unblock|',
        '- [ ] Fix login lock|',
        '- [ ] Fix login blog|',
        '- [ ] Fix login block |',
        '- [ ] Fix login |block',
    ])('should not offer depends on in "%s"', (line: string) => {
        expect(matchTexts(line)).not.toContain(DEPENDS_ON);
    });

    it('should not offer depends on when the task already has it', () => {
        const texts = suggestionsFor('- [ ] Fix login ⛔ abc123 block|').map((suggestion) => suggestion.displayText);
        expect(texts).not.toContain(DEPENDS_ON);
    });

    it('should not offer depends on when the file cannot be saved', () => {
        expect(matchTexts('- [ ] Fix login block|', { canSaveEdits: false })).toEqual([]);
    });

    it('should need as many letters as the minimum match setting, if more than blo', () => {
        const settings = { ...getSettings(), autoSuggestMinMatch: 4 };
        expect(matchTexts('- [ ] Fix login blo|', { settings })).toEqual([]);
        expect(matchTexts('- [ ] Fix login bloc|', { settings })).toEqual([DEPENDS_ON]);
    });

    it.each([
        ['- [ ] Fix login block|', '- [ ] Fix login ⛔ |'],
        ['- [ ] Fix login blo|cked', '- [ ] Fix login ⛔ |'],
        ['- [ ] blocked|', '- [ ] ⛔ |'],
    ])('picking depends on in "%s" gives "%s"', (line: string, expected: string) => {
        expect(apply(line, DEPENDS_ON)).toEqual(expected);
    });

    it('should work in the Dataview format', () => {
        const options = { dataviewMode: true };
        expect(matchTexts('- [ ] Fix login [block|', options)).toEqual(['dependsOn:: depends on id']);
        expect(apply('- [ ] Fix login [block|', 'dependsOn:: depends on id', options)).toEqual(
            '- [ ] Fix login [dependsOn:: |',
        );
    });
});
