import { getSettings } from '../Config/Settings';
import { MULTI_STEP_MARKER, stepsMarkerInsertion } from '../Task/MultiStepTask';

/**
 * Fork feature: multi-step tasks. Spec: fork-features/multi-step-tasks.md
 *
 * A Steps section in the edit modal, between Priority and the dates, whose button inserts
 * {@link MULTI_STEP_MARKER} into the description. TaskModal adds it to the rendered form, so that
 * EditTask.svelte and its approval files stay upstream's.
 */

const ACCESS_KEY = 'p';
const ENABLED_TITLE = `Insert ${MULTI_STEP_MARKER} into the description at the cursor, then type the steps separated by //`;
const DISABLED_TITLE = `The description already has ${MULTI_STEP_MARKER}`;

/**
 * Add the Steps section and the line after it just before the first dates section of the edit form
 * in {@link container}. Does nothing if the form has no description field or no dates section.
 */
export function addStepsMarkerSection(container: HTMLElement) {
    const description = container.querySelector<HTMLTextAreaElement>('textarea#description');
    const datesSection = container.querySelector<HTMLElement>('.tasks-modal-dates-section');
    if (description === null || datesSection === null) {
        return;
    }

    const { provideAccessKeys } = getSettings();

    const section = createEl('section', { cls: 'tasks-modal-steps-section' });

    const label = section.createEl('label');
    label.htmlFor = 'steps';
    if (provideAccessKeys) {
        label.append('Ste');
        label.createSpan({ cls: 'accesskey' }).textContent = ACCESS_KEY;
        label.append('s');
    } else {
        label.textContent = 'Steps';
    }

    const button = section.createEl('button');
    button.type = 'button';
    button.id = 'steps';
    button.textContent = `Insert ${MULTI_STEP_MARKER}`;
    if (provideAccessKeys) {
        button.accessKey = ACCESS_KEY;
    }
    // Like the modal's Apply and Cancel buttons: keep the focus, and so the selection, where they are.
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => insertStepsMarker(description));

    // Greyed out while the description has the marker, as auto-suggest stops offering it then.
    // Inserting the marker fires an input event too.
    const updateButton = () => {
        const hasMarker = description.value.includes(MULTI_STEP_MARKER);
        button.disabled = hasMarker;
        button.title = hasMarker ? DISABLED_TITLE : ENABLED_TITLE;
    };
    description.addEventListener('input', updateButton);
    updateButton();

    const line = createEl('hr');
    line.id = 'line-after-steps';
    datesSection.before(section, line);
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
    field.focus();
    field.setSelectionRange(from, to);

    // insertText puts the insertion in the field's undo history, so Ctrl+Z takes it out again, and fires the
    // input event that the modal's binding of the description listens to. It is deprecated (a lint warning),
    // but nothing else keeps the undo history. jsdom has no execCommand.
    const doc = field.ownerDocument;
    const inserted = typeof doc.execCommand === 'function' && doc.execCommand('insertText', false, text);
    if (!inserted) {
        field.setRangeText(text, from, to);
        field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    field.setSelectionRange(cursor, cursor);
}
