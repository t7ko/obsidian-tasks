# Date menu in the editor

In query results and Reading mode, Tasks opens a calendar on a click on a task's date and a menu of nearby dates on a right-click. This feature brings both to the editor (Live Preview and Source mode), through a right-click.

## User-facing behaviour

A right-click on a task's date in the editor opens this menu instead of the editor's context menu:

```text
  Pick a date...
  ---
x Start today, on Wed 21st Oct
  Start tomorrow, on Thu 22nd Oct
  ---
  Start in 2 days, on Fri 23rd Oct
  ...
  Start in a month, on Sat 21st Nov
  ---
  Remove start date
```

- `Pick a date...` opens the calendar that a click on a date opens in query results, below the date, with its `Clear` and `Today` buttons.
- The other items are those of the date's right-click menu in query results, with the same titles: today and later dates for start, scheduled and due dates (`Postpone start date by 2 days, to ...` when the date is in the future), today and earlier dates for created, done and cancelled dates, then `Remove`. The current date is checked.
- It works on all six dates (➕ created, 🛫 start, ⏳ scheduled, 📅 due, ❌ cancelled, ✅ done), on the emoji as well as on the digits.
- The change is made in the editor, so Undo (Ctrl+Z) takes it back. The line is written the way Tasks writes task lines, as when a date is changed in query results.
- A left click is unchanged: it puts the cursor in the date, to type.

The editor keeps its own context menu:

- anywhere that is not one of a task's dates: the description, other fields, a line that is not a task (or lacks the global filter), the empty space after the end of a line;
- on selected text, when the right-click is inside the selection, so Copy and Cut stay at hand;
- on rendered parts of Live Preview: callouts, tables, embeds and query results (query results have the menus already);
- in a read-only editor.

## Requirements

- The dates are the ones Tasks reads as the task's fields. Text in the description that looks like one is not: in `- [ ] Read 📅 2026-10-24 notes 📅 2026-10-25` only the last date opens the menu, and in `- [ ] 📅 2026-10-24 is the deadline` none does. In the Dataview format, the field's brackets count as part of the date (`[due:: 2026-10-24]`).
- The menu has no nail items. It is the query results' date menu plus one item, and that menu has none.
- The line written is the one the menu was opened on, when it still has the same number and text. If lines were added or removed above it, it is the only line with the same text. Otherwise (the line was edited while the menu or the calendar was open, or several lines match) nothing is written and a notice says so.
- Closing the calendar without choosing a date writes nothing; the line keeps its exact text.
- No setting.

## Decisions

- **Right-click only** (the user's choice, 2026-10-21). In query results a left click opens the calendar, but in the editor a left click has to keep placing the cursor. Rejected: Ctrl+click for the calendar (nothing on screen suggests it), and a click on the date's emoji opening the calendar (a click next to the emoji to put the cursor there would open it too).
- **`Pick a date...` first, then the query results' items unchanged** (the user asked for "all the same options"), so the menu reads like the one in Reading mode with one item added.
- **Written through the editor, not to the file.** It joins the editor's undo history and can't race the editor's unsaved text. Query results write to the file because they have no editor.
- **The calendar is placed by an invisible element over the date**, removed when the calendar closes. The calendar needs an element to place itself by, and the editor's own elements belong to CodeMirror, which redraws them.
- **English menu text**, like the date menu items it sits with.

## Compatibility with vanilla Tasks

Safe: nothing new is written to notes. A changed date is written by Tasks' own serializer, as vanilla Tasks writes it.
