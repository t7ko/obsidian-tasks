import type { Task } from '../../Task/Task';
import { type AllTaskDateFields, isAHappensDate } from '../../DateTime/DateFieldTypes';
import { allHappensDateInstructions, allLifeCycleDateInstructions } from '../EditInstructions/DateInstructions';
import { TaskEditingMenu, type TaskSaver, defaultTaskSaver } from './TaskEditingMenu';

export const PICK_A_DATE_TITLE = 'Pick a date...';

/**
 * t7 fork feature: the menu a right-click on a date opens in the editor. Spec: `fork-features/editor-date-menu.md`.
 *
 * `Pick a date...` (opens the calendar of a left click in query results), a separator, then the items of
 * {@link DateMenu}, the right-click menu of dates in query results.
 */
export class EditorDateMenu extends TaskEditingMenu {
    /**
     * Constructor, which sets up the menu items.
     * @param field - the Date field to edit
     * @param task - the Task to be edited.
     * @param pickDate - called by `Pick a date...`.
     * @param taskSaver - an optional {@link TaskSaver} function. For details, see {@link TaskEditingMenu}.
     */
    constructor(field: AllTaskDateFields, task: Task, pickDate: () => void, taskSaver: TaskSaver = defaultTaskSaver) {
        super(taskSaver);

        this.addItem((item) => item.setTitle(PICK_A_DATE_TITLE).onClick(pickDate));
        this.addSeparator();

        // The same instructions as DateMenu.
        const instructions = isAHappensDate(field)
            ? allHappensDateInstructions(field, task)
            : allLifeCycleDateInstructions(field, task);
        this.addItemsForInstructions(instructions, task);
    }
}
