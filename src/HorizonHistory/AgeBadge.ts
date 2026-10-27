import type { Task } from '../Task/Task';
import { HorizonHistory, observedStatus } from './HorizonHistory';
import { type LateDays, horizonHistorySettings } from './HorizonHistorySettings';
import { daysBetween, todayAsDay } from './HorizonPeriod';
import { type LatenessLevel, createdDayOf, createdText, historyDetails } from './LatenessBadge';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`, "Age badges".
 *
 * The badge after an open task's description saying how old it is, when the settings choose age badges.
 */

/**
 * The value of the `data-task-age` attribute: `none` is grey, the others are as for lateness.
 */
export type AgeLevel = 'none' | LatenessLevel;

/**
 * The badge level for a task {@link days} days old.
 */
export function ageLevel(days: number, ageDays: LateDays): AgeLevel {
    if (days >= ageDays.high) {
        return 'high';
    }
    if (days >= ageDays.medium) {
        return 'medium';
    }
    return days >= ageDays.low ? 'low' : 'none';
}

/**
 * The badge's text: `5d old`, `3w old`, `2mo old`, `2y old`.
 */
export function ageText(days: number): string {
    if (days < 14) {
        return `${days}d old`;
    }
    if (days < 60) {
        return `${Math.floor(days / 7)}w old`;
    }
    if (days < 730) {
        return `${Math.floor(days / 30)}mo old`;
    }
    return `${Math.floor(days / 365)}y old`;
}

/**
 * How many days old {@link task} is on {@link today}, counted from its created date or else from the day the history
 * started tracking it. Null for a task that is not open, is dropped, or has neither date.
 */
export function taskAge(task: Task, today: string): number | null {
    const entry = HorizonHistory.getInstance().entryFor(task);
    const isOpen = entry === null ? observedStatus(task) === 'open' : entry.status === 'open';
    const start = createdDayOf(task) ?? entry?.since;
    if (!isOpen || start === undefined) {
        return null;
    }
    return Math.max(0, daysBetween(start, today));
}

/**
 * If {@link task} is open and at least as old as the settings' `ageBadgeFrom`, add an age badge right after its
 * description in {@link textSpan}, set the `data-task-age` attribute on its list item, and return the badge.
 * Otherwise change nothing and return null.
 *
 * @param li - the task's list item.
 * @param textSpan - the task's `span.tasks-list-text`, holding its rendered components.
 * @param task - the rendered task.
 * @param settings - the horizon history's settings.
 * @param today
 */
export function addAgeBadge(
    li: HTMLElement,
    textSpan: HTMLSpanElement,
    task: Task,
    settings = horizonHistorySettings(),
    today: string = todayAsDay(),
): HTMLSpanElement | null {
    const days = taskAge(task, today);
    if (days === null || days < settings.ageBadgeFrom) {
        return null;
    }

    const level = ageLevel(days, settings.ageDays);
    const badge = textSpan.createSpan({ cls: 'task-age' });
    textSpan.querySelector(':scope > .task-description')?.after(badge);
    badge.setAttribute('data-task-age', level);
    badge.setAttribute('aria-label', ageDetails(task, today));
    badge.textContent = ageText(days);
    li.setAttribute('data-task-age', level);
    return badge;
}

function ageDetails(task: Task, today: string): string {
    const entry = HorizonHistory.getInstance().entryFor(task);
    const createdDay = createdDayOf(task);
    if (entry === null) {
        return createdDay === null ? '' : createdText(createdDay, today);
    }
    return historyDetails(entry, today, createdDay).flat().join(' · ');
}
