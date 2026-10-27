# Split tasks

A task whose description holds several things separated by `//` can be split into one task per thing, from a context menu in the editor and in rendered tasks. Every new task keeps the original's dates, priority, recurrence and other fields.

## User-facing behaviour

With the [multi-step](multi-step-tasks.md) marker 🪜, each step becomes a task, prefixed with the title before the marker and `:`. A step already struck through becomes a done task:

```text
- [ ] Renew passport 🪜 ~~fill form~~ // get photo // submit ⏫ 📅 2026-10-30 🆔 abc123 ^link
```

becomes

```text
- [x] Renew passport: fill form ⏫ 📅 2026-10-30 ✅ 2026-10-26 ^link
- [ ] Renew passport: get photo ⏫ 📅 2026-10-30
- [ ] Renew passport: submit 🆔 abc123 ⏫ 📅 2026-10-30
```

Without the marker, the whole description is split, with no prefix:

```text
- [ ] buy milk // buy eggs // call Bob 📅 2026-10-30
```

becomes

```text
- [ ] buy milk 📅 2026-10-30
- [ ] buy eggs 📅 2026-10-30
- [ ] call Bob 📅 2026-10-30
```

- **Where:** `Split task` is in the context menu of a task line in the editor (Live Preview and Source mode; a right-click on the task's dates or checkbox opens their own menus instead), and at the end of the menu of a right-click on a rendered task's text (query results and Reading mode, the menu with `Add nail`). It is also a command, `Split task`, for the task on the cursor's line (command palette, under Tasks; a hotkey can be set for it). It is offered only for a task with at least two parts.
- The new tasks replace the original line, in order, with its indentation and list marker. Lines nested under the task end up under the last new task.
- Every new task copies the original's status and all its fields: dates, priority, recurrence, on completion, depends on (⛔). Two fields must stay unique, so they go to one task each:
  - The id (🆔) goes to the last new task that is not done (the last task, if all are done). Tasks waiting for the original (`⛔ abc123`) wait for that part, so they stay blocked until the work is finished, and Tasks doesn't ignore their `⛔` as it would for an id that no longer exists.
  - The block link (`^link`) stays on the first, so links to the original lead to its first part.
- A struck-through part (`~~fill form~~`) becomes a done task, with the strikes removed and a done date of today (if the Tasks setting for done dates is on). No new occurrence is created for it. If the original task is completed already, every part keeps its status and dates.
- Every tag goes to every new task. A tag written in one part stays where it is in that part and is added at the end of the others (before a horizon), in the order the tags first appear. A part holding nothing but tags (`#shop // buy eggs // buy milk`) is not a task of its own: its tags go to the others.

  ```text
  - [ ] Fix sink 🪜 call #urgent plumber // buy #shop pipe
  ```

  becomes

  ```text
  - [ ] Fix sink: call #urgent plumber #shop
  - [ ] Fix sink: buy #shop pipe #urgent
  ```

- Nails (⚠️ at the start of the description) and a horizon (🔭) at the end of the description go to every new task. So does the title before 🪜, tags included. Without 🪜, tags right at the start of the description (after any nails) stay at the start of every new task: `#home fix sink // fix door` becomes `#home fix sink` and `#home fix door`.
- If the title before 🪜 already ends with `:`, no second one is added. Without a title (`🪜 a // b`), there is no prefix.
- With a global filter, a part without it gets it at its start (after any nails), so every new task is still a task.

## Requirements

1. Parts are separated as multi-step steps are: `//` with whitespace before it and whitespace or the end of the description after it. `https://example.com` and `a//b` don't split. Parts holding only whitespace are left out.
2. With 🪜 (optionally followed by U+FE0F) in the description, the parts are taken from the text after the first marker; the text before it is the title and is not split. Each new description is `<title>: <part>`, or `<title> <part>` when the title is only nails, or `<part>` without a title. A `:` ending the title is not doubled.
3. Without 🪜, the parts are taken from the whole description, after any nails and tags at its start (tags only if more text of the first part follows them); each new description is those nails and tags, a space and the part.
4. A valid horizon ending the description is taken off before splitting and added to the end of every part.
5. Tags are found with Tasks' own tag pattern. Each part gets, at its end and before the horizon, every tag of the other parts that neither it nor its prefix has, once each, in order of first appearance. A part that is only tags and whitespace is dropped after giving its tags to the others; it doesn't count towards the two parts needed.
6. A part is done when its text, without trailing tags and horizon, starts and ends with `~~` (as for a step). Its new description has those `~~` removed. If the original's status is not of type DONE, the new task is set to the first registered status of type DONE as a status change would set it (done date if `setDoneDate`, cancelled date removed), without a new occurrence and without the On Completion action.
7. Every new task is the original with the new description. Only the last one whose status is not done (Tasks' `isDone`: not of type DONE, CANCELLED or NON_TASK) keeps the id, or the last one if there is none; the others have an empty id. Only the first keeps the block link.
8. Splitting is offered only when there are at least two parts, and in the editor only on a line Tasks reads as a task (checkbox and global filter).
9. The editor replaces the whole line with the new lines in one edit, worked out again from the line when the menu item is clicked. Rendered tasks save through Tasks' usual task replacement.
10. Parsing and writing task lines don't change: the new lines are ordinary Tasks lines.

Accepted consequences:

- Tasks waiting for the original wait only for its last open part, not for the earlier ones.
- Struck-through steps in vanilla Tasks are text; splitting happens only on the desktop with the fork.

## Decisions

- **All fields copied; the id stays with the last part that is not done, chosen by the user.** An id must be unique, so only one task can keep it. Without it, Tasks ignores the `⛔` of tasks waiting for the original, so they would quietly stop being blocked. The last open part is the one that finishes the work. Rejected: no task keeping the id (first proposed), and new ids for every part with the waiting tasks rewritten to wait for all of them (edits other lines, possibly in other notes).
- **The block link stays on the first task only, chosen by the user**: it must be unique in the note, and links to the original keep pointing at the first part. Rejected: dropping it.
- **Struck-through steps become done tasks, chosen by the user**: the work was done, and splitting keeps a record of it. Rejected: dropping them, and open tasks keeping the strikes.
- **`<title>: <step>` with the marker, the parts as they are without it, as the user asked.**
- **Nails, a trailing horizon and every tag go to every part**, tags as the user asked: they describe the whole task, as its fields do. A tag stays in place in its own part and is added at the end of the others, so the text reads as typed. Rejected (proposed first): tags after a part staying only with that part.
- **Context menus, plus a command**, as the user asked for the menus: the command costs nothing more and allows a hotkey. In rendered tasks the item goes at the end of the menu that a right-click on the task's text already opens (the nails menu), since only one menu can open there.
- **Same separator rule as multi-step tasks**, so the two features agree on what a part is.

## Compatibility with vanilla Tasks

Safe: menus and a command only. The new lines are ordinary Tasks lines.
