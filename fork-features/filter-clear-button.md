# Filter clear button

A round × button at the right end of a query's filter box empties it with one click. Escape in the box does the same.

## User-facing behaviour

Query results have a toolbar (unless the query says `hide toolbar`) with a "Filter by description..." box. While the box has text, a grey round × shows at its right end:

```text
[ ▽ milk                   ⓧ ]  [copy]
```

A click on the × empties the box and shows all of the query's results again at once, and the cursor stays in the box, ready for a new filter. The × is gone while the box is empty. It works the same in the list and columns views.

With the cursor in the box, Escape does the same as a click on the ×. When the box is already empty, Escape does whatever it did before.

There is no setting. The button follows Obsidian's own search boxes: its colour is `--search-clear-button-color` and its size `--search-clear-button-size`, so themes that style Obsidian's search boxes style it too. A CSS snippet can change it, for example:

```css
/* A red button */
.plugin-tasks-toolbar label::after {
    background-color: var(--text-error);
}

/* No button (Escape still clears the box) */
.plugin-tasks-toolbar label::after {
    content: none;
}
```

## Requirements

1. The button shows exactly while the box has text, including text that is only spaces.
2. A click on it empties the box, puts the focus in the box, and redraws the results without a filter at once (not after the box's 500 ms typing delay). Group counts are the unfiltered ones, as when the box is emptied by hand. The toolbar itself is kept, as upstream does while typing.
3. A click on the box's text or on the filter icon behaves as upstream.
4. Escape pressed in the box while it has text does what a click on the button does, and goes no further (so the Live Preview editor around the results doesn't act on it too). Escape is left alone when the box is empty, while text is being composed with an input method, and when something has handled the key already.
5. The box doesn't change width while typing, and its text never runs under the button.
6. The rendered HTML is exactly upstream's: the feature only adds CSS and event listeners.
7. With `hide toolbar` there is no box and nothing changes.

Accepted consequences:

- The button can't be reached with Tab; Escape is the keyboard way.
- The button doesn't highlight on hover and has no tooltip: as a pseudo-element it can't be hovered or titled apart from its label.
- The box is 16 px wider than upstream's, since room for the button is kept while it is empty.
- A click or Escape within 500 ms of typing redraws the results twice: once at once, and once when the typing delay runs out (with the box empty, so the result is the same).
- Where Obsidian itself binds Escape, it acts first, as before: query results shown inside a modal close with the modal, and an open menu or suggestion popup closes.

## Decisions

- **A button in the box, as asked.** The user asked for a cross at the right of the box, or another mouse-driven way if that was too invasive. It wasn't: the cross is CSS plus one listener. A double-click on the filter icon was the fallback idea, rejected as undiscoverable.
- **CSS `::after` on the box's label, not a new element.** Upstream's toolbar HTML is in ten approval files of `QueryResultsRenderer.test.ts`; a new element would change all of them and conflict on rebases. A click on a pseudo-element is dispatched to its owning element, the label, while the label's children (the filter icon and the box) cover the rest of it, so a click whose target is the label is a click on the button. Rejected: `<input type="search">`, whose built-in clear button changes the HTML, looks different from Obsidian's own, and empties the box through the typing delay; Obsidian's `SearchComponent`, which would replace upstream's box (a bigger change to a frequently edited file, plus the approval churn).
- **Shown only while the box has text**, like Obsidian's search boxes. CSS tells that with `:placeholder-shown`, so no code tracks the box's value; it needs the box to have a placeholder, which a test checks.
- **Clears at once.** A click is a deliberate action; waiting out the 500 ms typing delay after it would feel broken.
- **Focus goes to the box**, as with browsers' own clear buttons, so a new filter can be typed straight away.
- **Escape too**, asked for by the user once the button worked. Only while the box has text, so that with an empty box the key keeps doing what it did. It is a `keydown` listener on the box. Obsidian's own key handling listens on the window in the capture phase, before the box, and only acts where something binds Escape (modals, menus, suggestion popups, the find bar); in a note's tab the key reaches the box. Rejected: pushing an Obsidian `Scope` while the box has focus, which would win over a modal too, but needs the app object and focus tracking for a rare case.
- **Looks like Obsidian's search boxes**: a filled circle with a cut-out × (the Material Icons "cancel" icon, Apache License 2.0), coloured and sized with Obsidian's search variables, falling back to `--text-muted` and 13 px.
- **Vanilla Tasks compatibility: safe.** UI only; nothing is written to notes or settings.
- **Code layout for cheap rebases**: new files `src/Renderer/FilterClearButton.ts` and `src/Renderer/FilterClearButton.scss`. Upstream files get an import and one call at the end of `QueryResultsRenderer.addSearchBox`, and one `@import` line at the end of `src/styles.scss`.
