# Smoke test

A quick manual check after rebasing the fork onto a new upstream release, once the new build is installed and Obsidian has reloaded it. One vault is enough. Each fork feature gets one step; the unit tests and specs cover the details.

1. **Right build.** Settings > Community plugins: the Tasks entry shows the new version. If it still shows the old one, restart Obsidian.
2. **Slash snippets step-aside** ([spec](slash-snippets-step-aside.md)). With Slash snippets enabled, type `- [ ] smoke /` on a new line: Slash snippets' popup shows, not Tasks'. Type a space and `due`: Tasks' popup offers a due date. Delete the line.
3. **Multi-step tasks** ([spec](multi-step-tasks.md)). On a new line type `- [ ] smoke ste` and pick `🪜 steps` from Tasks' popup, then type `one // two`. Click the checkbox: `one` is struck through and the task stays unchecked. Click it again: the task is checked with a done date. Delete the line.
4. **Priority menu** ([spec](priority-menu.md)). On a new line type `- [ ] smoke` and switch to Reading mode: a faint ⏺️ shows after `smoke`. Right-click it and choose `Priority: High`: the line gets ⏫. Click the ⏫ and choose `Priority: Normal`: the ⏫ is gone and ⏺️ is back. Go back to editing and delete the line.

If a step fails, go back to the last good build before investigating.

## Adding a feature

The commit that adds a feature adds its step here: the shortest check that shows the feature is alive, one action and one thing to look at. Keep the list in the order the features were added.
