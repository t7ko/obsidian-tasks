# Fork features

Specs for the features this fork adds on top of upstream Tasks. Each spec gives the feature's user-facing behaviour, the requirements that define correct behaviour, and the decisions behind it, with the alternatives rejected. Read a feature's spec before changing it, or before resolving a rebase conflict in its code.

After a rebase, run the [smoke test](smoke-test.md): one quick manual step per feature.

| Spec | What it does |
| --- | --- |
| [Let Slash snippets work on task lines](slash-snippets-step-aside.md) | Tasks' auto-suggest steps aside while a Slash snippets name is typed on a task line |
| [Multi-step tasks](multi-step-tasks.md) | A task lists steps after 🪜; checking it off finishes only the current step |
| [Priority menu](priority-menu.md) | Click or right-click a task's priority, or a placeholder when it has none, to change it from a menu |
| [Horizon](horizon.md) | A task's 🔭 horizon (today ... next month): filter, sort and group by it in order of meaning, change it from a menu |
| [Filter clear button](filter-clear-button.md) | A round × at the right end of a query's filter box, or Escape in it, empties it |
| [Horizon history](horizon-history.md) | A daily history of the tasks with a horizon, or of all open tasks: each planned task gets a planned date and shows a badge when late; `planned`, `opened`, `is late` and `group by lateness` serve weekly reviews |
| [Nails](nails.md) | Each ⚠️ at the start of a task is a nail, one more request from someone waiting for it: add and remove them from menus, the editor and auto-suggest; filter, sort and group by them |
| [Date menu in the editor](editor-date-menu.md) | A right-click on a task's date in the editor opens the date menu of query results, plus `Pick a date...` for the calendar |
