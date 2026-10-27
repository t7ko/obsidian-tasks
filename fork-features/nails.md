# Nails

A task waiting in the backlog gets a nail each time someone asks for it again. The nails are ⚠️ signs at the start of its description: the more nails, the more urgent the task. The picture behind the name: a new request is not started at once but hung on a nail on the wall; each reminder moves it to the next nail, and by the third nail it is time to do it.

## User-facing behaviour

```text
- [ ] Ship the export feature
- [ ] ⚠️ Ship the export feature
- [ ] ⚠️⚠️ Ship the export feature 📅 2026-11-01
```

- A task's nails are the ⚠️ signs in a row at the very start of its description. `⚠️text`, `⚠️ ⚠️ text` and ⚠ without the emoji variation selector count too. A ⚠️ further on is ordinary text, including one after a leading tag (`#work ⚠️ Fix the build`).
- Adding a nail puts one more ⚠️ at the start: `Fix` becomes `⚠️ Fix`, then `⚠️⚠️ Fix`. Removing one takes off the first ⚠️; after the last one, the space after it goes too.
- A ⚠️ typed by hand is a nail like any other, also on a device without the fork.

### In query results and Reading mode

A right-click anywhere on a task opens this menu:

```text
  Add nail
  Remove nail
```

`Remove nail` is offered only for a task with nails. For a task that can be [split](split-tasks.md), the menu ends with a separator and `Split task`. The places that have menus of their own keep them: the checkbox (status), dates, the priority and its placeholder, the horizon and its placeholder, the postpone button. Links, tags and images keep Obsidian's menus, selected text keeps the menu with Copy, and a list item nested under the task is left alone. A left click does nothing new.

The priority menu and the horizon menu end with a separator and the same items:

```text
  Priority: Lowest
  ---
  Add nail
  Remove nail
```

### In the editor

In Live Preview and Source mode:

- A right-click on a task line adds `Add nail` and, if the task has nails, `Remove nail` to the editor's context menu. They act on the line with the cursor; a right-click puts the cursor where it clicks, unless it clicks inside selected text. A right-click on one of the task's dates opens the [date menu](editor-date-menu.md) instead, and one on its checkbox the [status menu](editor-status-menu.md), without these items.
- The commands `Add nail` and `Remove nail` (command palette, under Tasks; hotkeys can be set for them) act on the task on the cursor's line. They are offered only on a task line, and `Remove nail` only when the task has nails.
- Auto-suggest: typing `nai` or `nail` in a task's description offers `⚠️ add nail` and, if the task has nails, `⚠️ remove nail`. Choosing one deletes the typed word and adds or removes a nail at the start of the description, wherever the cursor is; the cursor stays where the word was.

The cursor stays on the same text in all three.

### Queries

```text
has nails
no nails
nails is 2
nails is above 1
nails is below 3
nails is not 0
sort by nails
sort by nails reverse
group by nails
group by nails reverse
```

- In the filters, `is` is optional (`nails above 1`), as in Tasks' priority filter.
- `sort by nails` puts the most nails first, as `sort by priority` puts the highest priority first.
- `group by nails` makes the headings `3 nails`, `2 nails`, `1 nail`, `No nails`, the most nails first. The order comes from hidden `%%n%%` prefixes in the group names, as with `group by priority`.

A backlog that shows the most-requested tasks first:

```text
not done
sort by nails
```

### Styling

The `li` of a rendered task with nails gets a `data-task-nails` attribute with their number; tasks without nails have no attribute. A CSS snippet can use it, for example:

```css
/* Three nails or more: time to do it */
li.plugin-tasks-list-item[data-task-nails]:not([data-task-nails='1'], [data-task-nails='2']) {
    background-color: rgba(var(--color-red-rgb), 0.1);
}
```

## Requirements

1. The number of nails is the number of ⚠ (U+26A0) in the run at the start of the description made of ⚠, each optionally followed by U+FE0F, with any whitespace between and after them. Nothing else counts.
2. Adding a nail writes U+26A0 U+FE0F at the start of the description, followed by a space if the task had no nails. Removing one deletes the first ⚠ (with its U+FE0F, if any) and the whitespace after it. Nothing else in the line changes: not the text, the tags or the fields.
3. In rendered tasks, the nail menu opens on `contextmenu` of the task's `li`, unless another listener has already handled the event (its `defaultPrevented` is set), the target is inside a nested `li`, the target is inside an `a`, `img`, `video` or `input` element, or a non-empty text selection intersects the task.
4. Menu changes are saved through `replaceTaskWithTasks`, changing only the description. Tasks whose file is unknown (cards on a canvas) get no menu, since edits there can't be saved.
5. The priority menu and the horizon menu end with a separator, `Add nail` and, for a task with nails, `Remove nail`. Their other items don't change.
6. In the editor, menu items and commands replace only the changed text at the start of the description, so the cursor keeps its place in the text. A line without a checkbox gets no items, and the commands are not offered there.
7. Auto-suggest offers the nail items when the letters just before the cursor, inside the description, are a prefix of `nail` at least three letters long, case-insensitively, and not in the Dataview format. Choosing one removes those letters, plus the whitespace before them if whitespace follows the cursor, and adds or removes the nail. A suggestion for a description without other text leaves a space after the nail.
8. Filters, sorting and grouping behave as described above. A filter line starting with `nails` that is not understood gives an error listing the valid forms.
9. The rendered HTML of a task without nails is exactly upstream's.
10. A new occurrence of a recurring task keeps the nails, as it keeps the rest of the description.

Accepted consequences:

- Nails are part of the description: `description includes`, `sort by description` and the edit modal see them, and `description regex matches /^Fix/` doesn't match `⚠️ Fix`.
- A right-click on a task's text in rendered results opens the nail menu instead of what Obsidian showed there before, except on links, tags, images and selected text.
- Query blocks using `nails` instructions show an error in Tasks without the fork.

## Decisions

- **⚠️ in the description, not a new Task field.** The user already marked urgent tasks this way by hand (one to three ⚠️ at the start), so those tasks count as nailed at once. A ⚠️ can be typed on any device, including ones running vanilla Tasks. A real field would touch about 13 upstream source files. Rejected: a counter field such as `📌3`, which reads worse, and which, typed after the fields, would hide them from Tasks; nails at the start can't do that.
- **At the start of the description**: seen first when scanning a list, and clear of the fields, the horizon and the steps at the end.
- **A row of signs, not a number**: counts stay small (the third nail means do it), and the row of signs is the picture itself.
- **Only the run at the start counts**: ⚠️ is common in ordinary text.
- **Right-click anywhere on a rendered task**, as the user asked ("anywhere, even if only on the horizon"). The horizon and priority menus get the items too, because a right-click there opens those menus; the priority menu also because a nail is a kind of priority bump. Rejected: items in the status and date menus, which upstream code attaches, so adding to them would mean edits in upstream's renderer.
- **Links, tags, media, selected text and nested items keep their menus**: Obsidian's link menu and the menu with Copy are needed there.
- **Right-click only**: a left click on the text keeps selecting text and following links.
- **`Remove nail`**, one at a time, to undo a nail added by mistake.
- **Auto-suggest word `nail`** (at least `nai`), in English only, chosen by the user. A matching suggestion makes Enter choose it instead of starting a new line, so the trigger is a word that is rare in ordinary typing. The nail goes to the start of the description wherever the cursor is, since that is the only place nails count.
- **Editor commands with `editorCheckCallback`**, so they are offered only where they can act.
- **The most nails first**, in sorting and grouping, as for priority. Groups have one heading per number of nails; their order comes from `%%n%%` prefixes, as for priority and horizon groups.
- **Filter wording as upstream's priority filter** (`is`, `above`, `below`, `not`).
- **New occurrences keep the nails**, as vanilla Tasks does. Rejected: resetting them, as multi-step tasks reset their steps, which would make a task's next occurrence differ depending on the device that completed it.
- **No effect on urgency**: urgency is upstream's; changing it in the fork would sort tasks differently on devices without it.
- **English strings only**, like the other fork menus; no i18n keys.
- **Vanilla Tasks compatibility**: safe for notes, since nails are ordinary description text. Query blocks using the new instructions show an error there (accepted by the user).
- **Code layout for cheap rebases**: new files `src/Task/Nails.ts`, `src/ui/EditInstructions/NailInstructions.ts`, `src/ui/Menus/NailMenu.ts`, `src/Renderer/NailMenuTargets.ts`, `src/Query/Filter/NailsField.ts`, `src/Suggestor/NailSuggestion.ts`, `src/Commands/NailCommands.ts`. Upstream files get an import and one line each in `FilterParser.ts`, `TaskLineRenderer.renderTaskLine`, `Suggestor.ts` and `main.ts`, and sample lines in `tests/Query/Query.test.ts`. The priority and horizon menus get the items in the fork's own files.
