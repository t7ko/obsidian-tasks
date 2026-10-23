/**
 * Fork feature: multi-step tasks. Spec: fork-features/multi-step-tasks.md
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
import { addStepsMarkerSection } from '../../src/ui/StepsMarkerSection';

window.moment = moment;

afterEach(() => {
    resetSettings();
    settingsStore.set(getSettings());
});

function hidePriority() {
    updateSettings({ isShownInEditModal: { ...getSettings().isShownInEditModal, priority: false } });
}

/**
 * Render the edit form for {@link line} as TaskModal does: the Svelte component, then the Steps section.
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
    addStepsMarkerSection(container);

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

describe('StepsMarkerSection - placement', () => {
    it('should come between Priority and the dates', () => {
        const { container } = renderModal('- [ ] Renew passport');

        expect(formLayout(container)).toEqual([
            'section.tasks-modal-description-section',
            'section.tasks-modal-priority-section',
            'hr#line-after-priority',
            'section.tasks-modal-steps-section',
            'hr#line-after-steps',
            'section.tasks-modal-dates-section',
        ]);
    });

    it('should come right after the description when Priority is hidden', () => {
        hidePriority();
        const { container } = renderModal('- [ ] Renew passport');

        expect(formLayout(container)).toEqual([
            'section.tasks-modal-description-section',
            'section.tasks-modal-steps-section',
            'hr#line-after-steps',
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
            'section.tasks-modal-steps-section',
            'hr#line-after-steps',
            'section.tasks-modal-dates-section',
        ]);
    });

    it('should do nothing outside the edit form', () => {
        const container = document.createElement('div');
        addStepsMarkerSection(container);
        expect(container.innerHTML).toEqual('');
    });
});

describe('StepsMarkerSection - label and access key', () => {
    it('should underline the access key P when access keys are on', () => {
        updateSettings({ provideAccessKeys: true });
        const { container, button } = renderModal('- [ ] Renew passport');

        const label = container.querySelector('.tasks-modal-steps-section label') as HTMLLabelElement;
        expect(label.innerHTML).toEqual('Ste<span class="accesskey">p</span>s');
        expect(label.htmlFor).toEqual('steps');
        expect(button.accessKey).toEqual('p');
        expect(button.textContent).toEqual('Insert 🪜');
    });

    it('should have no access key when access keys are off', () => {
        updateSettings({ provideAccessKeys: false });
        const { container, button } = renderModal('- [ ] Renew passport');

        const label = container.querySelector('.tasks-modal-steps-section label') as HTMLLabelElement;
        expect(label.innerHTML).toEqual('Steps');
        expect(button.hasAttribute('accesskey')).toEqual(false);
    });
});

describe('StepsMarkerSection - inserting the marker', () => {
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
