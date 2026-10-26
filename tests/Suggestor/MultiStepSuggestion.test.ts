/**
 * Fork feature: multi-step tasks. Spec: fork-features/multi-step-tasks.md
 */
import moment from 'moment';
import { type Settings, getSettings, resetSettings } from '../../src/Config/Settings';
import type { SuggestInfo } from '../../src/Suggestor';
import { addMultiStepSuggestion } from '../../src/Suggestor/MultiStepSuggestion';
import { makeDefaultSuggestionBuilder } from '../../src/Suggestor/Suggestor';
import { DEFAULT_SYMBOLS } from '../../src/TaskSerializer/DefaultTaskSerializer';

window.moment = moment;

afterEach(() => {
    resetSettings();
});

const STEPS = '🪜 steps';

/**
 * Split a line with a '|' for the cursor into the line and the cursor position.
 */
function parse(lineWithCursor: string) {
    const cursorPos = lineWithCursor.indexOf('|');
    return { line: lineWithCursor.replace('|', ''), cursorPos };
}

function autoSuggestions(lineWithCursor: string, settings: Settings = getSettings()) {
    const buildSuggestions = makeDefaultSuggestionBuilder(DEFAULT_SYMBOLS, 50, false);
    const { line, cursorPos } = parse(lineWithCursor);
    return buildSuggestions(line, cursorPos, settings, [], true);
}

function matchTexts(lineWithCursor: string, settings: Settings = getSettings()) {
    return autoSuggestions(lineWithCursor, settings)
        .filter((suggestion) => suggestion.suggestionType === 'match')
        .map((suggestion) => suggestion.displayText);
}

/**
 * Apply the steps suggestion as the editor would, and return the new line with a '|' at the new cursor.
 */
function applySteps(lineWithCursor: string) {
    const { line, cursorPos } = parse(lineWithCursor);
    const suggestion = autoSuggestions(lineWithCursor).find((s) => s.displayText === STEPS)!;
    const insertAt = suggestion.insertAt ?? cursorPos;
    const newCursor = insertAt + suggestion.appendText.length;
    const newLine =
        line.slice(0, insertAt) + suggestion.appendText + line.slice(insertAt + (suggestion.insertSkip ?? 0));
    return newLine.slice(0, newCursor) + '|' + newLine.slice(newCursor);
}

describe('MultiStepSuggestion', () => {
    function suggestionsFor(line: string, dataviewMode = false) {
        const suggestions: SuggestInfo[] = [];
        addMultiStepSuggestion(suggestions, {
            line,
            cursorPos: line.length,
            settings: getSettings(),
            dataviewMode,
            postfix: ' ',
            insertSkip: 0,
        });
        return suggestions;
    }

    it('should offer the steps marker', () => {
        expect(suggestionsFor('- [ ] Renew passport ')).toEqual([{ displayText: STEPS, appendText: '🪜 ' }]);
    });

    it('should not offer the marker twice', () => {
        expect(suggestionsFor('- [ ] Renew passport 🪜 fill form // ')).toEqual([]);
    });

    it('should not offer the marker in the Dataview format', () => {
        expect(suggestionsFor('- [ ] Renew passport [', true)).toEqual([]);
    });

    it('should be offered by the auto-suggest when typing "steps"', () => {
        const suggestions = autoSuggestions('- [ ] Renew passport ste|');
        expect(suggestions.map((s) => s.displayText)).toContain(STEPS);
        const steps = suggestions.find((s) => s.displayText === STEPS);
        expect(steps?.appendText).toEqual('🪜 ');
        expect(steps?.insertSkip).toEqual('ste'.length);
    });

    describe('ladder', () => {
        it.each([
            '- [ ] Renew passport lad|',
            '- [ ] Renew passport ladd|',
            '- [ ] Renew passport ladder|',
            '- [ ] Renew passport Ladder|',
            '- [ ] Renew passport LADDER|',
            '- [ ] Renew passport lad|der',
            '- [ ] Renew passport ladder| 📅 2026-10-30',
        ])('should offer only the steps marker in "%s"', (line: string) => {
            expect(matchTexts(line)).toEqual([STEPS]);
        });

        it.each([
            '- [ ] Renew passport la|',
            '- [ ] Renew passport ladders|',
            '- [ ] Renew passport glad|',
            '- [ ] Renew passport add|',
            '- [ ] Renew passport der|',
            '- [ ] Renew passport ladder |',
            '- [ ] Renew passport |ladder',
        ])('should not offer the steps marker in "%s"', (line: string) => {
            expect(matchTexts(line)).not.toContain(STEPS);
        });

        it('should not offer the marker twice', () => {
            expect(matchTexts('- [ ] Renew passport 🪜 fill form // ladder|')).not.toContain(STEPS);
        });

        it('should need as many letters as the minimum match setting, if more than lad', () => {
            const settings = { ...getSettings(), autoSuggestMinMatch: 4 };
            expect(matchTexts('- [ ] Renew passport lad|', settings)).toEqual([]);
            expect(matchTexts('- [ ] Renew passport ladd|', settings)).toEqual([STEPS]);
        });

        it.each([
            ['- [ ] Renew passport ladder|', '- [ ] Renew passport 🪜 |'],
            ['- [ ] Renew passport lad|der', '- [ ] Renew passport 🪜 |'],
            ['- [ ] Renew passport lad| 📅 2026-10-30', '- [ ] Renew passport 🪜 | 📅 2026-10-30'],
        ])('picking the steps marker in "%s" gives "%s"', (line: string, expected: string) => {
            expect(applySteps(line)).toEqual(expected);
        });
    });
});
