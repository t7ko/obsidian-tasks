/**
 * Fork feature: multi-step tasks. Spec: fork-features/multi-step-tasks.md
 */
import moment from 'moment';
import { getSettings, resetSettings } from '../../src/Config/Settings';
import type { SuggestInfo } from '../../src/Suggestor';
import { addMultiStepSuggestion } from '../../src/Suggestor/MultiStepSuggestion';
import { makeDefaultSuggestionBuilder } from '../../src/Suggestor/Suggestor';
import { DEFAULT_SYMBOLS } from '../../src/TaskSerializer/DefaultTaskSerializer';

window.moment = moment;

afterEach(() => {
    resetSettings();
});

describe('MultiStepSuggestion', () => {
    function suggestionsFor(line: string, dataviewMode = false) {
        const suggestions: SuggestInfo[] = [];
        addMultiStepSuggestion(suggestions, line, dataviewMode);
        return suggestions;
    }

    it('should offer the steps marker', () => {
        expect(suggestionsFor('- [ ] Renew passport ')).toEqual([{ displayText: '🪜 steps', appendText: '🪜 ' }]);
    });

    it('should not offer the marker twice', () => {
        expect(suggestionsFor('- [ ] Renew passport 🪜 fill form // ')).toEqual([]);
    });

    it('should not offer the marker in the Dataview format', () => {
        expect(suggestionsFor('- [ ] Renew passport [', true)).toEqual([]);
    });

    it('should be offered by the auto-suggest when typing "steps"', () => {
        const buildSuggestions = makeDefaultSuggestionBuilder(DEFAULT_SYMBOLS, 50, false);
        const line = '- [ ] Renew passport ste';
        const suggestions = buildSuggestions(line, line.length, getSettings(), [], true);
        expect(suggestions.map((s) => s.displayText)).toContain('🪜 steps');
        const steps = suggestions.find((s) => s.displayText === '🪜 steps');
        expect(steps?.appendText).toEqual('🪜 ');
        expect(steps?.insertSkip).toEqual('ste'.length);
    });
});
