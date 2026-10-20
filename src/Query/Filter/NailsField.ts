import type { Task } from '../../Task/Task';
import { nailCount } from '../../Task/Nails';
import { Explanation } from '../Explain/Explanation';
import type { GrouperFunction } from '../Group/Grouper';
import type { Comparator } from '../Sort/Sorter';
import { Field } from './Field';
import { Filter } from './Filter';
import { FilterOrErrorMessage } from './FilterOrErrorMessage';

/**
 * t7 fork feature: filter, sort and group by the number of a task's nails. Spec: `fork-features/nails.md`.
 *
 * Like priority, the most nails come first when sorting and grouping.
 */
export class NailsField extends Field {
    // Every line this field claims, so that a mistyped nails filter gets this field's error message.
    private static readonly nailsLine = /^(nails(\s.*)?|(has|no)\s+nails)$/i;
    private static readonly hasOrNoLine = /^(has|no)\s+nails$/i;
    // The same forms as upstream's priority filter: 'nails is 2', 'nails above 1', 'nails is not 0' ...
    private static readonly comparisonLine = /^nails(\s+is)?(\s+(above|below|not))?\s+(\d+)$/i;

    // Group names start with %%<rank>%%, which sets their order: the most nails first.
    private static readonly maxRankedNails = 999;

    createFilterOrErrorMessage(line: string): FilterOrErrorMessage {
        const hasOrNoMatch = Field.getMatch(NailsField.hasOrNoLine, line);
        if (hasOrNoMatch !== null) {
            const wanted = hasOrNoMatch[1].toLowerCase() === 'has';
            return this.filter(line, (nails) => (wanted ? nails > 0 : nails === 0));
        }

        const comparisonMatch = Field.getMatch(NailsField.comparisonLine, line);
        if (comparisonMatch !== null) {
            const operator = comparisonMatch[3]?.toLowerCase();
            const wanted = Number(comparisonMatch[4]);
            switch (operator) {
                case 'above':
                    return this.filter(line, (nails) => nails > wanted);
                case 'below':
                    return this.filter(line, (nails) => nails < wanted);
                case 'not':
                    return this.filter(line, (nails) => nails !== wanted);
                default:
                    return this.filter(line, (nails) => nails === wanted);
            }
        }

        return FilterOrErrorMessage.fromError(
            line,
            "do not understand nails filter: use 'has nails', 'no nails', or 'nails is', 'nails is above', 'nails is below' or 'nails is not' followed by a number",
        );
    }

    private filter(line: string, matches: (nails: number) => boolean) {
        return FilterOrErrorMessage.fromFilter(
            new Filter(line, (task: Task) => matches(NailsField.nails(task)), new Explanation(line)),
        );
    }

    private static nails(task: Task): number {
        return nailCount(task.description);
    }

    public fieldName(): string {
        return 'nails';
    }

    protected filterRegExp(): RegExp {
        return NailsField.nailsLine;
    }

    public supportsSorting(): boolean {
        return true;
    }

    public comparator(): Comparator {
        return (a: Task, b: Task) => NailsField.nails(b) - NailsField.nails(a);
    }

    public supportsGrouping(): boolean {
        return true;
    }

    public grouper(): GrouperFunction {
        return (task: Task) => {
            const nails = NailsField.nails(task);
            const rank = NailsField.maxRankedNails - Math.min(nails, NailsField.maxRankedNails);
            // Text inside the %%..%% comments sets the order of the groups; Obsidian hides it in the headings.
            return [`%%${rank}%%${nailsGroupName(nails)}`];
        };
    }
}

function nailsGroupName(nails: number): string {
    if (nails === 0) {
        return 'No nails';
    }
    return nails === 1 ? '1 nail' : `${nails} nails`;
}
