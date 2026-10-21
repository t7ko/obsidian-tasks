import moment from 'moment';
import { horizonSuggestions } from '../../src/Suggestor/HorizonSuggestion';
import { DEFAULT_SYMBOLS, DefaultTaskSerializer } from '../../src/TaskSerializer/DefaultTaskSerializer';
import { Priority } from '../../src/Task/Priority';

window.moment = moment;

/**
 * Split a line with a '|' for the cursor into the line and the cursor position.
 */
function parse(lineWithCursor: string) {
    const cursorPos = lineWithCursor.indexOf('|');
    return { line: lineWithCursor.replace('|', ''), cursorPos };
}

/**
 * Apply a suggestion as the editor would, the first one unless {@link displayText} is given,
 * and return the new line with a '|' at the new cursor.
 */
function apply(lineWithCursor: string, displayText?: string) {
    const { line, cursorPos } = parse(lineWithCursor);
    const suggestions = horizonSuggestions(line, cursorPos, false);
    const suggestion =
        displayText === undefined ? suggestions[0] : suggestions.find((s) => s.displayText === displayText)!;
    const insertAt = suggestion.insertAt ?? cursorPos;
    const newCursor = insertAt + suggestion.appendText.length;
    const newLine =
        line.slice(0, insertAt) + suggestion.appendText + line.slice(insertAt + (suggestion.insertSkip ?? 0));
    return newLine.slice(0, newCursor) + '|' + newLine.slice(newCursor);
}

function displayTexts(lineWithCursor: string, dataviewMode = false) {
    const { line, cursorPos } = parse(lineWithCursor);
    return horizonSuggestions(line, cursorPos, dataviewMode).map((suggestion) => suggestion.displayText);
}

describe('horizon suggestions', () => {
    it.each([
        '- [ ] Buy milk hor|',
        '- [ ] Buy milk Horizon|',
        '- [ ] Buy milk hori| 📅 2026-10-20',
        '- [ ] Read about 📅 calendars hor|',
    ])('should offer the marker in "%s"', (line: string) => {
        expect(displayTexts(line)).toEqual(['🔭 horizon']);
    });

    it('should replace the typed word with the marker', () => {
        expect(apply('- [ ] Buy milk hor| 📅 2026-10-20')).toEqual('- [ ] Buy milk 🔭 | 📅 2026-10-20');
    });

    it.each([
        '- [ ] Buy milk ho|',
        '- [ ] Buy milk anchor|',
        '- [ ] Buy milk today|',
        '- [ ] Buy milk ⏫ ho|',
        '- [ ] Buy milk 🔭 today hor|',
        '- [ ] Buy milk 🔭 today ⏫ hor|',
        '- [ ] Buy milk hor| 🔭 today',
    ])('should offer nothing in "%s"', (line: string) => {
        expect(displayTexts(line)).toEqual([]);
    });

    it('should offer nothing in the Dataview format', () => {
        expect(displayTexts('- [ ] Buy milk hor|', true)).toEqual([]);
        expect(displayTexts('- [ ] Buy milk ⏫ hor|', true)).toEqual([]);
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
        expect(apply('- [ ] Buy milk 🔭 this w| 📅 2026-10-20')).toEqual('- [ ] Buy milk 🔭 this week | 📅 2026-10-20');
    });

    describe('after the Tasks fields', () => {
        it.each(['- [ ] Buy milk ⏫ hor|', '- [ ] Buy milk 📅 2026-10-20 horizon|', '- [ ] Buy milk 🔺hor|'])(
            'should offer all horizons in "%s"',
            (line: string) => {
                expect(displayTexts(line)).toEqual([
                    '🔭 today',
                    '🔭 tomorrow',
                    '🔭 this week',
                    '🔭 next week',
                    '🔭 this month',
                    '🔭 next month',
                ]);
            },
        );

        it.each([
            ['- [ ] Buy milk ⏫ hor|', '- [ ] Buy milk 🔭 this week ⏫ |'],
            ['- [ ] Buy milk 🔺 📅 2026-10-20 hor|', '- [ ] Buy milk 🔭 this week 🔺 📅 2026-10-20 |'],
            ['- [ ] Buy milk ⏫ hor| 📅 2026-10-20', '- [ ] Buy milk 🔭 this week ⏫| 📅 2026-10-20'],
            ['- [ ] Buy milk 🔺hor|', '- [ ] Buy milk 🔭 this week 🔺|'],
            ['- [ ] Buy milk #shop ⏫ #home hor|', '- [ ] Buy milk #shop 🔭 this week ⏫ #home |'],
            ['- [ ] Buy milk ⏫ hor| ^abc123', '- [ ] Buy milk 🔭 this week ⏫| ^abc123'],
            ['- [ ] Pack 🪜 bags // car ⏫ hor|', '- [ ] Pack 🪜 bags // car 🔭 this week ⏫ |'],
            ['- [ ] ⏫ hor|', '- [ ] 🔭 this week ⏫ |'],
        ])('in "%s" should put the horizon before the fields: "%s"', (line: string, expected: string) => {
            expect(apply(line, '🔭 this week')).toEqual(expected);
        });

        it('should leave the fields readable by Tasks', () => {
            const newLine = apply('- [ ] Buy milk ⏫ 📅 2026-10-20 hor|').replace('|', '');
            const details = new DefaultTaskSerializer(DEFAULT_SYMBOLS).deserialize(
                newLine.slice('- [ ] '.length).trim(),
            );
            expect(details.description).toEqual('Buy milk 🔭 today');
            expect(details.priority).toEqual(Priority.High);
            expect(details.dueDate).toEqualMoment(moment('2026-10-20'));
        });
    });
});
