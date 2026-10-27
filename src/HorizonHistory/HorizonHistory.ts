import type { HorizonHistorySettings } from '../Config/ForkSettings';
import { StatusType } from '../Statuses/StatusConfiguration';
import { HORIZON_MARKER, horizonOf } from '../Task/Horizon';
import type { Task } from '../Task/Task';
import {
    type DayFileKind,
    FULL_FILE_EVERY_DAYS,
    type LoadedHistory,
    comparableRecord,
    serializeDay,
} from './HistoryFiles';
import { type ObservedTask, forgetOldEntries, isHorizon, updateEntries } from './HistoryMatcher';
import { type HistoryEntry, daysLate, historyKey } from './HistoryRecord';
import { DAY_FORMAT, daysBetween, periodEnd, todayAsDay } from './HorizonPeriod';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * The tracked tasks, for the renderer, the horizon menu and the query fields. There is one instance:
 * `startHorizonHistory()` loads it, gives it the cache's tasks after every change, and saves it.
 */
export class HorizonHistory {
    private static instance: HorizonHistory | null = null;

    private entries: HistoryEntry[] = [];
    private entriesByPathAndKey = new Map<string, HistoryEntry[]>();
    private usedIds = new Set<string>();
    private loaded = false;

    // For saving: what today's changes are measured against, what was written last, and the newest full file.
    private baselineDay = '';
    private baseline = new Map<string, string>();
    private savedState = new Map<string, string>();
    private savedDay: string | null = null;
    private savedContent = '';
    private latestFullDay: string | null = null;

    private changeListener: () => void = () => {};

    public static getInstance(): HorizonHistory {
        if (HorizonHistory.instance === null) {
            HorizonHistory.instance = new HorizonHistory();
        }
        return HorizonHistory.instance;
    }

    /**
     * Start again with an empty history that is not loaded. For tests.
     */
    public static resetInstance(): void {
        HorizonHistory.instance = null;
    }

    public isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Take the tasks read from the day files. Until then, the history changes nothing and tracks no task.
     */
    public load(loaded: LoadedHistory, today: string): void {
        this.setEntries(forgetOldEntries(loaded.entries, today));
        this.loaded = true;
        this.latestFullDay = loaded.latestFullDay;
        this.baselineDay = today;
        this.baseline = comparableState(loaded.entriesBeforeToday);
        this.savedState = comparableState(this.entries);
        this.savedDay = loaded.hasTodayFile ? today : null;
        this.savedContent = loaded.hasTodayFile ? (this.buildSave(today)?.content ?? '') : '';
    }

    /**
     * Update the history with the vault's tasks, as found on {@link today}.
     *
     * @param tasks - every task in the vault.
     * @param today
     * @param track - which tasks to track.
     * @param isIncluded - whether an open task may be tracked, such as whether it matches the global query.
     */
    public observe(
        tasks: readonly Task[],
        today: string,
        track: HorizonHistorySettings['track'] = 'horizon',
        isIncluded: (task: Task) => boolean = () => true,
    ): void {
        if (!this.loaded) {
            return;
        }
        const observed = observedTasks(tasks, track, isIncluded);
        this.setEntries(updateEntries(this.entries, observed, today, () => this.newId(), track));
    }

    /**
     * What to write to {@link today}'s file, or null if nothing needs writing. Pass the result to {@link markSaved}
     * once written.
     */
    public pendingSave(today: string): PendingSave | null {
        if (!this.loaded) {
            return null;
        }
        if (today !== this.baselineDay) {
            // A new day: its changes are measured against the state last written.
            this.baselineDay = today;
            this.baseline = this.savedState;
        }
        const save = this.buildSave(today);
        if (save === null) {
            return null;
        }
        return today === this.savedDay && save.content === this.savedContent ? null : save;
    }

    public markSaved(save: PendingSave): void {
        this.savedDay = save.day;
        this.savedContent = save.content;
        this.savedState = save.state;
        if (save.kind === 'full') {
            this.latestFullDay = save.day;
        }
    }

    /**
     * The tracked task that {@link task} is, or null if it is not tracked or was dropped.
     * Several tracked tasks with the same file and text: the one with the same line, else the nearest line.
     */
    public entryFor(task: Task): HistoryEntry | null {
        if (!this.loaded || !task.taskLocation.hasKnownPath) {
            return null;
        }
        const candidates = this.entriesByPathAndKey.get(pathAndKey(task.path, historyKey(task.originalMarkdown)));
        if (candidates === undefined) {
            return null;
        }
        const lineNumber = task.taskLocation.lineNumber;
        const distance = (entry: HistoryEntry) =>
            (entry.text === task.originalMarkdown ? 0 : Number.MAX_SAFE_INTEGER / 2) +
            Math.abs(entry.line - lineNumber);
        return candidates.reduce((best, entry) => (distance(entry) < distance(best) ? entry : best));
    }

    public plannedDate(task: Task): Moment | null {
        const planned = this.entryFor(task)?.planned;
        return planned === undefined ? null : window.moment(planned, DAY_FORMAT);
    }

    /**
     * When {@link task} was created: its created date, or else the day the history started tracking it.
     */
    public openedDate(task: Task): Moment | null {
        if (task.createdDate?.isValid()) {
            return task.createdDate;
        }
        const since = this.entryFor(task)?.since;
        return since === undefined ? null : window.moment(since, DAY_FORMAT);
    }

    /**
     * Days late, or null if {@link task} has no planned date. See {@link daysLate}.
     */
    public daysLate(task: Task, today: string = todayAsDay()): number | null {
        const entry = this.entryFor(task);
        return entry === null ? null : daysLate(entry, today);
    }

    /**
     * Plan {@link task} afresh: its planned date becomes the end of its horizon's period as of {@link today},
     * and it has no pushes. Only for open tracked tasks with a horizon.
     */
    public resetLateness(task: Task, today: string = todayAsDay()): void {
        const entry = this.entryFor(task);
        if (entry === null || entry.status !== 'open' || entry.planned === undefined) {
            return;
        }
        entry.planned = isHorizon(entry.horizon) ? periodEnd(entry.horizon, today) : today;
        entry.pushes = 0;
        this.changeListener();
    }

    /**
     * Set the function called after a change not caused by the vault, such as {@link resetLateness}.
     */
    public setChangeListener(listener: () => void): void {
        this.changeListener = listener;
    }

    public getEntries(): readonly HistoryEntry[] {
        return this.entries;
    }

    /**
     * Today's file: a full one if the newest full file is old enough (or is today's), else the changes since the
     * baseline. Null if there is nothing to write and today has no file yet.
     */
    private buildSave(today: string): PendingSave | null {
        const state = comparableState(this.entries);
        const isFull =
            this.latestFullDay === null ||
            this.latestFullDay === today ||
            daysBetween(this.latestFullDay, today) >= FULL_FILE_EVERY_DAYS;
        const changed = this.entries.filter((entry) => state.get(entry.id) !== this.baseline.get(entry.id));
        if (changed.length === 0 && this.savedDay !== today) {
            return null;
        }
        const kind: DayFileKind = isFull ? 'full' : 'changes';
        const records = isFull
            ? this.entries.filter((entry) => entry.status === 'open' || entry.closedOn === today)
            : changed;
        return { day: today, kind, content: serializeDay(today, kind, records), state };
    }

    private setEntries(entries: HistoryEntry[]): void {
        this.entries = entries;
        this.usedIds = new Set(entries.map((entry) => entry.id));
        this.entriesByPathAndKey.clear();
        for (const entry of entries) {
            if (entry.status === 'dropped') {
                continue;
            }
            const key = pathAndKey(entry.path, entry.key);
            this.entriesByPathAndKey.set(key, [...(this.entriesByPathAndKey.get(key) ?? []), entry]);
        }
    }

    private newId(): string {
        let id: string;
        do {
            id = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
        } while (this.usedIds.has(id));
        this.usedIds.add(id);
        return id;
    }
}

export interface PendingSave {
    day: string;
    kind: DayFileKind;
    content: string;
    /** {@link comparableRecord} of every tracked task when the content was built */
    state: Map<string, string>;
}

function comparableState(entries: readonly HistoryEntry[]): Map<string, string> {
    return new Map(entries.map((entry) => [entry.id, comparableRecord(entry)]));
}

function pathAndKey(path: string, key: string): string {
    return `${path}\n${key}`;
}

/**
 * The tasks in {@link tasks} that the history follows: those with a known file and an open, done or cancelled
 * status type; with {@link track} `'horizon'`, only those with a horizon marker; and of the open ones, only those
 * {@link isIncluded} accepts. Done and cancelled tasks are always passed on, so that completing a tracked task is
 * seen even if, say, the global query hides done tasks; they never start being tracked.
 */
export function observedTasks(
    tasks: readonly Task[],
    track: HorizonHistorySettings['track'] = 'horizon',
    isIncluded: (task: Task) => boolean = () => true,
): ObservedTask[] {
    const observed: ObservedTask[] = [];
    for (const task of tasks) {
        if (track === 'horizon' && !task.description.includes(HORIZON_MARKER)) {
            continue;
        }
        const horizon = horizonOf(task.description);
        const status = observedStatus(task);
        if ((track === 'horizon' && horizon === 'none') || status === null || !task.taskLocation.hasKnownPath) {
            continue;
        }
        if (status === 'open' && !isIncluded(task)) {
            continue;
        }
        const closedDate = status === 'done' ? task.doneDate : status === 'cancelled' ? task.cancelledDate : null;
        observed.push({
            path: task.path,
            line: task.taskLocation.lineNumber,
            text: task.originalMarkdown,
            key: historyKey(task.originalMarkdown),
            horizon,
            status,
            closedDate: closedDate?.isValid() ? closedDate.format(DAY_FORMAT) : null,
            recurring: task.recurrence !== null,
        });
    }
    return observed;
}

/**
 * The status the history gives {@link task}, or null for status types it ignores.
 */
export function observedStatus(task: Task): ObservedTask['status'] | null {
    switch (task.status.type) {
        case StatusType.TODO:
        case StatusType.IN_PROGRESS:
        case StatusType.ON_HOLD:
            return 'open';
        case StatusType.DONE:
            return 'done';
        case StatusType.CANCELLED:
            return 'cancelled';
        default:
            return null;
    }
}
