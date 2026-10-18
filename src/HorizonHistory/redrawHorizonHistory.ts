import { type App, MarkdownView } from 'obsidian';
import type { TasksEvents } from '../Obsidian/TasksEvents';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * After the history or its settings changed without a change in the vault: let the history see the cache's tasks
 * again, and redraw query results and Reading views, so badges, menus and groups are up to date.
 */
export function redrawHorizonHistory(app: App, events: TasksEvents): void {
    events.triggerRequestCacheUpdate((cacheData) => events.triggerCacheUpdate(cacheData));
    app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview') {
            leaf.view.previewMode.rerender(true);
        }
    });
}
