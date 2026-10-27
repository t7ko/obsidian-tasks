import { StatusType } from '../Statuses/StatusConfiguration';
import { StatusRegistry } from '../Statuses/StatusRegistry';
import { doneStatus } from './SplitTask';
import type { Task } from './Task';

/**
 * t7 fork feature: complete permanently. Spec: `fork-features/complete-permanently.md`.
 *
 * A recurring task is marked done without a next occurrence, and the done line stays even with `🏁 delete`:
 *
 *     - [ ] Water plants 🔁 every day 🏁 delete 📅 2026-10-27
 *       →  - [x] Water plants 🔁 every day 🏁 delete 📅 2026-10-27 ✅ 2026-10-27
 */

/**
 * Whether {@link task} can be completed permanently: it recurs and is open (not done, cancelled or a non-task).
 */
export function canCompletePermanently(task: Task): boolean {
    const openTypes = [StatusType.TODO, StatusType.IN_PROGRESS, StatusType.ON_HOLD];
    return task.recurrence !== null && openTypes.includes(task.status.type);
}

/**
 * {@link task} marked done (done date {@link today}, if the settings set done dates), with no next occurrence and
 * whatever its On Completion says; or null if it {@link canCompletePermanently cannot be completed permanently}.
 * Only the status and the done date change. The status is the one a toggle would give, if that is a done status.
 */
export function completePermanently(task: Task, today = window.moment()): Task | null {
    if (!canCompletePermanently(task)) {
        return null;
    }
    const nextStatus = StatusRegistry.getInstance().getNextStatusOrCreate(task.status);
    const status = nextStatus.type === StatusType.DONE ? nextStatus : doneStatus();
    // handleNewStatus() returns [next, done] and leaves On Completion to its callers: keep only the done task.
    const newTasks = task.handleNewStatus(status, today);
    return newTasks[newTasks.length - 1];
}
