import type { Menu } from 'obsidian';
import type { Task } from '../Task/Task';
import { HorizonHistory } from './HorizonHistory';
import { todayAsDay } from './HorizonPeriod';
import { createdDayOf, historyDetails } from './LatenessBadge';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * For a tracked task, end {@link menu} (a horizon menu) with a separator and label lines with the task's planned
 * date, lateness, pushes and age, and, for an open task with a planned date, `Reset lateness`.
 */
export function addHorizonHistoryItems(menu: Menu, task: Task, today: string = todayAsDay()): void {
    const history = HorizonHistory.getInstance();
    const entry = history.entryFor(task);
    if (entry === null) {
        return;
    }

    menu.addSeparator();
    for (const parts of historyDetails(entry, today, createdDayOf(task))) {
        const title = parts.join(' · ');
        menu.addItem((item) => item.setTitle(title.charAt(0).toUpperCase() + title.slice(1)).setIsLabel(true));
    }
    if (entry.status === 'open' && entry.planned !== undefined) {
        menu.addItem((item) => item.setTitle('Reset lateness').onClick(() => history.resetLateness(task)));
    }
}
