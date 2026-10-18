import { HorizonHistory } from '../../HorizonHistory/HorizonHistory';
import { type LateDays, horizonHistorySettings } from '../../HorizonHistory/HorizonHistorySettings';
import type { Task } from '../../Task/Task';
import { Explanation } from '../Explain/Explanation';
import type { GrouperFunction } from '../Group/Grouper';
import type { Comparator } from '../Sort/Sorter';
import { Field } from './Field';
import { Filter } from './Filter';
import { FilterOrErrorMessage } from './FilterOrErrorMessage';

/**
 * t7 fork feature: horizon history. Spec: `fork-features/horizon-history.md`.
 *
 * Filter by whether a tracked task is late ('is late', 'is not late'), and sort and group by how late it is.
 * Open tasks count as of today, done and cancelled ones as of when they were finished.
 */
export class LatenessField extends Field {
    private static readonly isLateLine = /^is\s+(not\s+)?late$/i;

    public createFilterOrErrorMessage(line: string): FilterOrErrorMessage {
        const match = Field.getMatch(LatenessField.isLateLine, line);
        if (match === null) {
            return FilterOrErrorMessage.fromError(
                line,
                "do not understand lateness filter: use 'is late' or 'is not late'",
            );
        }
        const wanted = match[1] === undefined;
        return FilterOrErrorMessage.fromFilter(
            new Filter(line, (task: Task) => LatenessField.isLate(task) === wanted, new Explanation(line)),
        );
    }

    public fieldName(): string {
        return 'lateness';
    }

    protected filterRegExp(): RegExp {
        return LatenessField.isLateLine;
    }

    private static daysLate(task: Task): number | null {
        return HorizonHistory.getInstance().daysLate(task);
    }

    private static isLate(task: Task): boolean {
        return (LatenessField.daysLate(task) ?? 0) >= 1;
    }

    public supportsSorting(): boolean {
        return true;
    }

    public comparator(): Comparator {
        // The latest first, then tasks on time, then tasks without a planned date.
        return (a: Task, b: Task) => (LatenessField.daysLate(b) ?? -1) - (LatenessField.daysLate(a) ?? -1);
    }

    public supportsGrouping(): boolean {
        return true;
    }

    public grouper(): GrouperFunction {
        const groupName = latenessGroupNamer(horizonHistorySettings().lateDays);
        return (task: Task) => [groupName(LatenessField.daysLate(task))];
    }
}

/**
 * A function giving the group heading for a number of days late (null: no planned date), with the badge levels in
 * {@link lateDays}: `Late 90+ days`, `Late 30–89 days`, `Late 7–29 days`, `Late 1–6 days`, `On time`, `Not planned`.
 * Text inside the %%..%% comments sets the order of the groups; Obsidian hides it in the headings.
 */
export function latenessGroupNamer({ low, medium, high }: LateDays): (days: number | null) => string {
    const range = (first: number, last: number) =>
        first === last ? `Late ${first} day${first === 1 ? '' : 's'}` : `Late ${first}–${last} days`;
    return (days: number | null) => {
        if (days === null) {
            return '%%6%%Not planned';
        }
        if (days >= high) {
            return `%%1%%Late ${high}+ days`;
        }
        if (days >= medium) {
            return `%%2%%${range(medium, high - 1)}`;
        }
        if (days >= low) {
            return `%%3%%${range(low, medium - 1)}`;
        }
        if (days >= 1) {
            return `%%4%%${range(1, low - 1)}`;
        }
        return '%%5%%On time';
    };
}
