import { getSettings } from '../Config/Settings';
import { MULTI_STEP_MARKER, stepsMarkerInsertion } from '../Task/MultiStepTask';
import { NAIL_MARKER, addNail, nailCount, removeNail } from '../Task/Nails';

/**
 * Fork features: multi-step tasks and nails. Specs: fork-features/multi-step-tasks.md, fork-features/nails.md
 *
 * An Actions section in the edit modal, between Priority and the dates, with buttons that change the
 * description: `Insert 🪜` inserts {@link MULTI_STEP_MARKER}, `Add nail` and `Remove nail` add and remove a
 * {@link NAIL_MARKER}. TaskModal adds it to the rendered form, so that EditTask.svelte and its approval files
 * stay upstream's.
 */

const STEPS_ENABLED_TITLE = `Insert ${MULTI_STEP_MARKER} into the description at the cursor, then type the steps separated by //`;
const STEPS_DISABLED_TITLE = `The description already has ${MULTI_STEP_MARKER}`;
const ADD_NAIL_TITLE = `Add a ${NAIL_MARKER} at the start of the description: the task was asked for again`;
const REMOVE_NAIL_ENABLED_TITLE = `Remove a ${NAIL_MARKER} from the start of the description`;
const REMOVE_NAIL_DISABLED_TITLE = `The description has no ${NAIL_MARKER} at its start`;

/**
 * Add the Actions section and the line after it just before the first dates section of the edit form
 * in {@link container}. Does nothing if the form has no description field or no dates section.
 */
export function addActionsSection(container: HTMLElement) {
    const description = container.querySelector<HTMLTextAreaElement>('textarea#description');
    const datesSection = container.querySelector<HTMLElement>('.tasks-modal-dates-section');
    if (description === null || datesSection === null) {
        return;
    }

    const { provideAccessKeys } = getSettings();
    const accessKey = (key: string) => (provideAccessKeys ? key : null);

    const section = createEl('section', { cls: 'tasks-modal-actions-section' });
    section.createEl('label').textContent = 'Actions';
    const buttons = section.createDiv({ cls: 'tasks-modal-actions' });

    const stepsButton = addButton(buttons, 'steps', `Insert ${MULTI_STEP_MARKER}`, accessKey('p'), () =>
        insertStepsMarker(description),
    );
    // Greyed out while the description has the marker, as auto-suggest stops offering it then.
    onDescriptionChange(description, (text) => {
        const hasMarker = text.includes(MULTI_STEP_MARKER);
        stepsButton.disabled = hasMarker;
        stepsButton.title = hasMarker ? STEPS_DISABLED_TITLE : STEPS_ENABLED_TITLE;
    });

    // Access key W for warning, the sign's name: "Add nail" has no free letter.
    const addNailButton = addButton(buttons, 'add-nail', 'Add nail', accessKey('w'), () =>
        changeStart(description, addNail),
    );
    addNailButton.title = ADD_NAIL_TITLE;
    const removeNailButton = addButton(buttons, 'remove-nail', 'Remove nail', accessKey('v'), () =>
        changeStart(description, removeNail),
    );
    onDescriptionChange(description, (text) => {
        const hasNails = nailCount(text) > 0;
        removeNailButton.disabled = !hasNails;
        removeNailButton.title = hasNails ? REMOVE_NAIL_ENABLED_TITLE : REMOVE_NAIL_DISABLED_TITLE;
    });

    const line = createEl('hr');
    line.id = 'line-after-actions';
    datesSection.before(section, line);
}

function addButton(
    parent: HTMLElement,
    id: string,
    text: string,
    accessKey: string | null,
    onClick: () => void,
): HTMLButtonElement {
    const button = parent.createEl('button');
    button.type = 'button';
    button.id = id;
    appendWithAccessKey(button, text, accessKey);
    if (accessKey !== null) {
        button.accessKey = accessKey;
    }
    // Like the modal's Apply and Cancel buttons: keep the focus, and so the selection, where they are.
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', onClick);
    return button;
}

/**
 * Append {@link text} to {@link element} with the {@link accessKey} underlined, as upstream's
 * `labelContentWithAccessKey` does for labels: the key's first letter in the text, or else the key in brackets after it.
 */
function appendWithAccessKey(element: HTMLElement, text: string, accessKey: string | null) {
    if (accessKey === null) {
        element.append(text);
        return;
    }
    const index = text.toLowerCase().indexOf(accessKey);
    if (index === -1) {
        element.append(`${text} (`);
        element.createSpan({ cls: 'accesskey' }).textContent = accessKey;
        element.append(')');
    } else {
        element.append(text.slice(0, index));
        element.createSpan({ cls: 'accesskey' }).textContent = text[index];
        element.append(text.slice(index + 1));
    }
}

/**
 * Call {@link update} with the description's text now and after every change to it.
 * The buttons' changes fire an input event too.
 */
function onDescriptionChange(field: HTMLTextAreaElement, update: (text: string) => void) {
    field.addEventListener('input', () => update(field.value));
    update(field.value);
}

/**
 * Insert {@link MULTI_STEP_MARKER} at the description field's cursor, unless it has one already,
 * and leave the cursor after it.
 */
function insertStepsMarker(field: HTMLTextAreaElement) {
    if (field.value.includes(MULTI_STEP_MARKER)) {
        return;
    }

    const { from, to, text, cursor } = stepsMarkerInsertion(field.value, field.selectionStart, field.selectionEnd);
    replaceInField(field, from, to, text);
    field.setSelectionRange(cursor, cursor);
}

/**
 * Apply {@link change}, which adds or removes text at the start only, to the description field, keeping
 * the cursor and the selection on the same text.
 */
function changeStart(field: HTMLTextAreaElement, change: (text: string) => string) {
    const before = field.value;
    const after = change(before);
    if (after === before) {
        return;
    }

    // The text after the changed start is the same in both.
    const unchanged = Math.min(before.length, after.length);
    const to = before.length - unchanged;
    const text = after.slice(0, after.length - unchanged);
    const moved = (position: number) => (position < to ? text.length : position - to + text.length);

    const { selectionStart, selectionEnd } = field;
    replaceInField(field, 0, to, text);
    field.setSelectionRange(moved(selectionStart), moved(selectionEnd));
}

/**
 * Replace the text between {@link from} and {@link to} in {@link field} with {@link text}, leaving the focus in the field.
 */
function replaceInField(field: HTMLTextAreaElement, from: number, to: number, text: string) {
    field.focus();
    field.setSelectionRange(from, to);

    // insertText (or delete, for a deletion) puts the change in the field's undo history, so Ctrl+Z takes it out
    // again, and fires the input event that the modal's binding of the description listens to. It is deprecated
    // (a lint warning), but nothing else keeps the undo history. jsdom has no execCommand.
    const doc = field.ownerDocument;
    const command = text === '' ? 'delete' : 'insertText';
    const changed = typeof doc.execCommand === 'function' && doc.execCommand(command, false, text);
    if (!changed) {
        field.setRangeText(text, from, to);
        field.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
