# Complete permanently

Completing a recurring task always creates its next occurrence, and with `🏁 delete` it also removes the completed copy. When a series is over (the plant is gone, the subscription is cancelled), neither is wanted: the task should simply end up done. `Complete permanently` does that from a context menu.

## User-facing behaviour

```text
- [ ] Water plants 🔁 every day 🏁 delete 📅 2026-10-27
```

becomes, after `Complete permanently`,

```text
- [x] Water plants 🔁 every day 🏁 delete 📅 2026-10-27 ✅ 2026-10-27
```

- **Where:** at the end of the status menu, the menu of a right-click on a task's checkbox (query results, Reading mode, and the editor in Live Preview and Source mode), after a separator. At the end of the menu of a right-click on a rendered task's text (query results and Reading mode, the menu with `Add nail`). In the context menu of a task line in the editor. It is also a command, `Complete permanently`, for the task on the cursor's line (command palette, under Tasks; a hotkey can be set for it).
- It is offered only for a recurring task (one with 🔁) that is open: todo, in progress or on hold. Not for a done or cancelled task, nor for a task without 🔁.
- The task is marked done, with a done date of today if the Tasks setting for done dates is on. No next occurrence is created, and the done line stays, whatever its on completion says (`🏁 delete` included).
- Nothing else on the line changes: the recurrence rule, `🏁 delete`, dates, priority, id, block link and nested lines stay as they were.
- In the editor it is one edit: Undo (Ctrl+Z) brings the open task back.

## Requirements

1. Offered when the task has a recurrence rule and its status type is TODO, IN_PROGRESS or ON_HOLD. Otherwise it is not in any menu, and the command is not available.
2. The result is exactly one task: the original with a done status and, if `setDoneDate` is on, today's done date. The status is the one a toggle would give, if that is of type DONE; otherwise the first registered DONE status (`[x]` by default).
3. On completion is ignored: neither `🏁 delete` nor any other value removes the done task. The setting for putting the next occurrence on the next line does not matter, since there is none.
4. A multi-step task (🪜) is marked done as a whole, as `Change status to: [x] Done` would mark it: its steps are left as they are, not struck through.
5. The line is written by the standard serializer, so fields are in Tasks' usual order.
6. Lines Tasks does not see as tasks (outside the global filter, plain list items) are left alone.

## Decisions

- **Keep the recurrence rule and `🏁 delete` on the done line.** The done line then records which series it ended, and nothing on it is edited that the user didn't ask for. A done task never recurs by itself; only unchecking and checking it again would start the series anew, as with any done recurring task. Rejected: removing 🔁 and 🏁 (loses that record, and the line could no longer be taken up again with one click).
- **In the status menu, too.** The checkbox is where people look for completing a task, so `Complete permanently` sits with the statuses, in every place that menu opens. It is also in the two other context menus a task has (the rendered task's text, the editor line), next to `Split task`, so a right-click anywhere on the task finds it.
- **Only open tasks.** A done task has nothing left to do, and turning a cancelled task into a done one changes what happened; neither needs the item.
- **The toggle's done status.** With custom statuses, a user who cycles `[ ]` to `[D]` gets `[D]` here too.
- **No setting.** It is a menu item that does nothing until chosen.

Vanilla Tasks (for example on a phone syncing the same notes) reads the result as an ordinary done task: it is the line a manual edit would give.
