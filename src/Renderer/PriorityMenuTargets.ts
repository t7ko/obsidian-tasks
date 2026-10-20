import { TaskLayoutComponent, type TaskLayoutOptions } from '../Layout/TaskLayoutOptions';
import { Priority } from '../Task/Priority';
import type { Task } from '../Task/Task';
import { PriorityMenuWithNails } from '../ui/Menus/NailMenu';
import { type TaskSaver, defaultTaskSaver, showMenu } from '../ui/Menus/TaskEditingMenu';

/**
 * t7 fork feature: click or right-click a rendered task's priority to change it with upstream's `PriorityMenu`,
 * which ends with the nail items ({@link PriorityMenuWithNails}). Spec: `fork-features/priority-menu.md`.
 *
 * A task without a priority has no priority span, so it gets a placeholder instead: the `::after`
 * content of its description span, drawn by `PriorityMenuTargets.scss`. Events on a pseudo-element
 * are dispatched to the element that owns it, and the description's text is inside an inner span,
 * so an event whose target is the description span itself came from the placeholder.
 * The rendered HTML stays exactly as upstream's.
 *
 * Call this for every rendered component span.
 *
 * @param span - the outer span of a rendered task component.
 * @param component - the component in {@link span}.
 * @param task - the rendered task.
 * @param taskLayoutOptions - the layout the task is rendered with: no placeholder if it hides the priority.
 * @param taskSaver - an optional {@link TaskSaver} function, for tests. See {@link TaskEditingMenu}.
 */
export function addPriorityMenuListeners(
    span: HTMLSpanElement,
    component: TaskLayoutComponent,
    task: Task,
    taskLayoutOptions: TaskLayoutOptions,
    taskSaver: TaskSaver = defaultTaskSaver,
) {
    // Without a path, as in a canvas card, an edit can't be saved.
    if (!task.taskLocation.hasKnownPath) {
        return;
    }

    if (component === TaskLayoutComponent.Priority) {
        addListeners(span, task, taskSaver, () => true);
    } else if (
        component === TaskLayoutComponent.Description &&
        task.priority === Priority.None &&
        taskLayoutOptions.isShown(TaskLayoutComponent.Priority)
    ) {
        addListeners(span, task, taskSaver, (ev: MouseEvent) => ev.target === span);
    }
}

function addListeners(
    span: HTMLSpanElement,
    task: Task,
    taskSaver: TaskSaver,
    isForPriorityMenu: (ev: MouseEvent) => boolean,
) {
    const listener = (ev: MouseEvent) => {
        if (isForPriorityMenu(ev)) {
            // t7: nails. Spec: `fork-features/nails.md`.
            showMenu(ev, new PriorityMenuWithNails(task, taskSaver));
        }
    };
    // Note: The more convenient span.onClickEvent() doesn't work here, as it is not available when tests are run.
    span.addEventListener('click', listener);
    span.addEventListener('contextmenu', listener);
}
