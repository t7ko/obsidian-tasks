import type { Task } from '../../Task/Task';
import { canCompletePermanently, completePermanently } from '../../Task/CompletePermanently';
import { MenuDividerInstruction } from './MenuDividerInstruction';
import type { TaskEditingInstruction } from './TaskEditingInstruction';

/**
 * t7 fork feature: an instruction for completing a recurring {@link Task} without a next occurrence.
 * Spec: `fork-features/complete-permanently.md`.
 */
export class CompletePermanentlyInstruction implements TaskEditingInstruction {
    public apply(task: Task): Task[] {
        const completed = completePermanently(task);
        // Unchanged: return the input task:
        return completed === null ? [task] : [completed];
    }

    public instructionDisplayName(): string {
        return 'Complete permanently';
    }

    public isCheckedForTask(_task: Task): boolean {
        return false;
    }
}

/**
 * A separator and `Complete permanently`, if {@link task} can be completed permanently; otherwise nothing.
 */
export function completePermanentlyInstructionsAfterSeparator(task: Task): TaskEditingInstruction[] {
    if (!canCompletePermanently(task)) {
        return [];
    }
    return [new MenuDividerInstruction(), new CompletePermanentlyInstruction()];
}
