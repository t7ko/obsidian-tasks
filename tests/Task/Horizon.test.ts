import {
    type Horizon,
    type HorizonState,
    findHorizonToken,
    horizonAttributeValue,
    horizonDisplayName,
    horizonOf,
    horizonRank,
    horizons,
    setHorizon,
} from '../../src/Task/Horizon';

describe('horizonOf', () => {
    it.each<[string, HorizonState]>([
        ['Buy milk', 'none'],
        ['Buy milk 🔭 today', 'today'],
        ['Buy milk 🔭 tomorrow #home', 'tomorrow'],
        ['Buy milk 🔭 this week', 'this week'],
        ['Buy milk 🔭 next week', 'next week'],
        ['Buy milk 🔭 this month', 'this month'],
        ['Buy milk 🔭 next month', 'next month'],
        ['🔭 today Buy milk', 'today'],
        ['Buy milk 🔭 This  WEEK', 'this week'],
        ['Buy milk 🔭\ttoday', 'today'],
        ['Buy milk 🔭\uFE0F today', 'today'],
        ['Buy milk 🔭 today 🔭 tomorrow', 'today'],
    ])('"%s" has horizon "%s"', (description: string, expected: HorizonState) => {
        expect(horizonOf(description)).toEqual(expected);
    });

    it.each([
        'Buy milk 🔭 tomorow',
        'Buy milk 🔭',
        'Buy milk 🔭today',
        'Buy milk 🔭 todays',
        'Buy milk 🔭 this weekend',
        'Buy milk 🔭 this',
        'Buy milk 🔭 #home',
        // Only the first marker counts
        'Buy milk 🔭 tomorow 🔭 today',
    ])('"%s" has an invalid horizon', (description: string) => {
        expect(horizonOf(description)).toEqual('invalid');
    });
});

describe('findHorizonToken', () => {
    function tokenText(description: string) {
        const token = findHorizonToken(description);
        return token === null ? null : description.slice(token.start, token.end);
    }

    it('should be null without a marker', () => {
        expect(findHorizonToken('Buy milk')).toBeNull();
    });

    it('should span the marker, whitespace and value of a valid horizon', () => {
        expect(tokenText('Buy milk 🔭 this  week #home')).toEqual('🔭 this  week');
    });

    it('should include a variation selector after the marker', () => {
        expect(tokenText('Buy milk 🔭\uFE0F today')).toEqual('🔭\uFE0F today');
    });

    it('should be only the marker for an invalid horizon', () => {
        expect(tokenText('Buy 🔭 tomorow milk')).toEqual('🔭');
    });
});

describe('order and names', () => {
    it('should rank invalid first, then the horizons in order of meaning, then no horizon', () => {
        const states: HorizonState[] = [
            'none',
            'next month',
            'this month',
            'next week',
            'this week',
            'tomorrow',
            'today',
            'invalid',
        ];
        const sorted = [...states].sort((a, b) => horizonRank(a) - horizonRank(b));
        expect(sorted).toEqual([
            'invalid',
            'today',
            'tomorrow',
            'this week',
            'next week',
            'this month',
            'next month',
            'none',
        ]);
    });

    it('should list the horizons in order of meaning', () => {
        expect(horizons).toEqual(['today', 'tomorrow', 'this week', 'next week', 'this month', 'next month']);
    });

    it.each<[HorizonState, string, string | null]>([
        ['today', 'Today', 'today'],
        ['tomorrow', 'Tomorrow', 'tomorrow'],
        ['this week', 'This week', 'this-week'],
        ['next week', 'Next week', 'next-week'],
        ['this month', 'This month', 'this-month'],
        ['next month', 'Next month', 'next-month'],
        ['invalid', 'Invalid horizon', 'invalid'],
        ['none', 'No horizon', null],
    ])('"%s" is shown as "%s", with attribute value %s', (state, displayName, attributeValue) => {
        expect(horizonDisplayName(state)).toEqual(displayName);
        expect(horizonAttributeValue(state)).toEqual(attributeValue);
    });
});

describe('setHorizon', () => {
    it.each<[string, Horizon, string]>([
        ['Buy milk', 'today', 'Buy milk 🔭 today'],
        ['Buy milk #home', 'next week', 'Buy milk #home 🔭 next week'],
        ['Buy milk ', 'today', 'Buy milk 🔭 today'],
        ['', 'today', '🔭 today'],
        ['Buy milk 🔭 today #home', 'this month', 'Buy milk 🔭 this month #home'],
        ['Buy milk 🔭 today', 'today', 'Buy milk 🔭 today'],
        ['Buy milk 🔭 This  Week', 'next month', 'Buy milk 🔭 next month'],
        ['Buy milk 🔭\uFE0F today', 'tomorrow', 'Buy milk 🔭 tomorrow'],
        ['🔭 today Buy milk', 'this week', '🔭 this week Buy milk'],
        // An invalid horizon: the text after the marker stays
        ['Buy 🔭 tomorow milk', 'tomorrow', 'Buy 🔭 tomorrow tomorow milk'],
        ['Buy milk 🔭', 'today', 'Buy milk 🔭 today'],
        ['Buy milk 🔭x', 'today', 'Buy milk 🔭 today x'],
        // Multi-step tasks: before the steps, so not part of the last step
        [
            'Renew passport 🪜 ~~fill form~~ // get photo',
            'this week',
            'Renew passport 🔭 this week 🪜 ~~fill form~~ // get photo',
        ],
        ['🪜 one // two', 'today', '🔭 today 🪜 one // two'],
    ])('"%s" with horizon "%s" becomes "%s"', (description: string, horizon: Horizon, expected: string) => {
        const result = setHorizon(description, horizon);
        expect(result).toEqual(expected);
        expect(horizonOf(result)).toEqual(horizon);
    });

    it.each([
        ['Buy milk 🔭 today', 'Buy milk'],
        ['Buy milk 🔭 today #home', 'Buy milk #home'],
        ['🔭 today Buy milk', 'Buy milk'],
        ['🔭 today', ''],
        ['Buy 🔭 tomorow milk', 'Buy tomorow milk'],
        ['Buy milk', 'Buy milk'],
    ])('"%s" without horizon becomes "%s"', (description: string, expected: string) => {
        const result = setHorizon(description, null);
        expect(result).toEqual(expected);
        expect(horizonOf(result)).toEqual('none');
    });
});
