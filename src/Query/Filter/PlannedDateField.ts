import { HorizonHistory } from '../../HorizonHistory/HorizonHistory';
import type { Task } from '../../Task/Task';
import { DateField } from './DateField';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * Support the 'planned' search instruction: the earliest date a tracked task's horizon pointed to.
 * Tasks that aren't tracked have no planned date.
 */
export class PlannedDateField extends DateField {
    public fieldName(): string {
        return 'planned';
    }

    public date(task: Task): Moment | null {
        return HorizonHistory.getInstance().plannedDate(task);
    }

    protected filterResultIfFieldMissing() {
        return false;
    }
}
