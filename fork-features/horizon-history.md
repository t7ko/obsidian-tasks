# Horizon history

The plugin keeps a daily history of the tasks that have a [horizon](horizon.md), or optionally of every open task. From it, a task with a horizon gets a planned date: the earliest date its horizon ever pointed to. A task still open after its planned date is late. Rendered tasks show by how much, and queries can filter, sort and group by it, for example in a weekly review. For every tracked task, the history also knows since when it exists.

## User-facing behaviour

### The history

While Obsidian runs, the plugin follows the tasks and records them in the vault, one JSON file per day with changes, in the folder `.tasks-history`:

```text
.tasks-history/2026-10-12.json
.tasks-history/2026-10-14.json
.tasks-history/2026-10-17.json
```

A file is either `full` or `changes`:

- A full file holds every open tracked task as it was at the end of that day, plus the tasks done, cancelled or dropped that day. One is written at most once a week: on the first day with changes at least 7 days after the previous full file.
- A changes file holds only the tasks that changed that day: started, edited, re-planned, pushed, done, cancelled or dropped. A task that only moved to another line has not changed.

Today's file is rewritten as tasks change; earlier files are never changed again. A day without changes gets no file. Nothing is written into notes.

The folder name starts with a dot, so Obsidian doesn't show or index it, and Obsidian Sync doesn't sync it. Deleting the folder deletes the history.

A day's file looks like this, one task per line:

```json
{
  "version": 2,
  "date": "2026-10-17",
  "kind": "changes",
  "tasks": [
    {"id":"m2r8c0ab","path":"Home.md","line":2,"text":"- [ ] Buy milk","horizon":"none","status":"open","pushes":0,"since":"2026-10-17"},
    {"id":"k3x9q2ab","path":"Home.md","line":4,"text":"- [x] Fix the shelf 🔭 this week ✅ 2026-10-17","horizon":"this week","status":"done","closed":"2026-10-17","planned":"2026-10-18","pushes":0,"since":"2026-10-14"},
    {"id":"p0w7m1cd","path":"Work.md","line":12,"text":"- [ ] Call the supplier 🔭 today 📅 2026-10-20","horizon":"today","status":"open","planned":"2026-10-12","pushes":3,"since":"2026-10-02"}
  ]
}
```

### Which tasks are tracked

The setting **Tasks to track** (see [Settings](#settings)) chooses:

- **Tasks with a horizon** (the default): a task is tracked from when it is first seen open with a valid horizon. Removing its horizon drops it.
- **All open tasks**: every open task is tracked from when it is first seen, with or without a horizon. A task without a horizon has no planned date and is never late: the history only records since when it exists. Removing a task's horizon ends its plan: the planned date and pushes are cleared, and tracking goes on.

Switching from all open tasks back to tasks with a horizon drops the tracked tasks that have no horizon.

Either way, only open tasks that match Tasks' **global query** are tracked (its filters; its layout and sort instructions don't matter). A tracked task that stops matching, for example because it gets a tag the global query excludes, is dropped. Done and cancelled tasks don't have to match, so that completing a tracked task is recorded even if the global query hides done tasks. If the global query is invalid, it is ignored, as Tasks' quick search does.

Edits made where this plugin doesn't run, such as on a phone with the regular Tasks plugin, are picked up the next time Obsidian starts here: they are recorded on that day, except done and cancelled dates, which come from the task itself.

### Planned date, pushes and lateness

A task with a horizon gets a planned date when it is first seen with that horizon: the last day of the horizon's period on that day. Weeks run Monday to Sunday, as in Tasks' own `this week`:

| Horizon | Last day of its period, seen on Sat 17 Oct 2026 |
| --- | --- |
| `today` | Sat 17 Oct |
| `tomorrow` | Sun 18 Oct |
| `this week` | Sun 18 Oct |
| `next week` | Sun 25 Oct |
| `this month` | Sat 31 Oct |
| `next month` | Mon 30 Nov |

When the horizon changes, the last day of the new period is worked out for the day of the change. If it is earlier than the planned date, it becomes the planned date. So the planned date only ever moves earlier: it is the earliest date the task was planned for. A change to a horizon whose period ends later is a push, and the history counts pushes. Due, scheduled and start dates play no part.

A task's days late:

- open: today minus the planned date;
- done or cancelled: the done (or cancelled) date minus the planned date.

Days late are never negative. A task is late when it is at least one day late. A task without a planned date is never late.

For example, `Call the supplier` was set to `next month` on Fri 2 Oct (planned: Mon 30 Nov), pulled in to `today` on Mon 12 Oct (planned: Mon 12 Oct), then pushed to `tomorrow` three evenings in a row and set back to `today` each next morning. On Sat 17 Oct it is 5 days late, with 3 pushes.

### How the history recognises tasks

The history knows a task by an internal id, not by its text. On every change in the vault, it links the vault's tasks to the ones it tracks, in this order:

1. the same line, unchanged, in the same file;
2. the same text in the same file, where the text ignores the checkbox, the done and cancelled dates, the horizon and multi-step strikes, so that changing the horizon, completing a task or finishing a step keeps its history;
3. the same text in another file (a moved task);
4. the same line number in the same file with similar text (a task edited in place);
5. similar text elsewhere in the same file (a task edited while lines above it changed).

So editing a task's text, dates or priority keeps its history, whether the edit comes from the edit dialog, typing in the editor, a menu or another device while Obsidian was closed. Steps 4 and 5 are skipped for recurring tasks, so that the next occurrence of a completed recurring task starts a fresh history, while the done line keeps the old one.

A tracked open task that is no longer found (deleted, reworded beyond recognition, or, when tracking tasks with a horizon, its horizon removed) is dropped. Done and cancelled tasks are remembered for 35 days, and a done task unchecked in place in that time gets its history back. A dropped task is remembered until the end of the next day, so that a task cut and pasted in two steps, or deleted and brought back with undo, keeps its history, while a task added later with the same text starts afresh.

### Badges

In query results and Reading mode, a task late by at least the days set for a yellow badge shows a badge after its horizon:

```text
☐ Call the supplier 🔭 today  10d late  📅 2026-10-20
```

The badge's colour follows the settings; by default:

| Days late | Colour |
| --- | --- |
| 1 to 6 | no badge |
| 7 to 29 | yellow |
| 30 to 89 | orange |
| 90 and more | red |

Its text: up to 13 days `1d late` ... `13d late`; up to 59 days `2w late` ... `8w late` (days ÷ 7, rounded down); from 60 days `2mo late`, `3mo late` ... (days ÷ 30, rounded down).

A done or cancelled task's badge says how late it was finished. Hovering over a badge shows the details, for example `Planned for Mon 12 Oct · 10 days late · pushed 3 times · tracked since Fri 2 Oct`. If the task has a created date (➕), it is shown instead of the start of tracking: `created Mon 2 Mar`. A left or right click on the badge opens the horizon menu. A query with `hide horizon` shows no badges.

### Menu

The horizon menu of a tracked task with a planned date ends with these lines, followed only by the items of [nails](nails.md):

```text
  ---
  Planned for Mon 12 Oct · 5 days late
  Pushed 3 times · tracked since Fri 2 Oct
  Reset lateness
```

The first two lines are labels. For a done or cancelled task they say `finished 5 days late` or `finished on time`. Dates in another year show the year.

`Reset lateness`, offered for open tasks with a planned date only, sets the planned date to the last day of the current horizon's period as of today, and the push count to 0. Use it after pushing a task on purpose.

A tracked task without a horizon (opened from the faint 🔭 placeholder) shows one label line instead: `Tracked since Fri 2 Oct`, or `Created Mon 2 Mar` if it has a created date.

### Queries

```text
planned before today
planned before this week
has planned date
is late
is not late
opened before 3 months ago
has opened date
sort by planned
sort by lateness
sort by opened
group by planned
group by lateness
group by opened
```

- `planned` works like Tasks' other dates: `before`, `after`, `on`, `in`, `on or before` and the rest, with dates, relative dates and ranges. Only tracked tasks with a horizon have a planned date.
- `is late` matches tasks at least one day late: open tasks as of today, done and cancelled ones when they were finished. `is not late` matches every other task, including tasks without a planned date.
- `sort by lateness` puts the latest tasks first, then tasks on time, then tasks without a planned date.
- `group by lateness` makes headings by the badge settings, in this order; with the defaults: `Late 90+ days`, `Late 30–89 days`, `Late 7–29 days`, `Late 1–6 days`, `On time`, `Not planned`. `reverse` reverses the order.
- `opened` is when a task was created: its created date (➕) if it has one, or else the day the history started tracking it. It works like the other dates. Tasks that are neither tracked nor have a created date have no opened date.

### Weekly reviews

What is left: everything planned for last week or earlier and still open.

````text
```tasks
not done
planned before this week
group by lateness
sort by planned
```
````

What got done last week, and how late:

````text
```tasks
done last week
has horizon
group by lateness
```
````

Tasks done without a planned date are under `Not planned`.

Old tasks without a horizon, when tracking all open tasks:

````text
```tasks
not done
no horizon
opened before 3 months ago
sort by opened
```
````

### Settings

At the end of the plugin's settings, the group **Horizons** has:

| Setting | Default | Meaning |
| --- | --- | --- |
| Horizon placeholder | On | The faint 🔭 at the end of each task without a horizon (see [horizon](horizon.md#menu)). Off: no placeholder, so a horizon is added by typing it; horizons and their badges still show |
| Tasks to track | Tasks with a horizon | Or `All open tasks` |
| Yellow badge from | 7 | Days late from which a late task shows a badge, yellow |
| Orange badge from | 30 | Days late from which it is orange |
| Red badge from | 90 | Days late from which it is red |

The three day counts are whole numbers from 1; they are used in ascending order whatever order they are typed in. Changes apply at once to query results and Reading views. The settings are kept with the plugin's other settings, on each device.

### Styling

The badge is `<span class="task-horizon-late" data-task-lateness="low">10d late</span>`, right after the task's `span.task-horizon`. `data-task-lateness` is `low` (yellow), `medium` (orange) or `high` (red), and the task's `li` gets the same attribute. A CSS snippet can use them, for example:

```css
/* Tint the whole line of a task late enough for a red badge */
li.plugin-tasks-list-item[data-task-lateness='high'] {
    background-color: rgba(var(--color-red-rgb), 0.08);
}

/* No yellow badges */
.task-horizon-late[data-task-lateness='low'] {
    display: none;
}
```

## Requirements

1. The history follows tasks whose status type is TODO, IN_PROGRESS or ON_HOLD (open), DONE or CANCELLED, in files with a known path; other status types are ignored. Open tasks must also pass the global query's filters (a filter that fails with an error lets the task through; placeholders see a query file named `Horizon history.md`); done and cancelled ones need not. When tracking tasks with a horizon, it follows only tasks with a horizon marker (see [horizon](horizon.md)), and a task starts being tracked only when it is open with a valid horizon. When tracking all open tasks, a task starts being tracked when it is first seen open. A change of the global query is applied at once.
2. Days are local calendar days. The last day of a horizon's period is as in the table above.
3. When a tracked task is seen open with a valid horizon, its planned date becomes the earlier of the planned date (if any) and the last day of that horizon's period on the current day. A change from one valid horizon to another whose period, both worked out on the current day, ends later adds one push, if the task had a planned date. An invalid horizon changes neither. An open tracked task seen without a horizon has no planned date and no pushes.
4. A task that becomes done or cancelled gets its closing date from its done or cancelled date, or the current day if it has none. Its planned date and pushes no longer change. A done or cancelled task that is open again is tracked as before, with the same planned date, pushes and start date.
5. The text used for matching is the task's line without its indentation, list marker and checkbox; without done and cancelled dates, in the emoji and Dataview formats; without the horizon token; without `~~`; with runs of whitespace replaced by one space.
6. Matching runs in the order given above. Similar text: of the words in the two texts (split at whitespace), at least 30% are shared (step 4) or 60% (step 5), counted as shared words divided by all distinct words. Where several tracked tasks fit, the one with the nearest line number wins. A done or cancelled task is linked to an open line only at its own line number. Steps 4 and 5 link only open lines to open tracked tasks, and never when the line is a recurring task.
7. An open tracked task that is not linked becomes dropped, with the current day as closing date. Done and cancelled tasks are kept for 35 days after the day the history recorded the closing, dropped tasks until the end of the next day; then they are forgotten.
8. Files: `.tasks-history/YYYY-MM-DD.json` at the vault root, in the format above, tasks sorted by path and line. Today's file is full if there is no full file yet, or the newest is today's or at least 7 days old; otherwise it holds the tasks whose record, ignoring the line number, differs from the end of the previous file. It is written a few seconds after a change, and when the plugin unloads, and only if its content changed; a day without changes gets no file. Earlier files are never written. Files of version 1, from before change files existed, are read as full files.
9. At startup, after the vault is loaded, the history reads the newest full file it can parse and the files after it, plus the closed and dropped tasks in the files of the last 35 days before it, then checks the vault for changes made while Obsidian was closed. Unreadable files are skipped, with a message in the developer console.
10. Badges and menu lines are shown only for tracked, not dropped, tasks, found by file and matching text (the nearest line if several). A badge needs a planned date and at least the days late set for a yellow badge. The rendered HTML of other tasks stays as without this feature.
11. `Reset lateness` and changes to the settings save what is needed and redraw query results and Reading views.
12. Before the history is loaded, it changes nothing and no task is tracked.
13. Settings missing or invalid in the saved settings fall back to the defaults, each on its own.
14. With **Horizon placeholder** off, a task without a horizon gets no placeholder and no listener for it, in query results and Reading mode; its `li` gets the class `task-horizon-placeholder-off`. Tasks with a horizon, their menus and badges stay the same.

Accepted consequences:

- History starts on the day the feature is installed, or the day all open tasks are first tracked: tasks then count as planned, and as tracked, from that day.
- The history only sees the vault while Obsidian runs on a desktop with this plugin. Changes made elsewhere are recorded on the day Obsidian next starts here, except done and cancelled dates.
- A task reworded heavily and moved to another file at once, or a recurring task edited by hand, starts a new history. A recurring task whose completion deletes it (`🏁 delete`) shows as dropped, and its next occurrence starts fresh.
- Tasks that are dropped don't show in queries. Their record stays in the day's file.
- The history assumes one desktop writes it; two desktops writing the same vault's history at once would overwrite each other's files. The settings are per device, so two desktops could track differently.
- Devices without the fork know nothing of the history: query blocks using `planned`, `opened`, `is late` or `lateness` show an error there.

## Decisions

- **Snapshots in the vault, not a date in the task line.** The first idea was a `🎯 <date>` written next to the horizon. Snapshots keep notes clean, also track horizons typed by hand or on another device, and keep the full history, so later views (a review with counts, a list of dropped tasks) work on data already collected. The cost is more code and matching by text. Rejected as well: a push counter in the line (misses tasks left alone) and the plugin's `data.json` (doesn't travel with the vault).
- **Internal ids plus text matching**, not `🆔` ids in task lines or rewriting old files when a task is edited. In-place edits keep the line number, so they link without help; old files keep the old text under the same id.
- **Full files weekly, change files in between.** Tracking all open tasks means a thousand or more tasks in a vault; a full file every day would grow the folder by about 90 MB a year. Change files are small, a broken file damages one day at most, and loading reads one full file and the changes after it. Line-only changes don't count, so inserting a line above many tasks doesn't rewrite them all; the next full file brings the line numbers up to date.
- **The planned date is the earliest date ever planned**, so both repeated pushing and leaving a task alone make it late, and pushing never hides lateness. `Reset lateness` is the way out for deliberate deferrals.
- **The global query limits what is tracked**, as it limits every query: tasks outside it are tasks the user chose not to see. Done and cancelled tasks are exempt, because global queries often say `not done`, and a completion would otherwise look like the task was dropped.
- **Only horizons make plans.** Due, scheduled and start dates are not plans here (the user's choice): vanilla Tasks already queries them. Tasks without a horizon are tracked only for their age.
- **Removing a horizon ends the plan** when tracking all open tasks, so the planned date always belongs to the horizon the task has now. When tracking tasks with a horizon, removing it drops the task.
- **`opened`: the created date if there is one, else the start of tracking.** Existing tasks with ➕ keep their real age; tasks without one get the best date the history has. A separate name from Tasks' `created`, which only reads ➕.
- **35 days of done and cancelled tasks**: enough for weekly and monthly reviews, and for an unchecked task to get its history back. **Dropped tasks only until the next day**: long enough for cut and paste or undo, short enough that a routine task added again with the same text doesn't inherit an old planned date.
- **Configurable badge levels with relaxed defaults (7, 30, 90 days)**: the first defaults (1, 7, 28) suit work that moves fast; personal tasks need slower ones. `group by lateness` uses the same levels, plus `Late 1–6 days` below the first.
- **Settings in the plugin's settings, per device**, in one object `t7` (the fork's settings) with a group at the end of the settings tab. Keeping them in the history folder, shared by every copy of the vault, was considered while the phone might run the fork; it doesn't, so plain settings are simpler.
- **A dot folder at the vault root**: hidden from Obsidian's file list and search, not synced to phones by Obsidian Sync, still backed up with the vault's folder.
- **JSON, not Markdown**: task lines in a note would show up in every query.
- **`planned` and `opened` are Tasks date fields**, so every date filter, relative date and range works, and `sort by` and `group by` come with them.
- **`group by lateness` uses buckets**, since a heading per planned date is too fine for a review. The order comes from `%%n%%` prefixes, as with `group by horizon`.
- **Similarity thresholds**: in-place edits are usually small, but a task's line includes its dates and tags, so even a reworded description shares many words; 30% at the same line catches rewording, 60% elsewhere avoids linking unrelated tasks.
- **Recurring tasks link only on matching text**, because their next occurrence sits where the old line was, with similar text.
- **The horizon placeholder setting is here**, not in the horizon feature (added 2026-10-19, for a vault without horizons): it needs the fork's settings object and settings group, which this feature added, so the group is now called `Horizons`. It hides only the placeholder, because a horizon typed by hand should still show with its badge. Rejected: `hide horizon` in the Global Query (it hides badges too) and a CSS snippet (works, but is not a setting).
- **English strings only**, as in the horizon feature, the settings group included.
- **Vanilla Tasks compatibility: safe for notes** (nothing is written to them); the new query instructions are unknown to vanilla Tasks. The user doesn't use the history on the phone.
- **Code layout for cheap rebases**: new files in `src/HorizonHistory/`, plus `src/Config/ForkSettings.ts` and `src/Query/Filter/PlannedDateField.ts`, `LatenessField.ts`, `OpenedDateField.ts`. Upstream files get a start-up call in `main.ts`, three registration lines in `FilterParser.ts`, the `t7` field and its default in `Settings.ts`, one group line in `SettingsTab.ts`, one `@import` in `styles.scss`, sample lines in `tests/Query/Query.test.ts` and the new group in the settings tab's approval file. The badge, the menu lines and the placeholder setting hook into the horizon feature's own files.
