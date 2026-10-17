import type { Task } from '../../Task/Task';
import { type HorizonState, horizonDisplayName, horizonOf, horizonRank, horizons } from '../../Task/Horizon';
import { Explanation } from '../Explain/Explanation';
import type { GrouperFunction } from '../Group/Grouper';
import type { Comparator } from '../Sort/Sorter';
import { Field } from './Field';
import { Filter } from './Filter';
import { FilterOrErrorMessage } from './FilterOrErrorMessage';

/**
 * t7 fork feature: filter, sort and group by a task's horizon. Spec: `fork-features/horizon.md`.
 *
 * Sorting and grouping follow the order of meaning (today, tomorrow, this week ...), not the alphabet.
 */
export class HorizonField extends Field {
    // Every line this field claims, so that a mistyped horizon filter gets this field's error message.
    private static readonly horizonLine = /^(horizon(\s.*)?|(has|no)\s+horizon)$/i;
    private static readonly hasOrNoLine = /^(has|no)\s+horizon$/i;
    private static readonly comparisonLine = /^horizon\s+(is\s+not|is|before|after)\s+(.+)$/i;

    createFilterOrErrorMessage(line: string): FilterOrErrorMessage {
        const hasOrNoMatch = Field.getMatch(HorizonField.hasOrNoLine, line);
        if (hasOrNoMatch !== null) {
            const wanted = hasOrNoMatch[1].toLowerCase() === 'has';
            return this.filter(line, (state) => (state !== 'none') === wanted);
        }

        const comparisonMatch = Field.getMatch(HorizonField.comparisonLine, line);
        if (comparisonMatch !== null) {
            const operator = comparisonMatch[1].toLowerCase().split(/\s+/).join(' ');
            const value = comparisonMatch[2].trim().toLowerCase().split(/\s+/).join(' ');
            const isHorizon = (horizons as readonly string[]).includes(value);

            if (operator === 'is' || operator === 'is not') {
                if (isHorizon || value === 'none' || value === 'invalid') {
                    const wanted = operator === 'is';
                    return this.filter(line, (state) => (state === value) === wanted);
                }
            } else if (isHorizon) {
                const rank = horizonRank(value as HorizonState);
                const isBefore = operator === 'before';
                return this.filter(line, (state) => {
                    if (state === 'none' || state === 'invalid') {
                        return false;
                    }
                    return isBefore ? horizonRank(state) < rank : horizonRank(state) > rank;
                });
            }
        }

        return FilterOrErrorMessage.fromError(
            line,
            `do not understand horizon filter: use 'horizon is', 'horizon is not', 'horizon before' or 'horizon after' with one of ${horizons.join(', ')}, or 'horizon is none', 'horizon is invalid', 'has horizon', 'no horizon'`,
        );
    }

    private filter(line: string, matches: (state: HorizonState) => boolean) {
        return FilterOrErrorMessage.fromFilter(
            new Filter(line, (task: Task) => matches(HorizonField.horizon(task)), new Explanation(line)),
        );
    }

    private static horizon(task: Task): HorizonState {
        return horizonOf(task.description);
    }

    public fieldName(): string {
        return 'horizon';
    }

    protected filterRegExp(): RegExp {
        return HorizonField.horizonLine;
    }

    public supportsSorting(): boolean {
        return true;
    }

    public comparator(): Comparator {
        return (a: Task, b: Task) => {
            return horizonRank(HorizonField.horizon(a)) - horizonRank(HorizonField.horizon(b));
        };
    }

    public supportsGrouping(): boolean {
        return true;
    }

    public grouper(): GrouperFunction {
        return (task: Task) => {
            const state = HorizonField.horizon(task);
            // Text inside the %%..%% comments sets the order of the groups; Obsidian hides it in the headings.
            return [`%%${horizonRank(state)}%%${horizonDisplayName(state)}`];
        };
    }
}
