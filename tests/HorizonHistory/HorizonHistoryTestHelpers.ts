import type { LoadedHistory } from '../../src/HorizonHistory/HistoryFiles';
import type { HistoryEntry } from '../../src/HorizonHistory/HistoryRecord';
import { historyKey } from '../../src/HorizonHistory/HistoryRecord';
import { horizonOf } from '../../src/Task/Horizon';
import { Task } from '../../src/Task/Task';
import { TaskLocation } from '../../src/Task/TaskLocation';
import { createTestTasksFile } from '../TestingTools/TasksFileHelpers';

/**
 * A task read from {@link line}, at {@link lineNumber} (zero-based) in the file {@link path}.
 */
export function taskAt(line: string, path = 'notes.md', lineNumber = 0): Task {
    return Task.fromLine({
        line,
        taskLocation: new TaskLocation(createTestTasksFile(path), lineNumber, 0, 0, null),
        fallbackDate: null,
    })!;
}

/**
 * A tracked entry for {@link task}, open and without a planned date unless {@link fields} say otherwise.
 */
export function entryForTask(task: Task, fields: Partial<HistoryEntry>): HistoryEntry {
    return {
        id: 'id-' + task.taskLocation.lineNumber,
        path: task.path,
        line: task.taskLocation.lineNumber,
        text: task.originalMarkdown,
        horizon: horizonOf(task.description),
        status: 'open',
        pushes: 0,
        since: fields.since ?? fields.planned ?? '2026-10-01',
        key: historyKey(task.originalMarkdown),
        ...fields,
    };
}

/**
 * What loading the history found, for {@link HorizonHistory.load}: {@link entries} and no file for today.
 */
export function loadedFrom(entries: HistoryEntry[] = [], latestFullDay: string | null = null): LoadedHistory {
    return { entries, entriesBeforeToday: entries, latestFullDay, hasTodayFile: false };
}
