/**
 * Fork features: multi-step tasks and nails. Specs: fork-features/multi-step-tasks.md, fork-features/nails.md
 */
import { fireEvent, render } from '@testing-library/svelte';
import moment from 'moment';
import { tick } from 'svelte';
import { taskFromLine } from '../../src/Commands/CreateOrEditTaskParser';
import { getSettings, resetSettings, updateSettings } from '../../src/Config/Settings';
import { StatusRegistry } from '../../src/Statuses/StatusRegistry';
import type { Task } from '../../src/Task/Task';
import EditTask from '../../src/ui/EditTask.svelte';
import { settingsStore } from '../../src/ui/SettingsStore';
import { addActionsSection } from '../../src/ui/TaskModalActions';

window.moment = moment;

afterEach(() => {
    resetSettings();
    settingsStore.set(getSettings());
});

function hidePriority() {
    updateSettings({ isShownInEditModal: { ...getSettings().isShownInEditModal, priority: false } });
}

/**
 * Render the edit form for {@link line} as TaskModal does: the Svelte component, then the Actions section.
 */
function renderModal(line: string) {
    const task = taskFromLine({ line, path: '' });

    let resolveSaved: (lines: string[]) => void;
    const saved = new Promise<string[]>((resolve) => {
        resolveSaved = resolve;
    });
    const onSubmit = (updatedTasks: Task[]) => resolveSaved(updatedTasks.map((t) => t.toFileLineString()));

    const result = render(EditTask, {
        task,
        statusOptions: StatusRegistry.getInstance().registeredStatuses,
        onSubmit,
        allTasks: [task],
    });
    const { container } = result;
    addActionsSection(container);

    const description = container.querySelector('#description') as HTMLTextAreaElement;
    const button = container.querySelector('#steps') as HTMLButtonElement;
    expect(description).not.toBeNull();
    expect(button).not.toBeNull();

    const apply = async () => {
        await fireEvent.click(result.getByText('Apply'));
        return saved;
    };
    return { container, description, button, apply };
}

/** The form's children down to the first dates section, as `tag#id.class` */
function formLayout(container: HTMLElement) {
    const children = Array.from(container.querySelector('form')!.children);
    const end = children.findIndex((child) => child.classList.contains('tasks-modal-dates-section'));
    return children.slice(0, end + 1).map((child) => {
        const id = child.id ? `#${child.id}` : '';
        const cls = child.className ? `.${child.className}` : '';
        return `${child.tagName.toLowerCase()}${id}${cls}`;
    });
}

function withCursor(field: HTMLTextAreaElement) {
    const { value, selectionStart, selectionEnd } = field;
    expect(selectionEnd).toEqual(selectionStart);
    return value.slice(0, selectionStart) + '|' + value.slice(selectionStart);
}

describe('TaskModalActions - placement', () => {
    it('should come between Priority and the dates', () => {
        const { container } = renderModal('- [ ] Renew passport');

        expect(formLayout(container)).toEqual([
            'section.tasks-modal-description-section',
            'section.tasks-modal-priority-section',
            'hr#line-after-priority',
            'section.tasks-modal-actions-section',
            'hr#line-after-actions',
            'section.tasks-modal-dates-section',
        ]);
    });

    it('should come right after the description when Priority is hidden', () => {
        hidePriority();
        const { container } = renderModal('- [ ] Renew passport');

        expect(formLayout(container)).toEqual([
            'section.tasks-modal-description-section',
            'section.tasks-modal-actions-section',
            'hr#line-after-actions',
            'section.tasks-modal-dates-section',
        ]);
    });

    it('should stay after Priority when Priority is shown while the modal is open', async () => {
        hidePriority();
        settingsStore.set(getSettings());
        const { container } = renderModal('- [ ] Renew passport');
        await tick(); // EditTask's onMount has set the store

        // As the modal's options button does
        settingsStore.set({
            ...getSettings(),
            isShownInEditModal: { ...getSettings().isShownInEditModal, priority: true },
        });
        await tick();

        expect(formLayout(container)).toEqual([
            'section.tasks-modal-description-section',
            'section.tasks-modal-priority-section',
            'hr#line-after-priority',
            'section.tasks-modal-actions-section',
            'hr#line-after-actions',
            'section.tasks-modal-dates-section',
        ]);
    });

    it('should do nothing outside the edit form', () => {
        const container = document.createElement('div');
        addActionsSection(container);
        expect(container.innerHTML).toEqual('');
    });
});

describe('TaskModalActions - label and access key', () => {
    it('should be labelled Actions, a label for no button', () => {
        const { container } = renderModal('- [ ] Renew passport');

        const label = container.querySelector('.tasks-modal-actions-section label') as HTMLLabelElement;
        expect(label.innerHTML).toEqual('Actions');
        expect(label.htmlFor).toEqual('');
    });

    it('should give Insert 🪜 the access key P, shown after it, when access keys are on', () => {
        updateSettings({ provideAccessKeys: true });
        const { button } = renderModal('- [ ] Renew passport');

        expect(button.innerHTML).toEqual('Insert 🪜 (<span class="accesskey">p</span>)');
        expect(button.accessKey).toEqual('p');
    });

    it('should have no access key when access keys are off', () => {
        updateSettings({ provideAccessKeys: false });
        const { button } = renderModal('- [ ] Renew passport');

        expect(button.innerHTML).toEqual('Insert 🪜');
        expect(button.hasAttribute('accesskey')).toEqual(false);
    });
});

describe('TaskModalActions - inserting the marker', () => {
    it('should insert the marker at the end of the description, as the modal opens with the cursor there', async () => {
        const { description, button, apply } = renderModal('- [ ] Renew passport 📅 2026-10-30');

        await fireEvent.click(button);

        expect(withCursor(description)).toEqual('Renew passport 🪜 |');
        expect(description.ownerDocument.activeElement).toBe(description);
        expect(await apply()).toEqual(['- [ ] Renew passport 🪜 📅 2026-10-30']);
    });

    it('should insert the marker at the cursor and save the steps typed after it', async () => {
        const { description, button, apply } = renderModal('- [ ] Renew passport');
        description.setSelectionRange(5, 5);

        await fireEvent.click(button);
        expect(withCursor(description)).toEqual('Renew 🪜 | passport');

        await fireEvent.input(description, { target: { value: 'Renew passport 🪜 fill form // submit' } });
        expect(await apply()).toEqual(['- [ ] Renew passport 🪜 fill form // submit']);
    });

    it('should insert the marker before a horizon ending the description (t7 horizon)', async () => {
        const { description, button, apply } = renderModal('- [ ] Renew passport 🔭 this week 📅 2026-10-30');

        await fireEvent.click(button);
        expect(withCursor(description)).toEqual('Renew passport 🪜 | 🔭 this week');

        await fireEvent.input(description, { target: { value: 'Renew passport 🪜 fill form // submit 🔭 this week' } });
        expect(await apply()).toEqual(['- [ ] Renew passport 🪜 fill form // submit 🔭 this week 📅 2026-10-30']);
    });

    it('should grey the button out once the marker is inserted', async () => {
        const { button } = renderModal('- [ ] Renew passport');
        expect(button.disabled).toEqual(false);
        expect(button.title).toContain('then type the steps separated by //');

        await fireEvent.click(button);

        expect(button.disabled).toEqual(true);
        expect(button.title).toEqual('The description already has 🪜');
    });

    it('should grey the button out while the description has the marker', async () => {
        const { description, button } = renderModal('- [ ] Renew passport 🪜 fill form // submit');
        expect(button.disabled).toEqual(true);

        await fireEvent.input(description, { target: { value: 'Renew passport fill form // submit' } });
        expect(button.disabled).toEqual(false);

        await fireEvent.input(description, { target: { value: 'Renew passport 🪜 fill form // submit' } });
        expect(button.disabled).toEqual(true);
    });

    it('should not insert a second marker', async () => {
        const { description, button } = renderModal('- [ ] Renew passport 🪜 fill form');

        await fireEvent.click(button);

        expect(description.value).toEqual('Renew passport 🪜 fill form');
    });
});

describe('TaskModalActions - nails', () => {
    function nailButtons(container: HTMLElement) {
        const add = container.querySelector('#add-nail') as HTMLButtonElement;
        const remove = container.querySelector('#remove-nail') as HTMLButtonElement;
        expect(add).not.toBeNull();
        expect(remove).not.toBeNull();
        return { add, remove };
    }

    it('should come after Insert 🪜', () => {
        const { container } = renderModal('- [ ] Ship it');

        const buttons = Array.from(container.querySelectorAll('.tasks-modal-actions button')).map((b) => b.id);
        expect(buttons).toEqual(['steps', 'add-nail', 'remove-nail']);
    });

    it('should add nails at the start of the description and keep the cursor on the same text', async () => {
        const { container, description, apply } = renderModal('- [ ] Ship it 📅 2026-11-01');
        const { add } = nailButtons(container);
        description.setSelectionRange(5, 5);

        await fireEvent.click(add);
        expect(withCursor(description)).toEqual('⚠️ Ship |it');
        expect(description.ownerDocument.activeElement).toBe(description);

        await fireEvent.click(add);
        expect(withCursor(description)).toEqual('⚠️⚠️ Ship |it');
        expect(await apply()).toEqual(['- [ ] ⚠️⚠️ Ship it 📅 2026-11-01']);
    });

    it('should keep a selection on the same text', async () => {
        const { container, description } = renderModal('- [ ] Ship it');
        description.setSelectionRange(0, 4);

        await fireEvent.click(nailButtons(container).add);

        const { value, selectionStart, selectionEnd } = description;
        expect(value.slice(selectionStart, selectionEnd)).toEqual('Ship');
    });

    it('should remove one nail at a time, then the space after the last', async () => {
        const { container, description, apply } = renderModal('- [ ] ⚠️⚠️ Ship it');
        const { remove } = nailButtons(container);
        description.setSelectionRange(description.value.length, description.value.length);

        await fireEvent.click(remove);
        expect(withCursor(description)).toEqual('⚠️ Ship it|');

        await fireEvent.click(remove);
        expect(withCursor(description)).toEqual('Ship it|');
        expect(await apply()).toEqual(['- [ ] Ship it']);
    });

    it('should move a cursor inside the removed nail to the start', async () => {
        const { container, description } = renderModal('- [ ] ⚠️ Ship it');
        description.setSelectionRange(1, 1);

        await fireEvent.click(nailButtons(container).remove);

        expect(withCursor(description)).toEqual('|Ship it');
    });

    it('should grey Remove nail out while the description has no nails', async () => {
        const { container, description } = renderModal('- [ ] Ship it ⚠️');
        const { add, remove } = nailButtons(container);
        expect(add.disabled).toEqual(false);
        expect(remove.disabled).toEqual(true);
        expect(remove.title).toEqual('The description has no ⚠️ at its start');

        await fireEvent.click(add);
        expect(remove.disabled).toEqual(false);
        expect(remove.title).toEqual('Remove a ⚠️ from the start of the description');

        await fireEvent.input(description, { target: { value: 'Ship it' } });
        expect(remove.disabled).toEqual(true);
    });

    it('should have the access keys W and V when access keys are on', () => {
        updateSettings({ provideAccessKeys: true });
        const { container } = renderModal('- [ ] Ship it');
        const { add, remove } = nailButtons(container);

        expect(add.innerHTML).toEqual('Add nail (<span class="accesskey">w</span>)');
        expect(add.accessKey).toEqual('w');
        expect(remove.innerHTML).toEqual('Remo<span class="accesskey">v</span>e nail');
        expect(remove.accessKey).toEqual('v');
    });

    it('should have no access keys when access keys are off', () => {
        updateSettings({ provideAccessKeys: false });
        const { container } = renderModal('- [ ] Ship it');
        const { add, remove } = nailButtons(container);

        expect(add.innerHTML).toEqual('Add nail');
        expect(add.hasAttribute('accesskey')).toEqual(false);
        expect(remove.innerHTML).toEqual('Remove nail');
        expect(remove.hasAttribute('accesskey')).toEqual(false);
    });
});
