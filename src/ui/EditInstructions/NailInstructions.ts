import { Task } from '../../Task/Task';
import { addNail, nailCount, removeNail } from '../../Task/Nails';
import { MenuDividerInstruction } from './MenuDividerInstruction';
import type { TaskEditingInstruction } from './TaskEditingInstruction';

/**
 * t7 fork feature: an instruction for adding a nail to a {@link Task}. Spec: `fork-features/nails.md`.
 */
export class AddNail implements TaskEditingInstruction {
    public apply(task: Task): Task[] {
        return [new Task({ ...task, description: addNail(task.description) })];
    }

    public instructionDisplayName(): string {
        return 'Add nail';
    }

    public isCheckedForTask(_task: Task): boolean {
        return false;
    }
}

/**
 * t7 fork feature: an instruction for removing one nail from a {@link Task}. Spec: `fork-features/nails.md`.
 */
export class RemoveNail implements TaskEditingInstruction {
    public apply(task: Task): Task[] {
        if (nailCount(task.description) === 0) {
            // Unchanged: return the input task:
            return [task];
        }
        return [new Task({ ...task, description: removeNail(task.description) })];
    }

    public instructionDisplayName(): string {
        return 'Remove nail';
    }

    public isCheckedForTask(_task: Task): boolean {
        return false;
    }
}

/**
 * `Add nail`, and `Remove nail` if {@link task} has a nail.
 */
export function nailInstructions(task: Task): TaskEditingInstruction[] {
    return nailCount(task.description) > 0 ? [new AddNail(), new RemoveNail()] : [new AddNail()];
}

/**
 * A separator, then the {@link nailInstructions}: for the end of other menus on a task.
 */
export function nailInstructionsAfterSeparator(task: Task): TaskEditingInstruction[] {
    return [new MenuDividerInstruction(), ...nailInstructions(task)];
}
