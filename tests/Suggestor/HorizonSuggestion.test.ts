import { horizonSuggestions } from '../../src/Suggestor/HorizonSuggestion';

/**
 * Apply the first suggestion as the editor would, and return the new line.
 */
function applyFirst(lineWithCursor: string) {
    const cursorPos = lineWithCursor.indexOf('|');
    const line = lineWithCursor.replace('|', '');
    const suggestion = horizonSuggestions(line, cursorPos, false)[0];
    const insertAt = suggestion.insertAt ?? cursorPos;
    return line.slice(0, insertAt) + suggestion.appendText + line.slice(insertAt + (suggestion.insertSkip ?? 0));
}

function displayTexts(lineWithCursor: string, dataviewMode = false) {
    const cursorPos = lineWithCursor.indexOf('|');
    const line = lineWithCursor.replace('|', '');
    return horizonSuggestions(line, cursorPos, dataviewMode).map((suggestion) => suggestion.displayText);
}

describe('horizon suggestions', () => {
    it.each(['- [ ] Buy milk hor|', '- [ ] Buy milk Horizon|', '- [ ] Buy milk hori| 📅 2026-10-20'])(
        'should offer the marker in "%s"',
        (line: string) => {
            expect(displayTexts(line)).toEqual(['🔭 horizon']);
        },
    );

    it('should replace the typed word with the marker', () => {
        expect(applyFirst('- [ ] Buy milk hor| 📅 2026-10-20')).toEqual('- [ ] Buy milk 🔭  📅 2026-10-20');
    });

    it.each([
        '- [ ] Buy milk ho|',
        '- [ ] Buy milk anchor|',
        '- [ ] Buy milk today|',
        '- [ ] Buy milk 📅 2026-10-20 hor|',
        '- [ ] Buy milk ⏫ hor|',
        '- [ ] Buy milk 🔭 today hor|',
        '- [ ] Buy milk hor| 🔭 today',
    ])('should offer nothing in "%s"', (line: string) => {
        expect(displayTexts(line)).toEqual([]);
    });

    it('should offer nothing in the Dataview format', () => {
        expect(displayTexts('- [ ] Buy milk hor|', true)).toEqual([]);
        expect(displayTexts('- [ ] Buy milk 🔭 |', true)).toEqual([]);
    });

    it('should offer all horizons right after the marker', () => {
        expect(displayTexts('- [ ] Buy milk 🔭 |')).toEqual([
            'today',
            'tomorrow',
            'this week',
            'next week',
            'this month',
            'next month',
        ]);
        expect(displayTexts('- [ ] Buy milk 🔭|')).toHaveLength(6);
    });

    it.each([
        ['- [ ] Buy milk 🔭 to|', ['today', 'tomorrow']],
        ['- [ ] Buy milk 🔭 this|', ['this week', 'this month']],
        ['- [ ] Buy milk 🔭 Next m|', ['next month']],
        ['- [ ] Buy milk 🔭 today|', ['today']],
        ['- [ ] Buy milk 🔭 today |', []],
        ['- [ ] Buy milk 🔭 someday|', []],
    ])('in "%s" should offer %j', (line: string, expected: string[]) => {
        expect(displayTexts(line)).toEqual(expected);
    });

    it('should replace the marker and typed text with the chosen horizon', () => {
        expect(applyFirst('- [ ] Buy milk 🔭 this w| 📅 2026-10-20')).toEqual(
            '- [ ] Buy milk 🔭 this week  📅 2026-10-20',
        );
    });
});
