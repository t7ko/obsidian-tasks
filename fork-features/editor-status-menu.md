# Status menu in the editor

In query results and Reading mode, a right-click on a task's checkbox opens a menu of all statuses. This feature brings the same menu to the editor (Live Preview and Source mode).

## User-facing behaviour

A right-click on a task's checkbox in the editor opens this menu instead of the editor's context menu:

```text
x Change status to: [ ] Todo
  Change status to: [x] Done
  Change status to: [/] In Progress
  Change status to: [-] Cancelled
  ...
```

- The items are exactly those of the checkbox's right-click menu in query results and Reading mode: every status in the Tasks settings, the core ones first. The current status is checked.
- Choosing a status does what it does there: done and cancelled dates are set or removed as the settings say, a recurring task gets its next occurrence, and `🏁 delete` removes the line.
- In Live Preview the checkbox is the rendered one. In Source mode it is the `[ ]` text, from `[` to `]`; this also applies in Live Preview when the cursor is on the checkbox and it shows as text.
- The change is made in the editor, so Undo (Ctrl+Z) takes it back. The line is written the way Tasks writes task lines, as when the status is changed in query results.
- A left click is unchanged.

The editor keeps its own context menu:

- anywhere that is not a task's checkbox: the list marker, the description, the space beside the checkbox, a line that is not a task (or lacks the global filter);
- on selected text, when the right-click is inside the selection, so Copy and Cut stay at hand;
- on rendered parts of Live Preview: callouts, tables, embeds and query results (query results have the menu already);
- in a read-only editor.

## Requirements

- The checkbox is the one at the start of the task, after the indentation (including `>` of quotes) and the list marker. A `[ ]` further along the line is description text.
- The menu has no nail or `Split task` items: it is the query results' status menu, and that menu has none. They stay in the editor's context menu on the rest of the line.
- The line written is the one the menu was opened on, when it still has the same number and text. If lines were added or removed above it, it is the only line with the same text. Otherwise (the line was edited while the menu was open, or several lines match) nothing is written and a notice says so.
- No setting.

## Decisions

- **The query results' menu unchanged** (the user asked for "the same options as in view mode").
- **Source mode too.** There the checkbox is plain text, but the user said "edit mode", which covers both, and the date menu in the editor works in both.
- **Written through the editor, not to the file**, as in the date menu in the editor: it joins the editor's undo history and can't race the editor's unsaved text.
- **No tooltip** on Live Preview's checkbox: query results show "Right-click for options", but the checkbox in the editor belongs to Obsidian.

## Compatibility with vanilla Tasks

Safe: nothing new is written to notes. A changed status is written by Tasks' own code, as vanilla Tasks writes it.
