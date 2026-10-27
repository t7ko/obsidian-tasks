# Jump anchor

A note that collects entries (a log, an inbox, a running list) often has one place where new items go, and it is not always the end of the note. Mark that place by putting the block ID `^jump-anchor` on a line, and two commands bring the cursor there: one to look, one to add an entry.

## User-facing behaviour

```text
## Inbox

- [ ] Call Bob ^jump-anchor
- [ ] Older item
```

- **Go to jump anchor** (default hotkey Ctrl+J, Cmd+J on a Mac) puts the cursor at the end of the `^jump-anchor` line, after the block ID, and scrolls it into view.
- **New entry at jump anchor** (default hotkey Ctrl+Shift+J, Cmd+Shift+J on a Mac) does the same and then acts as if Enter was pressed: a new list item starts right under the anchor line, with the same indentation and list marker, and an empty checkbox if the anchor line has a checkbox. The cursor is on it, ready for typing:

```text
- [ ] Call Bob ^jump-anchor
- [ ] |
- [ ] Older item
```

- Both are commands under Tasks in the command palette. The hotkeys can be changed or removed in Settings > Hotkeys.
- If the note has no `^jump-anchor`, the cursor stays where it is and a notice says `No ^jump-anchor in this note`.
- New entries go under the anchor, so the anchor stays on the line it was put on, and the newest entry is the one right under it.

## Requirements

1. The anchor is the block ID `^jump-anchor`, spelled exactly so, at the end of a line after a space (trailing spaces allowed), as Obsidian writes block IDs. The line may be any line; the anchor is meant for checkbox items.
2. With several anchors in a note, the first one counts.
3. Go to jump anchor only moves the cursor (to the end of the line) and scrolls; the note is not changed.
4. New entry at jump anchor inserts one line right after the anchor line, as one edit (Ctrl+Z undoes it). The block ID stays on the anchor line. The new line is:
   - for a checkbox item: the anchor line's indentation (spaces, tabs, `>` of a quote), its list marker and the spaces after it, then an empty checkbox `[ ]` and a space, whatever the anchor's own status is;
   - for a plain list item: the same without the checkbox;
   - for a numbered item (`3.` or `3)`): the next number, with the same punctuation; later numbers are not renumbered;
   - for any other line: the anchor line's indentation only (an empty line in plain text).
5. Nested items under the anchor stay where they are: the new line goes directly under the anchor line, before them, as Enter would put it.
6. The commands work in the editor (Live Preview and Source mode), on the active note.

## Decisions

- **A fixed name, `^jump-anchor`.** It is the user's convention, and a fixed name needs no setting and no choice when a note has other block IDs. Rejected: any block ID, or a picker for several anchors.
- **The cursor goes after the block ID.** Pressing Enter there keeps the ID on the anchor line; with the cursor before the ID, Enter would move the ID to the new line.
- **New entries go below the anchor, directly under its line.** That is what Enter at the anchor does, so the two commands agree with what the user would do by hand. Rejected: above the anchor (keeps entries in date order, but is not what Enter does), after the anchor's nested items.
- **The new line is built by the fork, not by sending Enter to the editor.** Obsidian's list continuation on Enter is not part of its plugin API, so the result would depend on the editor's version. Building the line from the anchor's own prefix gives the same result Enter gives for list items, and it can be tested.
- **Default hotkeys.** Obsidian advises plugins against them, since they can clash with the user's own; this fork is for one user, whose hotkeys were checked to be free (2026-10-27). The user's own bindings in Settings > Hotkeys still win.
- **Commands only.** Rejected: moving the cursor to the anchor whenever a note opens. It would fight Obsidian's own restoring of the last cursor position and links to headings or blocks.

Vanilla Tasks (for example on a phone syncing the same notes) never sees the commands; `^jump-anchor` is an ordinary Obsidian block ID, and the new entries are ordinary lines.
