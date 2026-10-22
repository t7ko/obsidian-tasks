import moment from 'moment';
import { TASK_FORMATS, getSettings, resetSettings, updateSettings } from '../../src/Config/Settings';
import { isRuleFollowedBySpace, keepsTypedWords, whenDoneRule } from '../../src/Suggestor/RecurrenceSuggestions';
import type { SuggestInfo } from '../../src/Suggestor';

window.moment = moment;

afterEach(() => {
    resetSettings();
});

describe('keepsTypedWords', () => {
    it('should accept a rule that has every typed word', () => {
        expect(keepsTypedWords('every week', 'every week')).toEqual(true);
        expect(keepsTypedWords('every week when done ', 'every week when done')).toEqual(true);
        expect(keepsTypedWords('every 2 weeks on mon', 'every 2 weeks on Monday')).toEqual(true);
        expect(keepsTypedWords('every monday', 'every week on Monday')).toEqual(true);
        expect(keepsTypedWords('Every  Day', 'every day')).toEqual(true);
    });

    it('should reject a rule that dropped typed words', () => {
        expect(keepsTypedWords('every week w', 'every week')).toEqual(false);
        expect(keepsTypedWords('every week when d', 'every week')).toEqual(false);
        expect(keepsTypedWords('every week when done ', 'every week')).toEqual(false);
        expect(keepsTypedWords('every weekend', 'every week')).toEqual(false);
    });
});

describe('whenDoneRule', () => {
    it.each([
        ['every week w', 'every week when done'],
        ['every week wh', 'every week when done'],
        ['every week when', 'every week when done'],
        ['every week when ', 'every week when done'],
        ['every week when d', 'every week when done'],
        ['every week when don ', 'every week when done'],
        ['every 2 days when do', 'every 2 days when done'],
        ['every week on mon wh', 'every week on Monday when done'],
        ['Every Week WHEN D', 'every week when done'],
    ])('should complete "%s" to "%s"', (typed: string, expected: string) => {
        expect(whenDoneRule(typed)).toEqual(expected);
    });

    it.each([
        ['every week'],
        ['every week '],
        ['every week when done'],
        ['every week when done w'],
        ['every week x'],
        ['every week on w'],
        ['every w'],
        ['w'],
    ])('should not complete "%s"', (typed: string) => {
        expect(whenDoneRule(typed)).toBeNull();
    });
});

describe('isRuleFollowedBySpace', () => {
    it('should tell a finished rule from one being typed', () => {
        expect(isRuleFollowedBySpace('🔁 every week ', '🔁 every week ')).toEqual(true);
        expect(isRuleFollowedBySpace('🔁 every week   ', '🔁 every week ')).toEqual(true);
        expect(isRuleFollowedBySpace('🔁 every week', '🔁 every week ')).toEqual(false);
        expect(isRuleFollowedBySpace('🔁 every week o ', '🔁 every week ')).toEqual(false);
    });
});

describe('recurrence suggestions in the auto-suggest', () => {
    function suggestionsAt(before: string, after: string): SuggestInfo[] {
        const { buildSuggestions } = TASK_FORMATS[getSettings().taskFormat];
        return buildSuggestions(before + after, before.length, getSettings(), [], true);
    }

    function first(before: string, after = '') {
        return suggestionsAt('- [ ] Water plants 🔁 ' + before, after)[0].displayText;
    }

    /** The line after picking the first suggestion, as the suggest popup writes it */
    function pickFirst(before: string, after: string) {
        const suggestion = suggestionsAt(before, after)[0];
        const from = suggestion.insertAt ?? before.length;
        const to = suggestion.insertSkip ? from + suggestion.insertSkip : from;
        const line = before + after;
        return line.slice(0, from) + suggestion.appendText + line.slice(to);
    }

    it('should offer the rule with "when done" while it is typed', () => {
        for (const typed of ['every week w', 'every week when', 'every week when d']) {
            expect(first(typed)).toEqual('every week when done');
            expect(first(typed, ' 🏁 delete')).toEqual('every week when done');
        }
    });

    it('should write the rule with "when done" when picked, keeping what follows', () => {
        expect(pickFirst('- [ ] Water plants 🔁 every week wh', ' 🏁 delete')).toEqual(
            '- [ ] Water plants 🔁 every week when done 🏁 delete',
        );
        expect(pickFirst('- [ ] Water plants 🔁 every week when d', '')).toEqual(
            '- [ ] Water plants 🔁 every week when done ',
        );
    });

    it('should not offer a rule that drops the "when done" being typed', () => {
        const displayed = suggestionsAt('- [ ] Water plants 🔁 every week when d', '').map((s) => s.displayText);
        expect(displayed).not.toContain('✅ every week');
    });

    it('should offer nothing that changes a finished rule, so Enter starts a new line', () => {
        expect(first('every week when done', ' 🏁 delete')).toEqual('⏎');
        expect(first('every week when done ')).toEqual('⏎');
        expect(first('every week', ' when done 🏁 delete')).toEqual('⏎');
        expect(first('every week  ')).toEqual('⏎');
    });

    it('should keep offering what it offered before for rules being typed', () => {
        expect(first('every week when done')).toEqual('✅ every week when done');
        expect(first('every week')).toEqual('✅ every week');
        expect(first('every week on mon')).toEqual('✅ every week on Monday');
        expect(suggestionsAt('- [ ] Water plants 🔁 every week o', '').map((s) => s.displayText)).toContain(
            'every week on Monday',
        );
    });

    it('should offer "when done" in the Dataview format', () => {
        updateSettings({ taskFormat: 'dataview' });
        expect(pickFirst('- [ ] Water plants [repeat:: every week wh', '')).toEqual(
            '- [ ] Water plants [repeat:: every week when done] ',
        );
    });
});
