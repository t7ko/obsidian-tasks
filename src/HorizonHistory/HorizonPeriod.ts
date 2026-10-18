import type { Horizon } from '../Task/Horizon';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * Days are local calendar days, kept as `YYYY-MM-DD` strings, which sort in date order.
 */

export const DAY_FORMAT = 'YYYY-MM-DD';

export function todayAsDay(): string {
    return window.moment().format(DAY_FORMAT);
}

/**
 * The last day of {@link horizon}'s period, seen on {@link day}. Weeks run Monday to Sunday.
 */
export function periodEnd(horizon: Horizon, day: string): string {
    const date = window.moment(day, DAY_FORMAT);
    switch (horizon) {
        case 'today':
            break;
        case 'tomorrow':
            date.add(1, 'day');
            break;
        case 'this week':
            date.endOf('isoWeek');
            break;
        case 'next week':
            date.add(1, 'week').endOf('isoWeek');
            break;
        case 'this month':
            date.endOf('month');
            break;
        case 'next month':
            date.add(1, 'month').endOf('month');
            break;
    }
    return date.format(DAY_FORMAT);
}

/**
 * The number of days from {@link from} to {@link to}: negative if {@link to} is earlier.
 */
export function daysBetween(from: string, to: string): number {
    return window.moment(to, DAY_FORMAT).diff(window.moment(from, DAY_FORMAT), 'days');
}

/**
 * {@link day} moved by {@link days} days.
 */
export function addDays(day: string, days: number): string {
    return window.moment(day, DAY_FORMAT).add(days, 'days').format(DAY_FORMAT);
}
