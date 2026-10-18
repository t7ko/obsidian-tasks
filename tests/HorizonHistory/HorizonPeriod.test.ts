import moment from 'moment';
import { addDays, daysBetween, periodEnd } from '../../src/HorizonHistory/HorizonPeriod';
import type { Horizon } from '../../src/Task/Horizon';

window.moment = moment;

describe('periodEnd', () => {
    // 2026-10-17 is a Saturday.
    it.each<[Horizon, string]>([
        ['today', '2026-10-17'],
        ['tomorrow', '2026-10-18'],
        ['this week', '2026-10-18'],
        ['next week', '2026-10-25'],
        ['this month', '2026-10-31'],
        ['next month', '2026-11-30'],
    ])('on Sat 17 Oct 2026, %s ends on %s', (horizon, expected) => {
        expect(periodEnd(horizon, '2026-10-17')).toEqual(expected);
    });

    it.each([
        ['2026-10-12', 'this week', '2026-10-18'], // Monday
        ['2026-10-18', 'this week', '2026-10-18'], // Sunday
        ['2026-10-18', 'next week', '2026-10-25'],
        ['2026-10-19', 'this week', '2026-10-25'], // Monday
        ['2026-12-31', 'tomorrow', '2027-01-01'],
        ['2026-12-28', 'next week', '2027-01-10'],
        ['2026-01-31', 'next month', '2026-02-28'],
        ['2026-12-15', 'next month', '2027-01-31'],
        ['2026-12-31', 'this month', '2026-12-31'],
    ])('on %s, %s ends on %s', (day, horizon, expected) => {
        expect(periodEnd(horizon as Horizon, day)).toEqual(expected);
    });
});

describe('days', () => {
    it('counts the days between two days', () => {
        expect(daysBetween('2026-10-12', '2026-10-17')).toEqual(5);
        expect(daysBetween('2026-10-17', '2026-10-12')).toEqual(-5);
        expect(daysBetween('2026-10-17', '2026-10-17')).toEqual(0);
        expect(daysBetween('2026-03-01', '2026-04-01')).toEqual(31);
        expect(daysBetween('2026-10-01', '2026-11-01')).toEqual(31);
    });

    it('moves a day', () => {
        expect(addDays('2026-10-17', 1)).toEqual('2026-10-18');
        expect(addDays('2026-10-17', -35)).toEqual('2026-09-12');
        expect(addDays('2026-12-31', 1)).toEqual('2027-01-01');
    });
});
