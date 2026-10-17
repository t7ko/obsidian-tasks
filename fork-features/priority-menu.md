# Priority menu

Click or right-click a task's priority emoji to change it from a menu, without opening the edit modal. A task without a priority shows a faint placeholder to click instead.

## User-facing behaviour

In query results (list and columns views) and in Reading mode, a left or right click on a task's priority emoji (🔺 ⏫ 🔼 🔽 ⏬) opens this menu, with the current priority checked:

```text
  Priority: Highest
x Priority: High
  Priority: Medium
  Priority: Normal
  Priority: Low
  Priority: Lowest
```

Choosing an item rewrites the task's line with that priority, as the edit modal would; `Priority: Normal` removes the emoji. Choosing the current priority changes nothing.

A task without a priority shows a faint grey ⏺️ where the priority would be, right after the description:

```text
☐ Buy milk #home ⏺️ 📅 2026-10-18
```

It brightens when the pointer is over the task, and a left or right click on it opens the same menu with `Priority: Normal` checked. The placeholder is drawn by the plugin's stylesheet and is never written to the note, so the note only ever contains standard priority emojis.

There is no setting. The placeholder can be changed or hidden with a CSS snippet, for example:

```css
/* A different placeholder */
li.plugin-tasks-list-item[data-task-priority='normal'] > .tasks-list-text > .task-description::after {
    content: ' ➖';
}

/* Show the placeholder only while the pointer is over the task */
li.plugin-tasks-list-item[data-task-priority='normal'] > .tasks-list-text > .task-description::after {
    opacity: 0;
}
```

## Requirements

1. The menu opens on `click` and `contextmenu` of a rendered priority, wherever Tasks renders a task line (`TaskLineRenderer`): query results in any view, Reading mode. It lists the six priorities in upstream's `PriorityMenu` with the current one checked.
2. Choosing a different priority saves the task through `replaceTaskWithTasks` with only its priority changed; choosing the current one saves nothing.
3. A task with priority Normal (no emoji) shows the placeholder ⏺️ (U+23FA U+FE0F, greyscale, 30% opacity, 70% while its line is hovered) after its description, and it opens the same menu.
4. No placeholder on tasks whose status type is DONE, CANCELLED or NON_TASK, nor in queries with `hide priority`. With `hide priority`, clicks on the description never open the menu.
5. The placeholder is the `::after` content of the description's outer span. It is not in the DOM text: selecting and copying a rendered task leaves it out, and the toolbar's "Copy results" is unchanged.
6. A click or right-click on the description's text, links and tags behaves as upstream.
7. Tasks whose file is unknown (cards on a canvas) get no menu, since edits there can't be saved.
8. The rendered HTML is exactly upstream's: the feature only adds event listeners and CSS.
9. Live Preview and Source mode don't change: there the task is plain text, and upstream has no field menus there either.

Accepted consequences:

- On a canvas card the placeholder is still drawn but does nothing.
- There is no tooltip on the priority or the placeholder (see Decisions).
- A theme or snippet that hides `span.task-priority` (as upstream's "Priority as a Checkbox Color" example does) hides the clickable emoji too.

## Decisions

- **The placeholder is rendered, not written to notes.** The user first asked for an emoji in tasks without a priority. Written into the note, it would be unknown text to vanilla Tasks on another device: shown as part of the description, copied into every new occurrence of a recurring task, matched by description filters and sorts. It would also need a serializer change and every existing task edited. Drawing it at render time gives the same thing to click with nothing in the notes.
- **CSS `::after` on the description, not a new element.** The rendered HTML stays upstream's, so none of the upstream approval files for rendered tasks change (about 25 contain a task the placeholder would apply to, and upstream changes that folder's approval files about 80 times a year), and the placeholder never ends up in selected or copied text. A click on a pseudo-element is dispatched to its owning element, the outer description span, while clicks on the text land on the inner span; that tells the two apart. The look stays in CSS, so it can be changed with a snippet. Rejected: a placeholder `<span>` (approval churn on every rebase); inserting one on hover (layout shift, flicker at line wraps); priority items in the checkbox's status menu (not in place, as the user asked).
- **⏺️, grey and faint.** On common emoji fonts it has the same button shape as 🔼 ⏫ 🔽 ⏬, and a circle reads as "the middle", which is what Normal is. Grey and faint so it is not taken for a real priority and doesn't crowd lists.
- **Left click opens the menu too.** Dates use left click for the date picker and right click for the menu; for priority the menu is the picker, and left click did nothing before.
- **No placeholder on finished tasks.** Notes accumulate done tasks, and their priority rarely matters. The rule is in CSS, so a snippet can bring it back. A real priority emoji on a done task still opens the menu.
- **No tooltip.** A `title` attribute would change the rendered HTML and with it the approval files; the dates' tooltips are upstream's.
- **Reuses upstream's `PriorityMenu`**, which upstream has but doesn't attach anywhere yet; the menu's wording and saving are upstream's.
- **Vanilla Tasks compatibility: safe.** Nothing new is written: a chosen priority is written by the standard serializer, the same as the edit modal.
- **Code layout for cheap rebases**: new files `src/Renderer/PriorityMenuTargets.ts` and `src/Renderer/PriorityMenuTargets.scss`. Upstream files get an import and one call in `TaskLineRenderer.taskToHtml`, and one `@import` line at the end of `src/styles.scss`.
