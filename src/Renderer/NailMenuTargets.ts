import { nailCount } from '../Task/Nails';
import type { Task } from '../Task/Task';
import { NailMenu } from '../ui/Menus/NailMenu';
import { type TaskSaver, defaultTaskSaver, showMenu } from '../ui/Menus/TaskEditingMenu';

/**
 * t7 fork feature: right-click a rendered task to add or remove a nail with a {@link NailMenu}.
 * Spec: `fork-features/nails.md`.
 *
 * The listener is on the task's `li`, so it runs after the listeners of the checkbox, dates, priority and horizon,
 * which open their own menus with {@link showMenu} and so stop the event. It also leaves alone right-clicks on
 * links, tags and media (Obsidian's menus), on nested list items, and on selected text (the menu with Copy).
 *
 * A task with nails also gets a `data-task-nails` attribute on its `li`, for CSS snippets.
 *
 * Call this once per task.
 *
 * @param li - the task's list item.
 * @param task - the rendered task.
 * @param taskSaver - an optional {@link TaskSaver} function, for tests. See {@link TaskEditingMenu}.
 */
export function addNailMenuTargets(li: HTMLElement, task: Task, taskSaver: TaskSaver = defaultTaskSaver) {
    const nails = nailCount(task.description);
    if (nails > 0) {
        li.setAttribute('data-task-nails', nails.toString());
    }

    // Without a path, as in a canvas card, an edit can't be saved.
    if (!task.taskLocation.hasKnownPath) {
        return;
    }

    li.addEventListener('contextmenu', (ev: MouseEvent) => {
        if (isForNailMenu(ev, li)) {
            showMenu(ev, new NailMenu(task, taskSaver));
        }
    });
}

function isForNailMenu(ev: MouseEvent, li: HTMLElement): boolean {
    if (ev.defaultPrevented) {
        return false;
    }
    const target = ev.target as Element | null;
    if (target === null || typeof target.closest !== 'function') {
        return false;
    }
    // A nested list item (tree view, Reading mode) has its own menu, or none.
    if (target.closest('li') !== li) {
        return false;
    }
    if (target.closest('a, img, video, input') !== null) {
        return false;
    }
    return !hasSelectedText(li);
}

function hasSelectedText(li: HTMLElement): boolean {
    const selection = li.ownerDocument.getSelection();
    if (selection === null || selection.isCollapsed || selection.toString().trim() === '') {
        return false;
    }
    // Selection.containsNode() is false for an li that holds the whole selection, so ask each range.
    for (let i = 0; i < selection.rangeCount; i++) {
        if (selection.getRangeAt(i).intersectsNode(li)) {
            return true;
        }
    }
    return false;
}
