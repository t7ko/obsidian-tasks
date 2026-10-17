import { Task } from '../../Task/Task';
import { type Horizon, horizonDisplayName, horizonOf, horizons, setHorizon } from '../../Task/Horizon';
import { MenuDividerInstruction } from './MenuDividerInstruction';
import type { TaskEditingInstruction } from './TaskEditingInstruction';

/**
 * t7 fork feature: an instruction for setting or removing a {@link Task}'s horizon.
 * Spec: `fork-features/horizon.md`.
 */
export class SetHorizon implements TaskEditingInstruction {
    readonly newHorizon: Horizon | null;

    /**
     * @param horizon - the horizon to set, or null to remove it.
     */
    constructor(horizon: Horizon | null) {
        this.newHorizon = horizon;
    }

    public apply(task: Task): Task[] {
        if (this.isCheckedForTask(task)) {
            // Unchanged: return the input task:
            return [task];
        }
        return [
            new Task({
                ...task,
                description: setHorizon(task.description, this.newHorizon),
            }),
        ];
    }

    public instructionDisplayName(): string {
        return horizonDisplayName(this.newHorizon ?? 'none');
    }

    public isCheckedForTask(task: Task): boolean {
        return horizonOf(task.description) === (this.newHorizon ?? 'none');
    }
}

/**
 * The horizons in their order of meaning, then a separator and `No horizon`.
 */
export function allHorizonInstructions(): TaskEditingInstruction[] {
    return [...horizons.map((horizon) => new SetHorizon(horizon)), new MenuDividerInstruction(), new SetHorizon(null)];
}
