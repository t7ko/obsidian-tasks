# Multi-step tasks

A task can list steps in its description. Checking the task off finishes only its current step and moves on to the next one; the task is done when its last step is.

## User-facing behaviour

Write the steps after the marker 🪜, separated by `//` with a space on each side. Tasks' auto-suggest offers `🪜 steps` to insert the marker. Each click on the checkbox strikes the current step through with `~~`, and the task stays open until its last step:

```text
- [ ] Renew passport 🪜 fill form // get photo // submit 📅 2026-10-30
- [ ] Renew passport 🪜 ~~fill form~~ // get photo // submit 📅 2026-10-30
- [ ] Renew passport 🪜 ~~fill form~~ // ~~get photo~~ // submit 📅 2026-10-30
- [x] Renew passport 🪜 ~~fill form~~ // ~~get photo~~ // ~~submit~~ 📅 2026-10-30 ✅ 2026-10-17
```

- The current step is the first one not struck through. Done steps show struck through wherever the task is rendered: in the note, in query results, and in vanilla Tasks.
- The text before the marker is the task's title and is never changed. Steps belong to the description, so they go before the task's fields (dates, priority, recurrence).
- Steps advance on a checkbox click (Live Preview, Reading mode, query results), the "Toggle task done" command, and the API's `executeToggleTaskDoneCommand`.
- Un-checking a task whose steps are all done (as finishing the last step leaves it) reopens the last step. To go back further, remove the `~~` by hand.
- A recurring multi-step task is completed as usual when its last step is done, and the new occurrence starts again at step 1.
- Choosing a status (status menu, "Change status to" commands, the edit modal) sets the whole task's status, as upstream: choosing Done completes the task with its steps as they are. A new occurrence still starts at step 1.
- The edit modal shows the steps as part of the description, where they can be edited as text.
- The edit modal has a **Steps** section between Priority and the dates. Its button `Insert 🪜` puts the marker into the description at the cursor and leaves the cursor after it, ready for the first step. It is greyed out while the description has a marker. With access keys on, Alt+P presses it.

There is no setting. Tasks without the marker behave exactly as upstream.

## Requirements

1. A description has steps when it contains `🪜` (optionally followed by U+FE0F). The steps are the text after the first marker, up to the end of the description, split at `//` with whitespace before it and whitespace or the end of the description after it. So `https://example.com` and `a//b` don't split.
2. A step's text is its segment without surrounding whitespace and without trailing tags, nor a [horizon](horizon.md) at its end. A segment that is empty or holds only tags (and a horizon) is not a step. A step is done when its text starts and ends with `~~`.
3. Toggling a task with steps (`Task.toggle()`, which all the toggle actions above use):
    - into a status of type DONE from one that is not, with two or more open steps: strikes the first open step through and keeps the status, dates and everything else. No done date, no new occurrence, no On Completion action.
    - into DONE with exactly one open step: strikes it through, then completes the task as upstream (done date, new occurrence, On Completion).
    - into DONE with no open step: as upstream.
    - from DONE into a status that is not DONE, with every step done: reopens the last step, then as upstream.
    - any other change (for example TODO to IN_PROGRESS in a custom status cycle): as upstream, steps untouched.
4. Only the step's text changes. Whitespace as typed, separators, tags, the title, the other fields and the block link are kept.
5. Trailing tags stay outside the strikethrough (`~~bake~~ #home`): Tasks' tag pattern allows `~`, so `~~bake #home~~` would turn the tag into `#home~~`.
6. Every new occurrence of a recurring task has all its steps reopened, whichever action created it.
7. Setting a status through `handleNewStatus()` (status menu, status commands, edit modal) never advances a step.
8. The editor auto-suggest offers `🪜 steps` (inserting the marker and a space) among the task property suggestions, in the emoji task format only, when the line has no marker yet.
9. The edit modal has a section labelled Steps, followed by a line, just before its first dates section: under the line after Priority, or right under the description when Priority is hidden. It stays there when the modal's options show Priority while the modal is open. Its button `Insert 🪜`:
    - replaces the description field's selection (or inserts at its cursor) with the marker, with a space before it unless it is at the start or after whitespace, and a space after it. If text follows without whitespace, one more space keeps it apart;
    - with no selection and only whitespace after the cursor, inserts before a valid [horizon](horizon.md) that ends the description, so the steps typed there come before it;
    - leaves the focus in the description field and the cursor just after the marker and its space;
    - is one step in the field's undo history (Ctrl+Z);
    - is disabled, with a tooltip saying the description already has the marker, whenever the description contains it, as typed or inserted;
    - has the access key P, underlined in the label, when the Tasks setting for access keys is on.
10. Parsing and writing task lines don't change: to every serializer the steps are description text, so vanilla Tasks reads the same fields from the same lines.

Accepted consequences:

- Vanilla Tasks (another device, or this vault without the fork) shows the steps as description text with done steps struck through, and reads all standard fields as before. Toggling there completes the whole task at once, steps as they are; to advance one step there, wrap it in `~~` by hand.
- Completing a recurring multi-step task in vanilla Tasks copies the description as it is into the new occurrence, strikes included, so that occurrence doesn't start at step 1 until the `~~` are removed. If every step is struck through, the fork's next toggle completes it as upstream.
- With Slash snippets enabled and its trigger `/`, typing `//` on a task line opens Slash snippets' popup; it closes at the space after `//`.
- A step can't contain ` // `, and a step with `~~` at both ends counts as done.

## Decisions

- **Steps in the task line, not child checkboxes.** Tasks only supports single-line tasks: every write replaces one line, and a new occurrence copies one line. Kept in the line, steps travel with recurrence, and every toggle action gets them through one hook in `Task.toggle()`. Rejected: indented child checkboxes under the task. They could be checked one by one in vanilla Tasks, but without a global filter each step would be a separate task in query results, new occurrences wouldn't copy them, and several toggle actions (the editor ones read only the cursor line) would have to write other lines, through larger hooks in hot renderer and editor files.
- **Description text, not a new task field.** No serializer, layout, renderer or modal change is needed (a real field touches about 13 files), and vanilla Tasks treats unknown text right after the description as description anyway. Rejected: a serialized field.
- **Strikethrough marks done steps.** It is plain Markdown, so progress shows wherever the description is rendered, vanilla Tasks included, and it can be edited by hand. Rejected: removing done steps (a recurring task needs them again), and a counter such as `2/3` (has to be kept in sync with the steps and says nothing per step).
- **Marker 🪜 and separator `//`, chosen by the user.** An explicit marker keeps ordinary descriptions containing `//` from being taken for steps. Whitespace is required around `//` so URLs and `a//b` don't split. Rejected: `>` (proposed first) and `;` as separators, 👣 as the marker.
- **Only toggling advances a step; choosing a status sets the whole task's status**, chosen by the user. The checkbox and the toggle command mean "I did the next thing", while the status menu, status commands and edit modal stay a way to complete or cancel the whole task at once. Rejected: advancing a step on every way of marking a task done.
- **The status is kept while steps remain**, In Progress included: the task as a whole is still under way. Rejected: resetting it to the start of the status cycle.
- **Un-checking reopens the last step only when every step is done**: that is the state finishing the last step leaves, so un-checking undoes exactly that click. When steps are open (the task was completed through a status or in vanilla Tasks), un-checking leaves them as they are.
- **No separate display of the current step or progress in query results**: the strikethrough shows both, and more would mean changes in hot renderer files. It can be added later.
- **The auto-suggest offers the marker**, as the user asked, since an emoji is awkward to type. Not in the Dataview format, where suggestions go inside brackets.
- **The edit modal inserts the marker with a button in a section of its own, between Priority and the dates**, chosen by the user: the modal's description is a plain text field without Tasks' auto-suggest. Rejected: the button next to the Description label (proposed first), and a keyboard shortcut with nothing on screen. Access key P, free in the modal and a letter of "Steps".
- **The button is greyed out while the description has a marker**, as the auto-suggest stops offering it: a second marker would only be step text. Rejected: turning it into a button that inserts a ` // ` separator.
- **The insertion goes through `execCommand('insertText')`**, so that Ctrl+Z in the field takes it out again. It is deprecated (one lint warning), but nothing else adds to a text field's undo history; where it is missing (jsdom), the field's text is set directly.
- **Vanilla Tasks compatibility: risky but acceptable**, accepted by the user (see "Accepted consequences"). Nothing is misparsed or lost; vanilla only completes the whole task at once.
- **Code layout for cheap rebases**: the logic is in new files, `src/Task/MultiStepTask.ts` (string functions only; it imports nothing from `Task`, so no new import cycle) and `src/Suggestor/MultiStepSuggestion.ts`. Upstream files get small hooks: `src/Task/Task.ts` an import, three lines in `toggle()` and one property in `createNextOccurrence()`; `src/Suggestor/Suggestor.ts` an import and one call in `addTaskPropertySuggestions`. Two upstream approval files listing the emoji-format suggestions gain the `🪜 steps` line. The edit modal's section is built by `src/ui/StepsMarkerSection.ts` (with its `.scss`) and added to the rendered form from `src/Obsidian/TaskModal.ts` (an import and one call after the form is mounted), not written into `src/ui/EditTask.svelte`: that file is one of upstream's most edited, and its HTML is in two approval files. The section goes just before the first dates section, which is never re-created; Svelte inserts the Priority block before its own anchor, which is above the section. `src/styles.scss` gets one `@import` next to the edit modal's.
