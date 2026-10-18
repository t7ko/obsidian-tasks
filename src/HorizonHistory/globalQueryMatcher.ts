import { GlobalQuery } from '../Config/GlobalQuery';
import { SearchInfo } from '../Query/SearchInfo';
import { TasksFile } from '../Scripting/TasksFile';
import type { Task } from '../Task/Task';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * Whether a task matches the global query's filters, as in Tasks' quick search: an invalid global query, or a filter
 * that fails on a task, lets the task through. Placeholders in the global query see a made-up query file.
 */
export function globalQueryMatcher(tasks: readonly Task[]): (task: Task) => boolean {
    const globalQuery = GlobalQuery.getInstance();
    if (!globalQuery.hasInstructions()) {
        return () => true;
    }
    const tasksFile = new TasksFile('Horizon history.md');
    const query = globalQuery.query(tasksFile);
    if (query.error !== undefined) {
        return () => true;
    }
    const filters = query.filters;
    const searchInfo = new SearchInfo(tasksFile, [...tasks]);
    return (task: Task) => {
        try {
            return filters.every((filter) => filter.filterFunction(task, searchInfo));
        } catch {
            return true;
        }
    };
}
