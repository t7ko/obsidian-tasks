import { GlobalFilter } from '../Config/GlobalFilter';
import { Status } from '../Statuses/Status';
import { StatusType } from '../Statuses/StatusConfiguration';
import { StatusRegistry } from '../Statuses/StatusRegistry';
import { withoutTrailingHorizon } from './Horizon';
import { MULTI_STEP_MARKER, stepSegments } from './MultiStepTask';
import { leadingNails } from './Nails';
import { Task } from './Task';
import { TaskRegularExpressions } from './TaskRegularExpressions';

/**
 * t7 fork feature: split tasks. Spec: `fork-features/split-tasks.md`.
 *
 * A task whose description has parts separated by `//` (whitespace on both sides, as between the steps of a
 * multi-step task) becomes one task per part:
 *
 *     Renew passport 🪜 ~~fill form~~ // submit 🔭 today   →   [x] Renew passport: fill form 🔭 today
 *                                                             [ ] Renew passport: submit 🔭 today
 *     ⚠️ buy milk // buy eggs                               →   ⚠️ buy milk
 *                                                             ⚠️ buy eggs
 */

const VARIATION_SELECTOR = '️';

export interface SplitPart {
    description: string;
    /** The part was a struck-through (done) step */
    done: boolean;
}

/**
 * The descriptions {@link description} splits into, or null if it has fewer than two parts.
 *
 * - With the multi-step marker, the parts are the steps after it, each prefixed with the title before it and `: `.
 * - Without it, the parts are the segments of the whole description; nails and tags at its start go to the start
 *   of every part.
 * - A valid horizon ending the description goes to every part.
 * - A tag in one part goes to every part: those it lacks get it at their end, before the horizon. A part holding
 *   only tags is not a part of its own.
 */
export function splitDescription(description: string): SplitPart[] | null {
    const trimmed = description.trim();
    const body = withoutTrailingHorizon(trimmed);
    const horizon = trimmed.slice(body.length);

    let prefix: string;
    let partsText: string;
    const markerIndex = body.indexOf(MULTI_STEP_MARKER);
    if (markerIndex !== -1) {
        const title = body.slice(0, markerIndex).trim().replace(/\s*:$/, '');
        if (title === '') {
            prefix = '';
        } else if (leadingNails(title).trim() === title) {
            prefix = title + ' ';
        } else {
            prefix = title + ': ';
        }
        partsText = body.slice(markerIndex + MULTI_STEP_MARKER.length);
        if (partsText.startsWith(VARIATION_SELECTOR)) {
            partsText = partsText.slice(VARIATION_SELECTOR.length);
        }
    } else {
        const nails = leadingNails(body);
        const tags = leadingTags(body.slice(nails.length));
        prefix = (nails + tags).trim();
        prefix = prefix === '' ? '' : prefix + ' ';
        partsText = body.slice(nails.length + tags.length);
    }

    const allSegments = stepSegments(partsText);
    // A part with nothing but tags is not a task of its own; its tags go to the others.
    const segments = allSegments.filter((segment) => !isOnlyTags(segment.text));
    if (segments.length < 2) {
        return null;
    }
    const allTags = allSegments.flatMap((segment) => tagsIn(segment.text));
    const prefixTags = tagsIn(prefix);
    return segments.map((segment) => {
        const ownTags = [...prefixTags, ...tagsIn(segment.text)];
        const otherTags = allTags.filter((tag, index) => !ownTags.includes(tag) && allTags.indexOf(tag) === index);
        const text = [segment.text, ...otherTags].join(' ');
        return { description: prefix + text + horizon, done: segment.done };
    });
}

/**
 * The tags at the start of {@link text}, with the whitespace after them, if more of the first part follows them.
 */
function leadingTags(text: string): string {
    let length = 0;
    let match: RegExpExecArray | null;
    while ((match = /^(\S+)\s+/.exec(text.slice(length))) !== null && tagsIn(match[1])[0] === match[1]) {
        length += match[0].length;
    }
    return /^\/\/(\s|$)/.test(text.slice(length)) ? '' : text.slice(0, length);
}

function isOnlyTags(text: string): boolean {
    return text.replace(TaskRegularExpressions.hashTags, '').trim() === '';
}

function tagsIn(text: string): string[] {
    return (text.match(TaskRegularExpressions.hashTags) ?? []).map((tag) => tag.trim());
}

/**
 * The tasks {@link task} splits into, or null if its description has fewer than two parts.
 *
 * Every new task copies all of {@link task} except its description. Only the first keeps the block link. Only the
 * last task that is not done keeps the id (the last task, if all are done), so tasks depending on {@link task}
 * stay blocked until its last open part is done.
 * A part that was a done step becomes a done task (done date {@link today}, if the settings set done dates), unless
 * {@link task} is already completed. A part lacking the global filter gets it, after any nails.
 */
export function splitTask(task: Task, today = window.moment()): Task[] | null {
    const parts = splitDescription(task.description);
    if (parts === null) {
        return null;
    }

    const newTasks = parts.map((part, index) => {
        const newTask = new Task({
            ...task,
            description: withGlobalFilter(part.description),
            id: '',
            blockLink: index === 0 ? task.blockLink : '',
        });
        if (!part.done || task.status.isCompleted()) {
            return newTask;
        }
        // The last task is the completed one; a new occurrence of a recurring task is not wanted here.
        const completed = newTask.handleNewStatus(doneStatus(), today);
        return completed[completed.length - 1];
    });

    if (task.id === '') {
        return newTasks;
    }
    const openIndexes = newTasks.flatMap((newTask, index) => (newTask.isDone ? [] : [index]));
    const idIndex = openIndexes.length > 0 ? openIndexes[openIndexes.length - 1] : newTasks.length - 1;
    newTasks[idIndex] = new Task({ ...newTasks[idIndex], id: task.id });
    return newTasks;
}

function withGlobalFilter(description: string): string {
    const globalFilter = GlobalFilter.getInstance();
    if (globalFilter.includedIn(description)) {
        return description;
    }
    const nails = leadingNails(description);
    return nails + globalFilter.prependTo(description.slice(nails.length));
}

function doneStatus(): Status {
    return (
        StatusRegistry.getInstance().registeredStatuses.find((status) => status.type === StatusType.DONE) ?? Status.DONE
    );
}
