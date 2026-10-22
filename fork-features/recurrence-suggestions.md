# Recurrence suggestions that keep what you typed

Tasks' auto-suggest helps with the rule after 🔁: it offers `every week`, `every month` and so on, and `✅ <rule>` once the text typed is a valid rule. Two flaws made `when done` hard to type: it was never offered, and the ✅ suggestion could throw away what was typed. This feature fixes both.

## User-facing behaviour

Typing `every week when done` after 🔁:

| Typed so far | First suggestion before | First suggestion now |
| --- | --- | --- |
| `every week w` | `✅ every week` (drops `w`) | `every week when done` |
| `every week when d` | `✅ every week` (drops `when d`) | `every week when done` |
| `every week when done`, at the end of the line | `✅ every week when done` | the same |
| `every week when done`, followed by a space or `🏁 delete` | `✅ every week` (drops `when done`) | `⏎` (Enter starts a new line) |
| the cursor back after `every week` in `every week when done` | `✅ every week` (drops `when done`) | `⏎` |

- `<rule> when done` is offered as soon as the start of `when done` follows a valid rule: `every 2 days w` gives `every 2 days when done`, `every week on mon wh` gives `every week on Monday when done`.
- `✅ <rule>` is offered only when the rule keeps every word typed. A typed word may be the start of one of the rule's words: `every week on mon` still gives `✅ every week on Monday`.
- A rule followed by spaces counts as finished, however many spaces: no recurrence suggestion, so Enter starts a new line.
- Everything else is as before: `every week` still gives `✅ every week` and `every week on Monday` and the other ready-made rules.
- It works in both task formats.

## Requirements

- A suggestion never replaces typed text with a rule that lacks some of it.
- The `when done` suggestion replaces the same text as Tasks' other recurrence suggestions: 🔁 and the rule after it, not the fields after the rule.
- No change to how task lines are read: Tasks trims the rule before reading it, so `🔁 every week when done 🏁 delete` was always a `when done` rule. Only the auto-suggest was affected.

## Decisions

- **Why the old suggestions dropped text**: Tasks reads the rule with the `rrule` library, which skips words it doesn't know, so `every week when d` reads as `every week`. And `when done` is recognised only at the very end of the text, so `every week when done` with a space after it (always there when a field follows the rule) read as `every week`. The ✅ suggestion then showed the shorter rule and replaced the whole typed text with it. The fix trims the text before reading it, and checks the words.
- **Words matched in order and as prefixes**, not exactly: `rrule` writes rules in its own words (`every monday` becomes `every week on Monday`, `mon` becomes `Monday`), and those suggestions were useful.
- **`when done` offered only once its start is typed**, not after every finished rule: after `every week` and a space, a suggestion would make Enter pick it instead of starting a new line.
- **A fork feature rather than an upstream contribution** for now, because the fork needed it at once. The fix is small and self-contained, so it could be offered upstream.

## Compatibility with vanilla Tasks

Safe: auto-suggest only. The lines written are the same as before, minus the dropped words.
