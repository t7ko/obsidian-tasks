import { type HorizonState, findHorizonToken } from '../Task/Horizon';
import { daysBetween } from './HorizonPeriod';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * What the history keeps for each tracked task, and the text it recognises tasks by.
 */

export type HistoryStatus = 'open' | 'done' | 'cancelled' | 'dropped';

/**
 * A tracked task, as stored in the day files.
 */
export interface HistoryRecord {
    /** Internal id, unique in the vault's history */
    id: string;
    path: string;
    /** Zero-based line number in the file */
    line: number;
    /** The task's line as last seen */
    text: string;
    /** The horizon as last seen */
    horizon: HorizonState;
    status: HistoryStatus;
    /** The day the task was done, cancelled or dropped */
    closed?: string;
    /** The earliest day the task was planned for, while it has a horizon */
    planned?: string;
    /** How many times the horizon was changed to one whose period ends later */
    pushes: number;
    /** The day tracking started */
    since: string;
}

/**
 * A tracked task in memory.
 */
export interface HistoryEntry extends HistoryRecord {
    /** The text the task is recognised by: see {@link historyKey} */
    key: string;
    /** For done, cancelled and dropped tasks: the day whose file recorded the closing */
    closedOn?: string;
}

// Indentation (including blockquote markers), list marker and checkbox
const LINE_START = /^[\s>]*(?:[-*+]|\d+[.)])\s+\[[^\]]\]\s*/;

// Done and cancelled dates, in the emoji and Dataview formats
const CLOSING_DATES =
    /\s*(?:[\u2705\u274C]\uFE0F?\s*\d{4}-\d{2}-\d{2}|[[(](?:completion|cancelled)::\s*\d{4}-\d{2}-\d{2}\s*[\])])/gu;

/**
 * The text a task line is recognised by: the line without its indentation, list marker and checkbox, without
 * done and cancelled dates, the horizon and multi-step strikes, with runs of whitespace made single spaces.
 *
 * So completing a task, changing its horizon or finishing one of its steps leaves this text unchanged.
 */
export function historyKey(line: string): string {
    let text = line.replace(LINE_START, '');
    const token = findHorizonToken(text);
    if (token !== null) {
        text = text.slice(0, token.start) + ' ' + text.slice(token.end);
    }
    return text.replace(CLOSING_DATES, ' ').replace(/~~/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * How alike two {@link historyKey} texts are, from 0 to 1: the words they share, divided by all their distinct words.
 */
export function similarity(a: string, b: string): number {
    const wordsA = new Set(a.split(' ').filter((word) => word !== ''));
    const wordsB = new Set(b.split(' ').filter((word) => word !== ''));
    let shared = 0;
    for (const word of wordsA) {
        if (wordsB.has(word)) {
            shared += 1;
        }
    }
    const all = wordsA.size + wordsB.size - shared;
    return all === 0 ? 1 : shared / all;
}

/**
 * Days late, never negative: from the planned day to {@link today} for an open task, or to the day it was done or
 * cancelled. Null for a task without a planned day, and for a dropped task.
 */
export function daysLate(record: HistoryRecord, today: string): number | null {
    if (record.status === 'dropped' || record.planned === undefined) {
        return null;
    }
    const end = record.status === 'open' ? today : (record.closed ?? today);
    return Math.max(0, daysBetween(record.planned, end));
}

/**
 * The record to store for {@link entry}, with its fields in file order.
 */
export function toRecord(entry: HistoryRecord): HistoryRecord {
    const { id, path, line, text, horizon, status, closed, planned, pushes, since } = entry;
    return {
        id,
        path,
        line,
        text,
        horizon,
        status,
        ...(closed === undefined ? {} : { closed }),
        ...(planned === undefined ? {} : { planned }),
        pushes,
        since,
    };
}
