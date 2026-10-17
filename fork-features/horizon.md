# Horizon

A task can say when it is meant to be done, in coarse steps: today, tomorrow, this week, next week, this month, next month. The horizon is separate from priority. Queries can filter, sort and group by it in that order of meaning, and in rendered tasks a click on its 🔭 changes it from a menu.

## User-facing behaviour

The horizon is written in the task's description as 🔭 followed by one of six values:

```text
- [ ] Draft the quarterly report 🔭 this week ⏫ 📅 2026-10-23
- [ ] Call the supplier 🔭 today
- [ ] Plan the offsite #work 🔭 next month
```

| Value | Group heading |
| --- | --- |
| `today` | Today |
| `tomorrow` | Tomorrow |
| `this week` | This week |
| `next week` | Next week |
| `this month` | This month |
| `next month` | Next month |

The values are fixed labels: `🔭 tomorrow` stays "tomorrow" until it is changed, whatever the date.

A 🔭 not followed by one of these values (`🔭 tomorow`, `🔭` at the end) is an invalid horizon. Invalid horizons are grouped and sorted first, so typos stand out.

### Queries

```text
horizon is this week
horizon is not today
horizon before next week
horizon after this week
horizon is none
horizon is invalid
has horizon
no horizon
sort by horizon
sort by horizon reverse
group by horizon
group by horizon reverse
hide horizon
show horizon
```

- `horizon is <value>` and `horizon is not <value>` take the six values, `none` and `invalid`. `is not` matches every other task, including tasks without a horizon.
- `horizon before <value>` and `horizon after <value>` take the six values and compare by meaning: `horizon before next week` matches today, tomorrow and this week. Tasks without a horizon, or with an invalid one, never match them.
- `has horizon` matches every task with a 🔭, valid or not; `no horizon` the rest.
- `sort by horizon` orders tasks by meaning: invalid, today, tomorrow, this week, next week, this month, next month, then tasks without a horizon.
- `group by horizon` makes headings in the same order: Invalid horizon, Today, Tomorrow, This week, Next week, This month, Next month, No horizon. The order comes from hidden `%%n%%` prefixes in the group names, as with `group by priority`. `reverse` reverses it.
- `view columns by horizon` shows one column per horizon; dragging tasks between those columns is not supported.
- `hide horizon` hides horizons in the query's results: the `🔭 <value>` of tasks with a horizon and the faint 🔭 placeholder of tasks without one, so there is nothing to click for the menu. Useful where no task has a horizon and the placeholders are only noise. `show horizon` shows them again, for example after a `hide horizon` in the Global Query. `hide horizons` works too. Reading mode is not affected.

### Menu

In query results (list and columns views) and in Reading mode, a left or right click on a task's `🔭 <value>` opens this menu, with the current value checked:

```text
  Today
  Tomorrow
x This week
  Next week
  This month
  Next month
  ---
  No horizon
```

Choosing a value replaces the task's horizon in place, or adds `🔭 <value>` at the end of the description, after a space. `No horizon` removes the 🔭 and its value. Choosing the current value changes nothing.

A task without a horizon shows a faint grey 🔭 at the end of its line, after all its fields:

```text
☐ Buy milk #home ⏺️ 📅 2026-10-18 🔭
```

It brightens while the pointer is over the task, and a left or right click on it opens the same menu with `No horizon` checked. Like the priority placeholder, it is drawn by the plugin's stylesheet and never written to the note. A chosen horizon is written into the description, so after choosing one the 🔭 moves from the end of the line to just after the description.

### Auto-suggest

In the Tasks emoji format, typing `hor` (or more of `horizon`) offers `🔭 horizon`, which inserts the 🔭 and a space. Right after them, the popup offers the six values, filtered by what has been typed.

`🔭 horizon` is offered only while the line has no 🔭 yet and no Tasks field emoji (📅, ⏫, 🔁 and so on) comes before the cursor, because a horizon typed after the fields would hide them (see Requirements).

### Styling

The rendered `🔭 <value>` is wrapped in `<span class="task-horizon" data-task-horizon="this-week">`, and the task's `li` gets the same `data-task-horizon` attribute. The result lists of a query with `hide horizon` get the class `tasks-layout-hide-horizon`. Its values are `today`, `tomorrow`, `this-week`, `next-week`, `this-month`, `next-month` and `invalid`; tasks without a horizon have no attribute. A CSS snippet can use them, for example:

```css
/* Today's tasks in red */
.task-horizon[data-task-horizon='today'] {
    color: var(--text-error);
}

/* No placeholder */
li.plugin-tasks-list-item:not([data-task-horizon]) > .tasks-list-text::after {
    content: none;
}
```

## Requirements

1. The horizon is the first 🔭 (optionally followed by U+FE0F) in the description. It is valid if the 🔭 is followed by whitespace and one of the six values, which in turn is followed by whitespace or the end of the description. Values are matched case-insensitively, with any amount of whitespace between their two words. Later 🔭s are ordinary text.
2. A valid horizon's token is the 🔭, the whitespace and the value. An invalid horizon's token is the 🔭 alone: text after it is never removed or replaced.
3. Filters, sorting and grouping behave as described above. Sorting and grouping follow the order of meaning, never the alphabet. A filter line starting with `horizon` that is not understood gives an error listing the valid forms.
4. Setting a horizon from the menu:
   - replaces the existing token in place (for an invalid horizon, the 🔭 becomes `🔭 <value>` and the text after it stays);
   - otherwise adds it after the description's text, separated by one space. If the description has multi-step steps (🪜), it goes just before the 🪜, so it does not become part of the last step and is not struck through with it;
   - writes the value in lowercase with single spaces.
5. `No horizon` removes the token and the whitespace before it, keeping one space between the text around it.
6. Menu changes are saved through `replaceTaskWithTasks`, changing only the description.
7. Tasks whose file is unknown (cards on a canvas) get no menu, since edits there can't be saved. Their horizon is still styled.
8. No placeholder on tasks whose status type is DONE, CANCELLED or NON_TASK. A real horizon on such a task still opens the menu.
9. A click or right-click on the rest of the description, its links and tags behaves as upstream. The priority menu's targets keep working.
10. The rendered HTML of a task without 🔭 is exactly upstream's: the placeholder is CSS `::after` content on the task's text span, `span.tasks-list-text`.
11. Live Preview and Source mode don't change.
12. A new occurrence of a recurring task keeps the horizon, as it keeps the rest of the description.
13. `hide horizon` and `show horizon` are query layout options, like upstream's `hide priority`: they work in the Global Query and in presets, and the last one wins. `hide horizon` gives the query's result lists the class `tasks-layout-hide-horizon`, under which CSS hides `span.task-horizon` and the placeholder; each task's rendered HTML stays the same.

Accepted consequences:

- The horizon is part of the description: `description includes week` matches `🔭 this week`, `sort by description` sees it, and the edit modal shows it in the description field.
- 🔭 must come before all Tasks fields (📅, ⏫, 🔁 ...). Typed after them, it is unknown text at the end of the line, and Tasks, desktop and phone alike, then reads every field to its left as description: `Call Bob 📅 2026-10-17 🔭 today` has no due date. The menu and auto-suggest only write it in a safe place.
- On a canvas card the placeholder is still drawn but does nothing.

## Decisions

- **Stored as description text, not as a new Task field.** A Task field (like priority) would touch about 13 upstream source files and 12 test files, several of them changed by upstream dozens of times a year (the serializer, `Task.ts`, the layout options, the renderers and their approval files). The description text needs a few hook lines. Vanilla Tasks on other devices would see description text either way. The cost is the accepted consequences above. Rejected for now: a real field, which would also give `task.horizon` in scripts.
- **Fixed labels, not rolling dates.** The user re-sorts tasks by hand, as they did when using priorities for this. Rejected: storing the period (`🔭 2026-W43`) and working out the label from today's date. That would move tasks along on their own, but it shows codes on devices without the fork, needs a week-start rule and overlaps with scheduled dates.
- **🔭 (telescope)**: a horizon is what you look at in the distance. Tasks uses no such symbol, and neither did the user's notes.
- **Order of meaning through `%%n%%` group names**, the mechanism upstream uses for priority groups, so `group by horizon reverse` and the heading code work unchanged.
- **Invalid horizons first**, as upstream does with invalid dates: a typo shows up at the top instead of hiding the task among tasks without a horizon.
- **The invalid token is the 🔭 alone**, so fixing it from the menu never deletes words that follow it, which may be ordinary description text.
- **`before` / `after` skip tasks without a horizon**, as `due before` skips tasks without a due date.
- **`hide horizon` as a query layout option, hidden with CSS** (added 2026-10-19). Upstream's `hide priority` leaves the field out of the rendered line; the horizon is description text, so the fork wraps it in a span and hides that. The option sits in upstream's `QueryLayoutOptions` so that `show`, the Global Query, presets and `explain` work as for every other option, for three added lines. One option hides both the value and the placeholder: the need was views without horizons, where only the placeholder shows. Rejected: a `TQ_show_horizon` Query File Defaults property, which would change about ten upstream approval and test-data files.
- **The placeholder is at the end of the line.** The description's own `::after` is the priority menu's placeholder. The inner text span can't host one: a click on its `::after` can't be told apart from a click on its text. A real element would change upstream's renderer approval files. So the placeholder is the `::after` of `span.tasks-list-text`, whose children are all component spans: a click whose target is that span itself came from the placeholder.
- **Menu labels without a "Horizon:" prefix**: the menu opens from the 🔭, so the context is clear; `No horizon` is last, after a separator, as the odd one out.
- **Auto-suggest needs `hor`**, not the value words: `today`, `this`, `next`, `week` are common words, and a match makes Enter accept the suggestion instead of starting a new line.
- **English strings only**, like upstream's priority menu; no i18n keys.
- **Vanilla Tasks compatibility: risky but acceptable** (accepted by the user). Devices without the fork show `🔭 this week` as description text and copy it into new occurrences; query blocks using the new instructions show an error there.
- **Code layout for cheap rebases**: new files `src/Task/Horizon.ts`, `src/Query/Filter/HorizonField.ts`, `src/ui/EditInstructions/HorizonInstructions.ts`, `src/ui/Menus/HorizonMenu.ts`, `src/Renderer/HorizonMenuTargets.ts`, `src/Renderer/HorizonMenuTargets.scss`, `src/Suggestor/HorizonSuggestion.ts`. Upstream files get one registration line in `FilterParser.ts`, an import and a call after `taskToHtml` in `TaskLineRenderer.renderTaskLine`, an import and a call in `Suggestor.ts`, one `@import` in `styles.scss`, a property and a key in `QueryLayoutOptions.ts` and a line in `QueryLayout.ts` for `hide horizon`, and lines in the tests that list every field or show/hide option (`tests/Query/Query.test.ts`, `tests/Layout/QueryLayoutOptions.test.ts`, `tests/Layout/TaskLayout.test.ts`).
