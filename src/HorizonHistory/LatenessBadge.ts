import type { Task } from '../Task/Task';
import { HorizonHistory } from './HorizonHistory';
import { type LateDays, horizonHistorySettings } from './HorizonHistorySettings';
import { DAY_FORMAT, todayAsDay } from './HorizonPeriod';
import { type HistoryRecord, daysLate } from './HistoryRecord';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * The badge after a late task's rendered horizon, and the details shown in its tooltip and in the horizon menu.
 */

/**
 * The value of the `data-task-lateness` attribute, by the days-late settings.
 */
export type LatenessLevel = 'low' | 'medium' | 'high';

/**
 * The badge level for {@link days} days late, or null if that is too few for a badge.
 */
export function latenessLevel(days: number, lateDays: LateDays): LatenessLevel | null {
    if (days >= lateDays.high) {
        return 'high';
    }
    if (days >= lateDays.medium) {
        return 'medium';
    }
    return days >= lateDays.low ? 'low' : null;
}

/**
 * The badge's text: `5d late`, `3w late`, `2mo late`.
 */
export function latenessText(days: number): string {
    if (days < 14) {
        return `${days}d late`;
    }
    if (days < 60) {
        return `${Math.floor(days / 7)}w late`;
    }
    return `${Math.floor(days / 30)}mo late`;
}

/**
 * The details of a tracked task, as lines of parts. With a planned date:
 * `[['Planned for Mon 12 Oct', '5 days late'], ['pushed 3 times', 'tracked since Fri 2 Oct']]`.
 * Without one: `[['Tracked since Fri 2 Oct']]`. If the task has a created date, it is given instead of
 * the day tracking started: `created Mon 2 Mar`.
 *
 * @param record - the tracked task.
 * @param today
 * @param createdDay - the task's created date, if it has one.
 */
export function historyDetails(record: HistoryRecord, today: string, createdDay: string | null = null): string[][] {
    const age =
        createdDay === null
            ? `tracked since ${formatDay(record.since, today)}`
            : `created ${formatDay(createdDay, today)}`;
    if (record.planned === undefined) {
        return [[age]];
    }
    const days = daysLate(record, today) ?? 0;
    const planning = [`Planned for ${formatDay(record.planned, today)}`];
    if (record.status !== 'open') {
        planning.push(days > 0 ? `finished ${dayCount(days)} late` : 'finished on time');
    } else if (days > 0) {
        planning.push(`${dayCount(days)} late`);
    }
    return [planning, [pushCount(record.pushes), age]];
}

/**
 * The task's created date as a day, or null if it has none.
 */
export function createdDayOf(task: Task): string | null {
    return task.createdDate?.isValid() ? task.createdDate.format(DAY_FORMAT) : null;
}

function dayCount(days: number): string {
    return days === 1 ? '1 day' : `${days} days`;
}

function pushCount(pushes: number): string {
    if (pushes === 0) {
        return 'never pushed';
    }
    return pushes === 1 ? 'pushed once' : `pushed ${pushes} times`;
}

/**
 * `Mon 12 Oct`, with the year if it is not {@link today}'s.
 */
function formatDay(day: string, today: string): string {
    const format = day.slice(0, 4) === today.slice(0, 4) ? 'ddd D MMM' : 'ddd D MMM YYYY';
    return window.moment(day, DAY_FORMAT).format(format);
}

/**
 * If {@link task} is tracked and late enough for a badge, add the badge right after its rendered horizon, set the
 * `data-task-lateness` attribute on its list item, and return the badge. Otherwise change nothing and return null.
 *
 * @param li - the task's list item.
 * @param horizonSpan - the task's `span.task-horizon`.
 * @param task - the rendered task.
 * @param lateDays - the days late for each badge level.
 * @param today
 */
export function addLatenessBadge(
    li: HTMLElement,
    horizonSpan: HTMLElement,
    task: Task,
    lateDays: LateDays = horizonHistorySettings().lateDays,
    today: string = todayAsDay(),
): HTMLSpanElement | null {
    const entry = HorizonHistory.getInstance().entryFor(task);
    const days = entry === null ? null : daysLate(entry, today);
    const level = days === null ? null : latenessLevel(days, lateDays);
    if (entry === null || days === null || level === null) {
        return null;
    }

    const badge = horizonSpan.parentElement!.createSpan({ cls: 'task-horizon-late' });
    horizonSpan.after(badge);
    badge.setAttribute('data-task-lateness', level);
    badge.setAttribute('aria-label', historyDetails(entry, today, createdDayOf(task)).flat().join(' · '));
    badge.textContent = latenessText(days);
    li.setAttribute('data-task-lateness', level);
    return badge;
}
