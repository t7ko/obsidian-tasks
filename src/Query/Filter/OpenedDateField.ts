import { HorizonHistory } from '../../HorizonHistory/HorizonHistory';
import type { Task } from '../../Task/Task';
import { DateField } from './DateField';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * Support the 'opened' search instruction: when a task was created. That is its created date if it has one, or else
 * the day the horizon history started tracking it.
 */
export class OpenedDateField extends DateField {
    public fieldName(): string {
        return 'opened';
    }

    public date(task: Task): Moment | null {
        return HorizonHistory.getInstance().openedDate(task);
    }

    protected filterResultIfFieldMissing() {
        return false;
    }
}
