import { addHorizonHistoryItems } from '../../HorizonHistory/HorizonHistoryMenuItems';
import type { Task } from '../../Task/Task';
import { allHorizonInstructions } from '../EditInstructions/HorizonInstructions';
import { nailInstructionsAfterSeparator } from '../EditInstructions/NailInstructions';
import { TaskEditingMenu, type TaskSaver, defaultTaskSaver } from './TaskEditingMenu';

/**
 * t7 fork feature: a Menu for setting a Task's horizon. Spec: `fork-features/horizon.md`.
 */
export class HorizonMenu extends TaskEditingMenu {
    /**
     * Constructor, which sets up the menu items.
     * @param task - the Task to be edited.
     * @param taskSaver - an optional {@link TaskSaver} function. For details, see {@link TaskEditingMenu}.
     */
    constructor(task: Task, taskSaver: TaskSaver = defaultTaskSaver) {
        super(taskSaver);

        this.addItemsForInstructions(allHorizonInstructions(), task);
        // t7: horizon history. The task's planned date, lateness and pushes, and Reset lateness.
        addHorizonHistoryItems(this, task);
        // t7: nails. A separator, `Add nail` and `Remove nail`.
        this.addItemsForInstructions(nailInstructionsAfterSeparator(task), task);
    }
}
