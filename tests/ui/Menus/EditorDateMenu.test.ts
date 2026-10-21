import moment from 'moment';
import { TaskLayoutComponent } from '../../../src/Layout/TaskLayoutOptions';
import { EditorDateMenu, PICK_A_DATE_TITLE } from '../../../src/ui/Menus/EditorDateMenu';
import type { MenuItem } from '../../__mocks__/obsidian';
import { TaskBuilder } from '../../TestingTools/TaskBuilder';
import { TestableTaskSaver, menuToString } from './MenuTestingHelpers';

window.moment = moment;

const today = '2023-12-03';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(today));
    TestableTaskSaver.reset();
});

afterEach(() => {
    vi.useRealTimers();
});

function itemTitled(menu: EditorDateMenu, title: string): MenuItem {
    // @ts-expect-error TS2339: Property 'items' does not exist on type 'EditorDateMenu'.
    const items: MenuItem[] = menu.items;
    const item = items.find((menuItem) => menuItem.title === title);
    expect(item).toBeDefined();
    return item!;
}

describe('EditorDateMenu', () => {
    it('should start with Pick a date, then have the items of DateMenu for a start date', () => {
        const task = new TaskBuilder().startDate('2023-12-05').build();

        const menu = new EditorDateMenu(TaskLayoutComponent.StartDate, task, () => {});

        expect(menuToString(menu)).toMatchInlineSnapshot(`
          "
            Pick a date...
            ---
            Start today, on Sun 3rd Dec
            Start tomorrow, on Mon 4th Dec
            ---
            Postpone start date by 2 days, to Thu 7th Dec
            Postpone start date by 3 days, to Fri 8th Dec
            Postpone start date by 4 days, to Sat 9th Dec
            Postpone start date by 5 days, to Sun 10th Dec
            Postpone start date by 6 days, to Mon 11th Dec
            ---
            Postpone start date by a week, to Tue 12th Dec
            Postpone start date by 2 weeks, to Tue 19th Dec
            Postpone start date by 3 weeks, to Tue 26th Dec
            Postpone start date by a month, to Fri 5th Jan
            ---
            Remove start date"
        `);
    });

    it('should offer past dates for a done date, as DateMenu does', () => {
        const task = new TaskBuilder().doneDate(today).build();

        const menu = new EditorDateMenu(TaskLayoutComponent.DoneDate, task, () => {});

        expect(menuToString(menu)).toMatchInlineSnapshot(`
            "
              Pick a date...
              ---
            x Done today, on Sun 3rd Dec
              Done yesterday, on Sat 2nd Dec
              ---
              Done 2 days ago, on Fri 1st Dec
              Done 3 days ago, on Thu 30th Nov
              Done 4 days ago, on Wed 29th Nov
              Done 5 days ago, on Tue 28th Nov
              Done 6 days ago, on Mon 27th Nov
              ---
              Done 1 week ago, on Sun 26th Nov
              Done 2 weeks ago, on Sun 19th Nov
              Done 3 weeks ago, on Sun 12th Nov
              Done 1 month ago, on Fri 3rd Nov
              ---
              Remove done date"
        `);
    });

    it('should call pickDate for Pick a date, and save nothing', () => {
        const task = new TaskBuilder().dueDate(today).build();
        const pickDate = vi.fn();
        const menu = new EditorDateMenu(
            TaskLayoutComponent.DueDate,
            task,
            pickDate,
            TestableTaskSaver.testableTaskSaver,
        );

        itemTitled(menu, PICK_A_DATE_TITLE).callback(new MouseEvent('click'));

        expect(pickDate).toHaveBeenCalledTimes(1);
        expect(TestableTaskSaver.tasksBeingSaved).toBeUndefined();
    });

    it('should save the date chosen with its task saver', async () => {
        const task = new TaskBuilder().dueDate(today).build();
        const menu = new EditorDateMenu(
            TaskLayoutComponent.DueDate,
            task,
            () => {},
            TestableTaskSaver.testableTaskSaver,
        );

        await itemTitled(menu, 'Due tomorrow, on Mon 4th Dec').callback(new MouseEvent('click'));

        expect(TestableTaskSaver.taskBeingOverwritten).toBe(task);
        expect(TestableTaskSaver.tasksBeingSaved?.map((saved) => saved.dueDate?.format('YYYY-MM-DD'))).toEqual([
            '2023-12-04',
        ]);
    });
});
