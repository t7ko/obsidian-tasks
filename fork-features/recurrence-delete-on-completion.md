# 🏁 delete for typed recurrences

Tasks keeps the completed copy of a recurring task unless the task says `🏁 delete`. For someone who wants that on every recurring task, typing `🏁 delete` after each `🔁 every ...` is a chore. With this feature's setting on, Tasks adds it the moment a 🔁 goes into a task line in the editor.

## User-facing behaviour

The setting is **Settings > Tasks > Recurring tasks > Add 🏁 delete to typed recurrences**, off by default.

With it on, put a 🔁 into a task line in the editor (Live Preview or Source mode), by typing it or by picking `🔁 recurring (repeat)` from Tasks' auto-suggest. A space and `🏁 delete` appear right after the cursor at once (`|` is the cursor):

```text
- [ ] Pay rent 🔁 | 🏁 delete
```

Then type or pick the rule as usual; it goes between the two:

```text
- [ ] Pay rent 🔁 every month 🏁 delete
```

- It works anywhere in the line, also before other fields: `- [ ] Pay rent 🔁 every month 🏁 delete 📅 2026-11-01`.
- It is an edit of its own: Undo (Ctrl+Z) takes back only `🏁 delete`.
- Removing the 🔁 again (Backspace, or deleting the rule with it) before the cursor leaves the line removes the `🏁 delete` it brought. After the cursor has left the line, the line is the user's: nothing is removed.
- Removing `🏁 delete` by hand keeps it removed.

Nothing is added when:

- the setting is off;
- the line has a 🏁 already: `keep`, `delete`, or a value that Tasks doesn't know;
- the line had a 🔁 already;
- the 🔁 came in pasted or dropped text, so moving a task by cut and paste or by dragging doesn't change it;
- the 🔁 came back through Undo or Redo;
- the 🔁 was not inserted at the cursor, as when the file changes on disk (the edit modal, another device);
- the task is done or cancelled, or the line isn't a task (no checkbox, or no global filter);
- the task format is Dataview;
- the editor is read-only.

## Requirements

- The trigger is an edit that inserts a 🔁 into the cursor's line, deletes no 🔁 anywhere (so a task being toggled or moved doesn't count), and leaves the line with no other 🔁.
- `🏁 delete`, with a space in front, goes at the cursor, and only if, once the edit is done, the cursor is a single cursor right after the inserted text and nothing else changed. Tasks' auto-suggest moves the cursor after its insertion in a second step, so the check waits for that.
- The cursor stays before the space and `🏁 delete`, so that the rule is typed in front of it.
- The `🏁 delete` added on a line is followed through edits until the cursor leaves that line or the user removes it. If the line loses its last 🔁 meanwhile, it is removed, as an edit of its own. A task without recurrence but with `🏁 delete` is deleted when completed, so a stray one would make a task vanish.
- A view that opens another file starts afresh.
- The edit modal, menus, query results and the API are not affected.

## Decisions

- **Editor only** (the user's choice, 2026-10-21: they type recurrences by hand, and don't want the edit modal changed). Rejected: adding it on save in the edit modal.
- **Added as soon as the 🔁 goes in** (the user's choice, 2026-10-22). The first version added it when the cursor left the line, once the rule was valid. The user found that it never fired: Obsidian's Enter removes the trailing space that Tasks' auto-suggest leaves, in the same edit that adds the new line, and the code then took the new line for the one just left. Adding it with the 🔁 needs no idea of leaving the line, and the user sees it at once.
- **At the cursor, with a space in front of `🏁 delete`**, so that typing a space and `every week` after a bare 🔁, or `every week` after the auto-suggest's 🔁 and space, ends with single spaces. Picking the rule from the auto-suggest gives single spaces too, as Tasks' recurrence suggestions replace the spaces after 🔁.
- **Pasted and dropped text excluded.** Moving a task by cut and paste would otherwise change it. The cost: pasting a lone 🔁 doesn't trigger either.
- **Only when the line had no 🔁.** Changing every recurring task that the cursor passes would rewrite old tasks, including ones where the user chose not to have `🏁 delete`.
- **An existing 🏁, even an unknown value, wins.** The user has chosen something; a second 🏁 would leave the line with two.
- **A separate undo step**, so Undo removes only what the feature added.
- **Emoji format only.** In the Dataview format the field is typed inside brackets, `[repeat:: ...]`, where the cursor sits inside the field; adding `[onCompletion:: delete]` there would need different rules, and the user doesn't use that format.
- **Off by default**, so installing the fork changes nothing until the user asks for it. The setting is per device, like all plugin settings.
- **English setting text**, like the other fork settings.

## Compatibility with vanilla Tasks

Safe: `🏁 delete` is standard Tasks syntax, written as Tasks writes it. Vanilla Tasks reads it and, when the task is completed there, deletes the completed copy just as the fork does.

## Interaction with horizon history

A completed recurring task with `🏁 delete` leaves no done line, so horizon history shows it as dropped, and its next occurrence starts a fresh history (see [horizon history](horizon-history.md)).
