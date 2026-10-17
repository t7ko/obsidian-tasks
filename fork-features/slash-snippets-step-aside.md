# Let Slash snippets work on task lines

Tasks' auto-suggest steps aside while a snippet name for the community plugin Slash snippets (plugin id `slash-snippets`) is being typed on a task line, so Slash snippets can show its popup there.

## User-facing behaviour

With Slash snippets enabled, typing its trigger (`/` by default) and a snippet name on a task line shows Slash snippets' popup instead of Tasks' auto-suggest. As soon as whitespace follows the snippet name, Tasks' auto-suggest is back.

Examples with the trigger `/`, the cursor at the end of the text:

| Text before the cursor | Popup shown |
| --- | --- |
| `- [ ] Call Bob /tod` | Slash snippets (snippets matching `tod`) |
| `- [ ] Call Bob /` | Slash snippets (recently used snippets) |
| `- [ ] Call Bob /today` followed by a space | Tasks |
| `- [ ] Read https://example.com/page 📅` | Tasks: whitespace follows the last `/` |
| `- [ ] Read https://example.com/pa` | Usually none: Tasks steps aside, and Slash snippets finds no snippet named `pa` |
| Any of the above, Slash snippets disabled | Tasks, as upstream |

There is no setting. Nothing changes when Slash snippets is not installed or is disabled, and nothing else about Tasks changes.

## Requirements

1. Tasks' editor auto-suggest makes no suggestion (`EditorSuggestor.onTrigger` returns `null`) when all of these hold:
    - Slash snippets is enabled and loaded.
    - Its trigger setting (`slashTrigger`) is text that is neither empty nor only whitespace.
    - The text of the line before the cursor contains the trigger.
    - The text between the last occurrence of the trigger and the cursor contains no whitespace. No text at all (the cursor right after the trigger) counts as no whitespace.
2. In every other case Tasks' auto-suggest behaves exactly as upstream.
3. The plugin's enabled state and trigger are read each time Obsidian asks Tasks for suggestions, so enabling or disabling Slash snippets, or changing its trigger, takes effect without reloading Tasks.
4. Only the text before the cursor counts; text after the cursor is ignored.
5. Triggers longer than one character work. Slash snippets' settings screen allows one character, but its saved settings can hold more.
6. If Obsidian's plugin manager or Slash snippets' settings are missing or shaped differently (a future version of either), Tasks never steps aside and nothing throws.
7. Nothing is written to notes. The feature only changes which popup the desktop editor shows, so the same notes edited with vanilla Tasks elsewhere are unaffected.

Accepted consequences:

- While a URL or a date with slashes is typed (`https://example.com/pa`, `2026/10/17`), Tasks' auto-suggest stays quiet until the next whitespace. Slash snippets usually finds no matching snippet there, so no popup shows.
- A snippet whose name contains a space gets Slash snippets' popup only up to the space; after the space Tasks' popup takes over.

## Decisions

- **Make Tasks step aside, rather than change Slash snippets or the popup order.** Obsidian shows one editor suggest popup at a time and gives it to the first suggester whose `onTrigger` returns non-null. Tasks answers on almost every task line (property suggestions, plus the `⏎` entry when the minimum match setting is 0), so Slash snippets never got its turn there. Returning `null` from Tasks is the smallest change. Rejected: patching Slash snippets (a third-party plugin, it would need its own fork), and reordering suggesters (Obsidian has no API for it).
- **Detect the plugin and read its trigger from its live settings** (`app.plugins.enabledPlugins` and `app.plugins.plugins['slash-snippets'].settings.slashTrigger`), as the user preferred. Rejected: a fork setting holding the trigger (duplicates Slash snippets' own setting and can go stale); asking Slash snippets' suggester whether it has matching snippets (most precise, but calls another plugin's internals and Obsidian's private list of suggesters).
- **Step aside only until whitespace, chosen by the user.** Slash snippets itself triggers whenever the trigger appears anywhere before the cursor. Mirroring that exactly would switch off Tasks' auto-suggest for the rest of every task line with a URL or a date with slashes. Stopping at whitespace keeps Tasks' suggestions there and costs only snippet names with spaces. Rejected: stepping aside whenever the trigger is anywhere before the cursor.
- **An empty or whitespace-only trigger never steps aside**: it would match on every line and switch Tasks' auto-suggest off everywhere.
- **No setting to turn the feature off**: it acts only while Slash snippets is enabled, so disabling Slash snippets turns it off.
- **Code layout for cheap rebases**: the logic is in a new file, `src/Suggestor/SlashSnippetsStepAside.ts`, unit-tested in `tests/Suggestor/SlashSnippetsStepAside.test.ts`. The upstream file `src/Suggestor/EditorSuggestorPopup.ts` gets one import and one `if` in `EditorSuggestor.onTrigger`, after the check that the cursor is in a task description and before Tasks computes its suggestions.
