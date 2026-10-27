import { type Plugin, debounce } from 'obsidian';
import { State } from '../Obsidian/Cache';
import type { TasksEvents } from '../Obsidian/TasksEvents';
import type { Task } from '../Task/Task';
import { logging } from '../lib/logging';
import { loadHistory, saveDay } from './HistoryFiles';
import { globalQueryMatcher } from './globalQueryMatcher';
import { HorizonHistory } from './HorizonHistory';
import { horizonHistorySettings, trackedTasks } from './HorizonHistorySettings';
import { todayAsDay } from './HorizonPeriod';
import { redrawHorizonHistory } from './redrawHorizonHistory';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * Load the history once the vault is ready, update it after every change to the task cache, and save it a few
 * seconds after a change and when the plugin unloads. Call once from the plugin's `onload()`, after the cache exists.
 */
export function startHorizonHistory(plugin: Plugin, events: TasksEvents): void {
    const logger = logging.getLogger('tasks.HorizonHistory');
    const history = HorizonHistory.getInstance();
    const fileSystem = plugin.app.vault.adapter;

    const save = async () => {
        const pending = history.pendingSave(todayAsDay());
        if (pending === null) {
            return;
        }
        try {
            await saveDay(fileSystem, pending.day, pending.content);
            history.markSaved(pending);
        } catch (error) {
            logger.error('Could not save the horizon history', error);
        }
    };
    const saveSoon = debounce(() => void save(), 3000, true);

    const onCacheUpdate = ({ tasks, state }: { tasks: Task[]; state: State }) => {
        if (state !== State.Warm || !history.isLoaded()) {
            return;
        }
        history.observe(tasks, todayAsDay(), trackedTasks(horizonHistorySettings()), globalQueryMatcher(tasks));
        saveSoon();
    };
    plugin.registerEvent(events.onCacheUpdate(onCacheUpdate));
    // The settings tab sends this after the global query changed.
    plugin.registerEvent(events.onReloadOpenSearchResults(() => events.triggerRequestCacheUpdate(onCacheUpdate)));

    // After Reset lateness: save, and redraw the badges and menus.
    history.setChangeListener(() => {
        saveSoon();
        redrawHorizonHistory(plugin.app, events);
    });

    plugin.app.workspace.onLayoutReady(async () => {
        const today = todayAsDay();
        try {
            history.load(await loadHistory(fileSystem, today), today);
        } catch (error) {
            logger.error('Could not load the horizon history', error);
            return;
        }
        // Catch up with changes made while Obsidian was closed.
        events.triggerRequestCacheUpdate(onCacheUpdate);
    });

    plugin.register(() => {
        saveSoon.run();
        history.setChangeListener(() => {});
    });
}
