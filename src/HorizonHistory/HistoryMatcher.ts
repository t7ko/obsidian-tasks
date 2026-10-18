import type { HorizonHistorySettings } from '../Config/ForkSettings';
import { type Horizon, type HorizonState, horizons } from '../Task/Horizon';
import { addDays, periodEnd } from './HorizonPeriod';
import { type HistoryEntry, similarity } from './HistoryRecord';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * Links the tasks found in the vault to the tracked ones, and updates the tracked ones.
 * Pure functions on plain data, so they can be tested without Obsidian.
 */

/** Done and cancelled tasks are remembered for this many days after the day their closing was recorded. */
export const KEEP_CLOSED_DAYS = 35;

/** Dropped tasks are remembered until the end of the next day. */
export const KEEP_DROPPED_DAYS = 1;

const SIMILAR_AT_SAME_LINE = 0.3;
const SIMILAR_IN_SAME_FILE = 0.6;

/**
 * A task as found in the vault.
 */
export interface ObservedTask {
    path: string;
    line: number;
    text: string;
    /** See {@link historyKey} */
    key: string;
    horizon: HorizonState;
    status: 'open' | 'done' | 'cancelled';
    /** The task's done or cancelled date, if it has one */
    closedDate: string | null;
    recurring: boolean;
}

export function isHorizon(state: HorizonState): state is Horizon {
    return (horizons as readonly string[]).includes(state);
}

/**
 * Return the tracked tasks after the vault was found to hold {@link observed} on {@link today}.
 *
 * Linked tasks are updated. Open tasks that aren't linked start being tracked: with {@link track} `'horizon'`, only
 * those with a valid horizon. Open tracked tasks that aren't linked are dropped. Old done, cancelled and dropped tasks
 * are forgotten first, so they are never linked again. {@link entries} is not changed.
 */
export function updateEntries(
    entries: readonly HistoryEntry[],
    observed: readonly ObservedTask[],
    today: string,
    newId: () => string,
    track: HorizonHistorySettings['track'] = 'horizon',
): HistoryEntry[] {
    const remembered = forgetOldEntries(entries, today);
    const links = linkObservedTasks(remembered, observed);
    const linkedEntries = new Set(links.values());
    const updated: HistoryEntry[] = [];

    observed.forEach((task, taskIndex) => {
        const entryIndex = links.get(taskIndex);
        if (entryIndex !== undefined) {
            updated.push(observe(remembered[entryIndex], task, today));
        } else if (task.status === 'open' && (track === 'open' || isHorizon(task.horizon))) {
            updated.push(startTracking(task, today, newId()));
        }
    });

    remembered.forEach((entry, entryIndex) => {
        if (linkedEntries.has(entryIndex)) {
            return;
        }
        if (entry.status === 'open') {
            updated.push({ ...entry, status: 'dropped', closed: today, closedOn: today });
        } else {
            updated.push(entry);
        }
    });

    return updated;
}

/**
 * {@link entries} without the done and cancelled tasks closed more than {@link KEEP_CLOSED_DAYS} days ago, and the
 * dropped ones dropped more than {@link KEEP_DROPPED_DAYS} ago.
 */
export function forgetOldEntries(entries: readonly HistoryEntry[], today: string): HistoryEntry[] {
    const closedCutoff = addDays(today, -KEEP_CLOSED_DAYS);
    const droppedCutoff = addDays(today, -KEEP_DROPPED_DAYS);
    return entries.filter((entry) => {
        if (entry.status === 'open' || entry.closedOn === undefined) {
            return true;
        }
        return entry.closedOn >= (entry.status === 'dropped' ? droppedCutoff : closedCutoff);
    });
}

/**
 * Link each of {@link observed} to at most one of {@link entries}, and each entry to at most one task.
 *
 * @returns a map from the index of a task in {@link observed} to the index of its entry in {@link entries}.
 */
export function linkObservedTasks(
    entries: readonly HistoryEntry[],
    observed: readonly ObservedTask[],
): Map<number, number> {
    const links = new Map<number, number>();
    const freeEntries = new Set(entries.keys());

    const link = (taskIndex: number, entryIndex: number) => {
        links.set(taskIndex, entryIndex);
        freeEntries.delete(entryIndex);
    };

    const linkByKey = (
        entryKey: (entry: HistoryEntry) => string | null,
        taskKey: (task: ObservedTask) => string | null,
        canLink: (entry: HistoryEntry, task: ObservedTask) => boolean,
    ) => {
        const entriesByKey = new Map<string, number[]>();
        for (const entryIndex of freeEntries) {
            const key = entryKey(entries[entryIndex]);
            if (key !== null) {
                entriesByKey.set(key, [...(entriesByKey.get(key) ?? []), entryIndex]);
            }
        }
        observed.forEach((task, taskIndex) => {
            const key = links.has(taskIndex) ? null : taskKey(task);
            if (key === null) {
                return;
            }
            const candidates = (entriesByKey.get(key) ?? []).filter(
                (entryIndex) => freeEntries.has(entryIndex) && canLink(entries[entryIndex], task),
            );
            const nearest = nearestEntry(candidates, entries, task);
            if (nearest !== null) {
                link(taskIndex, nearest);
            }
        });
    };

    // 1. The same line, unchanged, in the same file
    linkByKey(
        (entry) => `${entry.path}\n${entry.text}`,
        (task) => `${task.path}\n${task.text}`,
        mayReopen,
    );
    // 2. The same text in the same file
    linkByKey(
        (entry) => `${entry.path}\n${entry.key}`,
        (task) => `${task.path}\n${task.key}`,
        mayReopen,
    );
    // 3. The same text in another file
    linkByKey(
        (entry) => entry.key,
        (task) => task.key,
        mayReopen,
    );
    // 4. The same line number in the same file, with similar text
    linkByKey(
        (entry) => (entry.status === 'open' ? `${entry.path}\n${entry.line}` : null),
        (task) => (mayBeEdited(task) ? `${task.path}\n${task.line}` : null),
        (entry, task) => similarity(entry.key, task.key) >= SIMILAR_AT_SAME_LINE,
    );
    // 5. Similar text elsewhere in the same file
    observed.forEach((task, taskIndex) => {
        if (links.has(taskIndex) || !mayBeEdited(task)) {
            return;
        }
        let best: number | null = null;
        let bestSimilarity = 0;
        for (const entryIndex of freeEntries) {
            const entry = entries[entryIndex];
            if (entry.status !== 'open' || entry.path !== task.path) {
                continue;
            }
            const value = similarity(entry.key, task.key);
            if (value < SIMILAR_IN_SAME_FILE) {
                continue;
            }
            const isBetter =
                best === null ||
                value > bestSimilarity ||
                (value === bestSimilarity && distance(entry, task) < distance(entries[best], task));
            if (isBetter) {
                best = entryIndex;
                bestSimilarity = value;
            }
        }
        if (best !== null) {
            link(taskIndex, best);
        }
    });

    return links;
}

/**
 * A done or cancelled task is linked to an open line only at its own line: it was unchecked there.
 * Elsewhere, an open line with the same text is a new task.
 */
function mayReopen(entry: HistoryEntry, task: ObservedTask): boolean {
    const isClosed = entry.status === 'done' || entry.status === 'cancelled';
    return !isClosed || task.status !== 'open' || (entry.path === task.path && entry.line === task.line);
}

/**
 * Only open, non-recurring lines are linked by similar text: a recurring task's next occurrence takes the place of
 * the completed one, with similar text.
 */
function mayBeEdited(task: ObservedTask): boolean {
    return task.status === 'open' && !task.recurring;
}

function distance(entry: HistoryEntry, task: ObservedTask): number {
    return entry.path === task.path ? Math.abs(entry.line - task.line) : Number.MAX_SAFE_INTEGER;
}

function nearestEntry(candidates: number[], entries: readonly HistoryEntry[], task: ObservedTask): number | null {
    let nearest: number | null = null;
    for (const entryIndex of candidates) {
        if (nearest === null || distance(entries[entryIndex], task) < distance(entries[nearest], task)) {
            nearest = entryIndex;
        }
    }
    return nearest;
}

/**
 * {@link entry} updated with how its task was found on {@link today}.
 */
function observe(entry: HistoryEntry, task: ObservedTask, today: string): HistoryEntry {
    const updated: HistoryEntry = { ...entry, path: task.path, line: task.line, text: task.text, key: task.key };

    if (task.status !== 'open') {
        if (entry.status === 'open' || entry.status === 'dropped') {
            updated.closed = task.closedDate ?? today;
            updated.closedOn = today;
        } else if (task.closedDate !== null) {
            updated.closed = task.closedDate;
        }
        updated.status = task.status;
        updated.horizon = task.horizon;
        return updated;
    }

    if (entry.status !== 'open') {
        updated.status = 'open';
        delete updated.closed;
        delete updated.closedOn;
    }
    if (task.horizon === 'none') {
        // Without a horizon, the task has no plan.
        delete updated.planned;
        updated.pushes = 0;
    } else if (isHorizon(task.horizon)) {
        const end = periodEnd(task.horizon, today);
        const isPush =
            entry.planned !== undefined &&
            isHorizon(entry.horizon) &&
            entry.horizon !== task.horizon &&
            end > periodEnd(entry.horizon, today);
        if (isPush) {
            updated.pushes += 1;
        }
        if (updated.planned === undefined || end < updated.planned) {
            updated.planned = end;
        }
    }
    updated.horizon = task.horizon;
    return updated;
}

function startTracking(task: ObservedTask, today: string, id: string): HistoryEntry {
    return {
        id,
        path: task.path,
        line: task.line,
        text: task.text,
        horizon: task.horizon,
        status: 'open',
        ...(isHorizon(task.horizon) ? { planned: periodEnd(task.horizon, today) } : {}),
        pushes: 0,
        since: today,
        key: task.key,
    };
}
