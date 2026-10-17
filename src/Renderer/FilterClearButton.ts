/**
 * t7 fork feature: a clear button at the right end of the toolbar's filter box, and Escape in the
 * box clears it too.
 * Spec: `fork-features/filter-clear-button.md`.
 *
 * The button is the `::after` content of the box's `label`, drawn by `FilterClearButton.scss` while
 * the box has text. Events on a pseudo-element are dispatched to the element that owns it, and the
 * label's children (the filter icon and the box) cover the rest of it, so a click whose target is
 * the label itself came from the button.
 * The rendered HTML stays exactly as upstream's.
 *
 * @param label - the toolbar's `label`, holding the filter icon and {@link searchBox}.
 * @param searchBox - the filter box.
 * @param clearFilter - shows the results without a filter, such as
 *        `() => this.applySearchBoxFilterAndRerender('', content)` in `QueryResultsRenderer`.
 */
export function addFilterClearButton(
    label: HTMLLabelElement,
    searchBox: HTMLInputElement,
    clearFilter: () => Promise<void>,
) {
    const clear = async () => {
        searchBox.value = '';
        searchBox.focus();
        await clearFilter();
    };

    label.addEventListener('click', async (ev: MouseEvent) => {
        if (ev.target !== label || searchBox.value === '') {
            return;
        }

        // A click on a label also focuses its input; clear() does that instead, after emptying it.
        ev.preventDefault();
        await clear();
    });

    // With the box empty, Escape is left alone, for whatever else uses it.
    searchBox.addEventListener('keydown', async (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape' || ev.isComposing || ev.defaultPrevented || searchBox.value === '') {
            return;
        }

        // Obsidian's own key handling has run already (it listens on the window, capturing), so
        // this only keeps the key from the editor that shows the results in Live Preview.
        ev.preventDefault();
        ev.stopPropagation();
        await clear();
    });
}
