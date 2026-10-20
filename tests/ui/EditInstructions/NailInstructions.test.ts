import moment from 'moment';
import { Priority } from '../../../src/Task/Priority';
import {
    AddNail,
    RemoveNail,
    nailInstructions,
    nailInstructionsAfterSeparator,
} from '../../../src/ui/EditInstructions/NailInstructions';
import { NailMenu, PriorityMenuWithNails } from '../../../src/ui/Menus/NailMenu';
import { fromLine } from '../../TestingTools/TestHelpers';
import { TestableTaskSaver, menuToString } from '../Menus/MenuTestingHelpers';

window.moment = moment;

describe('AddNail', () => {
    it('should add a nail, changing only the description', () => {
        const task = fromLine({ line: '- [ ] Call Bob 🔼 📅 2026-10-20' });

        const newTasks = new AddNail().apply(task);

        expect(newTasks.length).toEqual(1);
        expect(newTasks[0].toFileLineString()).toEqual('- [ ] ⚠️ Call Bob 🔼 📅 2026-10-20');
        expect(newTasks[0].priority).toEqual(Priority.Medium);
    });

    it('should add a nail to the others', () => {
        const task = fromLine({ line: '- [ ] ⚠️ Call Bob' });

        expect(new AddNail().apply(task)[0].toFileLineString()).toEqual('- [ ] ⚠️⚠️ Call Bob');
    });

    it('should never be checked', () => {
        expect(new AddNail().isCheckedForTask(fromLine({ line: '- [ ] ⚠️ Call Bob' }))).toEqual(false);
        expect(new AddNail().instructionDisplayName()).toEqual('Add nail');
    });
});

describe('RemoveNail', () => {
    it('should remove one nail', () => {
        const task = fromLine({ line: '- [ ] ⚠️⚠️ Call Bob 📅 2026-10-20' });

        expect(new RemoveNail().apply(task)[0].toFileLineString()).toEqual('- [ ] ⚠️ Call Bob 📅 2026-10-20');
    });

    it('should return the same task if it has no nails', () => {
        const task = fromLine({ line: '- [ ] Call Bob' });

        expect(Object.is(new RemoveNail().apply(task)[0], task)).toEqual(true);
    });

    it('should never be checked', () => {
        expect(new RemoveNail().isCheckedForTask(fromLine({ line: '- [ ] ⚠️ Call Bob' }))).toEqual(false);
        expect(new RemoveNail().instructionDisplayName()).toEqual('Remove nail');
    });
});

describe('nail instructions', () => {
    const names = (instructions: { instructionDisplayName(): string }[]) =>
        instructions.map((instruction) => instruction.instructionDisplayName());

    it('should offer Remove nail only for a task with nails', () => {
        expect(names(nailInstructions(fromLine({ line: '- [ ] Call Bob' })))).toEqual(['Add nail']);
        expect(names(nailInstructions(fromLine({ line: '- [ ] ⚠️ Call Bob' })))).toEqual(['Add nail', 'Remove nail']);
    });

    it('should start with a separator for the end of other menus', () => {
        expect(names(nailInstructionsAfterSeparator(fromLine({ line: '- [ ] ⚠️ Call Bob' })))).toEqual([
            '---',
            'Add nail',
            'Remove nail',
        ]);
    });
});

describe('nail menus', () => {
    beforeEach(() => {
        TestableTaskSaver.reset();
    });

    it('should list the nail items', () => {
        const menu = new NailMenu(fromLine({ line: '- [ ] ⚠️ Call Bob' }), TestableTaskSaver.testableTaskSaver);

        expect(menuToString(menu)).toMatchInlineSnapshot(`
            "
              Add nail
              Remove nail"
        `);
    });

    it('should end the priority menu with the nail items', () => {
        const task = fromLine({ line: '- [ ] Call Bob ⏫' });

        expect(menuToString(new PriorityMenuWithNails(task))).toMatchInlineSnapshot(`
            "
              Priority: Highest
            x Priority: High
              Priority: Medium
              Priority: Normal
              Priority: Low
              Priority: Lowest
              ---
              Add nail"
        `);
    });

    it('should save the task with a nail when Add nail is chosen', async () => {
        const task = fromLine({ line: '- [ ] Call Bob #work' });
        const menu = new NailMenu(task, TestableTaskSaver.testableTaskSaver);

        // @ts-expect-error TS2339: Property 'items' does not exist on type 'NailMenu'.
        await menu.items[0].callback();

        expect(Object.is(TestableTaskSaver.taskBeingOverwritten, task)).toEqual(true);
        expect(TestableTaskSaver.tasksBeingSaved!.map((saved) => saved.toFileLineString())).toEqual([
            '- [ ] ⚠️ Call Bob #work',
        ]);
    });
});
