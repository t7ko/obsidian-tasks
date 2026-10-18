import { horizons } from '../Task/Horizon';
import { logging } from '../lib/logging';
import { KEEP_CLOSED_DAYS } from './HistoryMatcher';
import { addDays } from './HorizonPeriod';
import { type HistoryEntry, type HistoryRecord, historyKey, toRecord } from './HistoryRecord';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * Reading and writing the day files, `.tasks-history/YYYY-MM-DD.json` in the vault. A `full` file holds every open
 * tracked task, plus the tasks closed or dropped that day; a `changes` file holds only the tasks that changed since
 * the previous file. Files of version 1 (the first format) are all full.
 */

export const HISTORY_FOLDER = '.tasks-history';

/** A full file is written when the newest one is this many days old or more. */
export const FULL_FILE_EVERY_DAYS = 7;

export type DayFileKind = 'full' | 'changes';

export interface DayFile {
    kind: DayFileKind;
    records: HistoryRecord[];
}

const DAY_FILE_NAME = /^(\d{4}-\d{2}-\d{2})\.json$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly unknown[] = ['open', 'done', 'cancelled', 'dropped'];
const HORIZON_STATES: readonly unknown[] = [...horizons, 'invalid', 'none'];

const logger = logging.getLogger('tasks.HorizonHistory');

/**
 * The part of Obsidian's `DataAdapter` the history uses. The adapter reaches dot folders, which the vault API skips.
 */
export interface HistoryFileSystem {
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
    write(path: string, data: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    list(path: string): Promise<{ files: string[]; folders: string[] }>;
}

export function dayFilePath(day: string): string {
    return `${HISTORY_FOLDER}/${day}.json`;
}

/**
 * The content of {@link day}'s file holding {@link entries}: one task per line, sorted by path and line.
 */
export function serializeDay(day: string, kind: DayFileKind, entries: readonly HistoryEntry[]): string {
    const lines = [...entries]
        .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.id.localeCompare(b.id))
        .map((entry) => `    ${JSON.stringify(toRecord(entry))}`);
    const tasks = lines.length === 0 ? '[]' : `[\n${lines.join(',\n')}\n  ]`;
    return `{\n  "version": 2,\n  "date": ${JSON.stringify(day)},\n  "kind": "${kind}",\n  "tasks": ${tasks}\n}\n`;
}

/**
 * What a record says, without its line number: a task whose line only moved has not changed.
 */
export function comparableRecord(entry: HistoryRecord): string {
    const { line: _line, ...rest } = toRecord(entry);
    return JSON.stringify(rest);
}

/**
 * The kind and records of a day file's content, skipping malformed records. Throws if it is not a day file.
 */
export function parseDay(content: string): DayFile {
    const data: unknown = JSON.parse(content);
    if (typeof data !== 'object' || data === null) {
        throw new Error('not a horizon history file');
    }
    const { version, kind, tasks } = data as { version?: unknown; kind?: unknown; tasks?: unknown };
    if (!Array.isArray(tasks)) {
        throw new Error('not a horizon history file');
    }
    if (version === 1) {
        return { kind: 'full', records: tasks.filter(isHistoryRecord) };
    }
    if (version === 2 && (kind === 'full' || kind === 'changes')) {
        return { kind, records: tasks.filter(isHistoryRecord) };
    }
    throw new Error('not a horizon history file');
}

function isHistoryRecord(value: unknown): value is HistoryRecord {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return (
        typeof record.id === 'string' &&
        typeof record.path === 'string' &&
        typeof record.line === 'number' &&
        typeof record.text === 'string' &&
        HORIZON_STATES.includes(record.horizon) &&
        STATUSES.includes(record.status) &&
        (record.closed === undefined || isDay(record.closed)) &&
        (record.planned === undefined || isDay(record.planned)) &&
        typeof record.pushes === 'number' &&
        isDay(record.since)
    );
}

function isDay(value: unknown): boolean {
    return typeof value === 'string' && DAY.test(value);
}

export interface LoadedHistory {
    /** The tracked tasks, as of the newest file */
    entries: HistoryEntry[];
    /** The tracked tasks before {@link today}'s file: what today's changes are measured against */
    entriesBeforeToday: HistoryEntry[];
    /** The day of the newest full file, or null if there is none */
    latestFullDay: string | null;
    /** Whether {@link today} has a file already */
    hasTodayFile: boolean;
}

/**
 * Read the history up to {@link today}: the newest readable full file, the files after it, and the done, cancelled
 * and dropped tasks in the files of the last {@link KEEP_CLOSED_DAYS} days before it. Unreadable files are skipped.
 */
export async function loadHistory(fileSystem: HistoryFileSystem, today: string): Promise<LoadedHistory> {
    const days = await listDays(fileSystem, today);
    const files = new Map<string, DayFile | null>();
    const read = async (day: string) => {
        if (!files.has(day)) {
            files.set(day, await readDay(fileSystem, day));
        }
        return files.get(day) ?? null;
    };

    let latestFullDay: string | null = null;
    for (let index = days.length - 1; index >= 0 && latestFullDay === null; index--) {
        if ((await read(days[index]))?.kind === 'full') {
            latestFullDay = days[index];
        }
    }

    const cutoff = addDays(today, -KEEP_CLOSED_DAYS);
    const start = latestFullDay !== null && latestFullDay < cutoff ? latestFullDay : cutoff;
    const state = new Map<string, HistoryEntry>();
    let stateBeforeToday: Map<string, HistoryEntry> | null = null;

    for (const day of days) {
        if (latestFullDay !== null && day < start) {
            continue;
        }
        if (day === today) {
            stateBeforeToday = new Map(state);
        }
        const file = await read(day);
        if (file === null) {
            continue;
        }
        if (latestFullDay !== null && day < latestFullDay) {
            // Before the newest full file, only closings count: that file says which tasks are open.
            for (const record of file.records.filter((record) => record.status !== 'open')) {
                state.set(record.id, toEntry(record, day));
            }
            continue;
        }
        if (day === latestFullDay) {
            for (const [id, entry] of state) {
                if (entry.status === 'open') {
                    state.delete(id);
                }
            }
        }
        for (const record of file.records) {
            state.set(record.id, toEntry(record, day));
        }
    }

    return {
        entries: [...state.values()],
        entriesBeforeToday: [...(stateBeforeToday ?? state).values()],
        latestFullDay,
        hasTodayFile: days[days.length - 1] === today,
    };
}

/**
 * Write {@link day}'s file, creating the history folder if needed.
 */
export async function saveDay(fileSystem: HistoryFileSystem, day: string, content: string): Promise<void> {
    if (!(await fileSystem.exists(HISTORY_FOLDER))) {
        await fileSystem.mkdir(HISTORY_FOLDER);
    }
    await fileSystem.write(dayFilePath(day), content);
}

/**
 * The days that have a file, up to {@link today}, oldest first.
 */
async function listDays(fileSystem: HistoryFileSystem, today: string): Promise<string[]> {
    if (!(await fileSystem.exists(HISTORY_FOLDER))) {
        return [];
    }
    const days: string[] = [];
    for (const file of (await fileSystem.list(HISTORY_FOLDER)).files) {
        const match = DAY_FILE_NAME.exec(file.split('/').pop() ?? '');
        if (match !== null && match[1] <= today) {
            days.push(match[1]);
        }
    }
    return days.sort();
}

async function readDay(fileSystem: HistoryFileSystem, day: string): Promise<DayFile | null> {
    try {
        return parseDay(await fileSystem.read(dayFilePath(day)));
    } catch (error) {
        logger.warn(`Skipped unreadable horizon history file ${dayFilePath(day)}`, error);
        return null;
    }
}

function toEntry(record: HistoryRecord, day: string): HistoryEntry {
    const entry: HistoryEntry = { ...record, key: historyKey(record.text) };
    if (record.status !== 'open') {
        entry.closedOn = day;
    }
    return entry;
}
