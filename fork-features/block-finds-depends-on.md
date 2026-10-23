# `block` finds depends on

Tasks' auto-suggest offers a task property when the word typed is part of its name: `dep` brings up `⛔ depends on id`. But a task that depends on another is one that is blocked, and Tasks' own filters say so (`is blocked`), so `block` is a natural word to type, and it found nothing. With this feature it finds depends on.

## User-facing behaviour

| Typed in a task | Auto-suggest before | Auto-suggest now |
| --- | --- | --- |
| `Fix login blo`, `bloc`, `block`, `blocke` or `blocked` | no match: the full list, with `⏎` first | `⛔ depends on id`, first |
| `Fix login bl` | no match | the same |
| `Fix login blocking`, `blocks`, `blocker`, `unblock` | no match | the same |

- Picking `⛔ depends on id` replaces the typed word with `⛔`, as picking it after typing `dep` does: `Fix login block` becomes `Fix login ⛔`, then Tasks offers tasks to depend on.
- Case doesn't matter: `Block` and `BLOCKED` work too.
- Not offered when Tasks wouldn't offer depends on for `dep`: the task already has `⛔`, or the file can't be saved.
- It works in both task formats: in the Dataview format, `[block` gives `[dependsOn::`.

## Requirements

- The word is the one Tasks matches against its task property suggestions: the letters around the cursor, with at least one before it. Picking the suggestion replaces the whole word, as for `dep`.
- The word must be the start of `blocked`, at least `blo`, and at least as long as the setting **Minimum match length for auto-suggest**.
- No change to what any other word suggests, or to what is written: the suggestion is Tasks' own depends on suggestion.

## Decisions

- **The start of `blocked`, not any word containing `block`**: in Tasks, a task that depends on others is blocked, and one that others depend on is blocking (`is blocked`, `is blocking`). So `blocking` and `blocks` would mean the other side, the task's 🆔 id, and suggesting depends on for them would be wrong. Tasks' usual rule, the word anywhere in the suggestion's text, would also have matched `lock` and `unblock`.
- **At least `blo`**: no other task property starts with `b`, so `b` or `bl` would put depends on first for every word starting that way, and Enter at the end of such a word would pick it instead of starting a new line. Three letters, as for nails' `nai`.
- **The same text, `⛔ depends on id`**, not a new one like `⛔ blocked by`: one suggestion, whatever word found it.

## Compatibility with vanilla Tasks

Safe: auto-suggest only. It writes Tasks' own `⛔` field.
