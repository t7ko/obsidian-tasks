import type { Task } from '../../Task/Task';
import { nailInstructions, nailInstructionsAfterSeparator } from '../EditInstructions/NailInstructions';
import { PriorityMenu } from './PriorityMenu';
import { TaskEditingMenu, type TaskSaver, defaultTaskSaver } from './TaskEditingMenu';

/**
 * t7 fork feature: a Menu for adding or removing a Task's nails. Spec: `fork-features/nails.md`.
 */
export class NailMenu extends TaskEditingMenu {
    /**
     * Constructor, which sets up the menu items.
     * @param task - the Task to be edited.
     * @param taskSaver - an optional {@link TaskSaver} function. For details, see {@link TaskEditingMenu}.
     */
    constructor(task: Task, taskSaver: TaskSaver = defaultTaskSaver) {
        super(taskSaver);

        this.addItemsForInstructions(nailInstructions(task), task);
    }
}

/**
 * t7 fork feature: upstream's {@link PriorityMenu}, ending with a separator and the nail items.
 * Spec: `fork-features/nails.md`.
 */
export class PriorityMenuWithNails extends PriorityMenu {
    constructor(task: Task, taskSaver: TaskSaver = defaultTaskSaver) {
        super(task, taskSaver);

        this.addItemsForInstructions(nailInstructionsAfterSeparator(task), task);
    }
}
