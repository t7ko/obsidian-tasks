import { horizonPlaceholderShown } from '../HorizonHistory/HorizonPlaceholderSetting';
import { addLatenessBadge } from '../HorizonHistory/LatenessBadge';
import { findHorizonToken, horizonAttributeValue, horizonOf } from '../Task/Horizon';
import type { Task } from '../Task/Task';
import { HorizonMenu } from '../ui/Menus/HorizonMenu';
import { type TaskSaver, defaultTaskSaver, showMenu } from '../ui/Menus/TaskEditingMenu';

/**
 * t7 fork feature: click or right-click a rendered task's horizon to change it with a {@link HorizonMenu}.
 * Spec: `fork-features/horizon.md`.
 *
 * The horizon is description text. After the description is rendered, its `🔭 <value>` is wrapped in a
 * `span.task-horizon` that opens the menu, and the task's `li` gets a `data-task-horizon` attribute.
 *
 * A task without a horizon gets a placeholder instead: the `::after` content of the task's text span,
 * drawn by `HorizonMenuTargets.scss`. That span holds only component spans, and events on a pseudo-element
 * are dispatched to the element that owns it, so an event whose target is the text span itself came from
 * the placeholder. The rendered HTML of a task without a horizon stays exactly as upstream's. If the settings turn the
 * placeholder off (horizon history), the task's `li` gets the class `task-horizon-placeholder-off` instead.
 *
 * Call this once per task, after its components have been rendered into {@link textSpan}.
 *
 * @param li - the task's list item.
 * @param textSpan - the task's `span.tasks-list-text`, holding its rendered components.
 * @param task - the rendered task.
 * @param taskSaver - an optional {@link TaskSaver} function, for tests. See {@link TaskEditingMenu}.
 */
export function addHorizonMenuTargets(
    li: HTMLElement,
    textSpan: HTMLSpanElement,
    task: Task,
    taskSaver: TaskSaver = defaultTaskSaver,
) {
    const state = horizonOf(task.description);
    const attributeValue = horizonAttributeValue(state);
    // Without a path, as in a canvas card, an edit can't be saved.
    const canSave = task.taskLocation.hasKnownPath;

    if (attributeValue === null) {
        // t7: horizon history. The settings can turn the placeholder off.
        if (!horizonPlaceholderShown()) {
            li.classList.add('task-horizon-placeholder-off');
            return;
        }
        if (canSave) {
            addListeners(textSpan, task, taskSaver, (ev: MouseEvent) => ev.target === textSpan);
        }
        return;
    }

    li.setAttribute('data-task-horizon', attributeValue);
    const descriptionText = textSpan.querySelector(':scope > .task-description > span');
    const horizonSpan = descriptionText ? wrapHorizonToken(descriptionText) : null;
    if (horizonSpan === null) {
        return;
    }
    horizonSpan.classList.add('task-horizon');
    horizonSpan.setAttribute('data-task-horizon', attributeValue);
    if (canSave) {
        addListeners(horizonSpan, task, taskSaver, () => true);
    }

    // t7: horizon history. A late task's badge, which opens the same menu. Spec: `fork-features/horizon-history.md`.
    const badge = addLatenessBadge(li, horizonSpan, task);
    if (badge !== null && canSave) {
        addListeners(badge, task, taskSaver, () => true);
    }
}

/**
 * Wrap the first horizon token in the rendered text of {@link container} in a new span, and return it.
 * Returns null if no text node holds a horizon marker.
 */
function wrapHorizonToken(container: Element): HTMLSpanElement | null {
    const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = node as Text;
        const token = findHorizonToken(text.data);
        if (token === null) {
            continue;
        }
        const tokenText = text.splitText(token.start);
        tokenText.splitText(token.end - token.start);
        const parent = tokenText.parentElement!;
        const span = parent.createSpan();
        parent.insertBefore(span, tokenText);
        span.appendChild(tokenText);
        return span;
    }
    return null;
}

function addListeners(
    element: HTMLElement,
    task: Task,
    taskSaver: TaskSaver,
    isForHorizonMenu: (ev: MouseEvent) => boolean,
) {
    const listener = (ev: MouseEvent) => {
        if (isForHorizonMenu(ev)) {
            showMenu(ev, new HorizonMenu(task, taskSaver));
        }
    };
    // Note: The more convenient element.onClickEvent() doesn't work here, as it is not available when tests are run.
    element.addEventListener('click', listener);
    element.addEventListener('contextmenu', listener);
}
