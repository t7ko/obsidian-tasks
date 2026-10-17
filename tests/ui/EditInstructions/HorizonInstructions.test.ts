import moment from 'moment';
import { Priority } from '../../../src/Task/Priority';
import { SetHorizon, allHorizonInstructions } from '../../../src/ui/EditInstructions/HorizonInstructions';
import { fromLine } from '../../TestingTools/TestHelpers';

window.moment = moment;

describe('SetHorizon', () => {
    it('should set a horizon, changing only the description', () => {
        const task = fromLine({ line: '- [ ] Buy milk 🔭 today 🔼 📅 2026-10-20' });

        const newTasks = new SetHorizon('this month').apply(task);

        expect(newTasks.length).toEqual(1);
        expect(newTasks[0].toFileLineString()).toEqual('- [ ] Buy milk 🔭 this month 🔼 📅 2026-10-20');
        expect(newTasks[0].priority).toEqual(Priority.Medium);
    });

    it('should remove a horizon', () => {
        const task = fromLine({ line: '- [ ] Buy milk 🔭 today 📅 2026-10-20' });

        const newTasks = new SetHorizon(null).apply(task);

        expect(newTasks[0].toFileLineString()).toEqual('- [ ] Buy milk 📅 2026-10-20');
    });

    it('should return the same task if the horizon is unchanged', () => {
        const task = fromLine({ line: '- [ ] Buy milk 🔭 today' });

        const newTasks = new SetHorizon('today').apply(task);

        expect(Object.is(newTasks[0], task)).toEqual(true);
    });

    it('should check "No horizon" only for tasks without a horizon', () => {
        const noHorizon = new SetHorizon(null);
        expect(noHorizon.isCheckedForTask(fromLine({ line: '- [ ] Buy milk' }))).toEqual(true);
        expect(noHorizon.isCheckedForTask(fromLine({ line: '- [ ] Buy milk 🔭 tomorow' }))).toEqual(false);
    });

    it('should list the horizons in order of meaning, then No horizon', () => {
        const names = allHorizonInstructions().map((instruction) => instruction.instructionDisplayName());
        expect(names).toEqual([
            'Today',
            'Tomorrow',
            'This week',
            'Next week',
            'This month',
            'Next month',
            '---',
            'No horizon',
        ]);
    });
});
