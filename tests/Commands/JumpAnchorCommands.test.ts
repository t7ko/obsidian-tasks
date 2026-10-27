/**
 * t7 fork feature: jump anchor. Spec: fork-features/jump-anchor.md
 */
import type { Editor, EditorPosition, Plugin } from 'obsidian';
import {
    findJumpAnchor,
    goToJumpAnchor,
    newEntryPrefix,
    registerJumpAnchorCommands,
} from '../../src/Commands/JumpAnchorCommands';

/**
 * An editor holding {@link lines}, with the cursor at {@link cursor}; replaceRange() edits the lines.
 */
function fakeEditor(lines: string[], cursor: EditorPosition = { line: 0, ch: 0 }) {
    const state = { lines, cursor, scrolledTo: null as EditorPosition | null };
    const editor = {
        lineCount: () => lines.length,
        getLine: (n: number) => lines[n],
        replaceRange: (text: string, from: EditorPosition) => {
            const line = lines[from.line];
            lines.splice(from.line, 1, ...(line.slice(0, from.ch) + text + line.slice(from.ch)).split('\n'));
        },
        setCursor: (pos: EditorPosition) => (state.cursor = pos),
        scrollIntoView: (range: { from: EditorPosition }) => (state.scrolledTo = range.from),
        focus: () => {},
    };
    return { editor: editor as unknown as Editor, state };
}

const note = ['## Inbox', '', '- [ ] Call Bob ^jump-anchor', '    - [ ] Nested', '- [ ] Older item'];

describe('findJumpAnchor', () => {
    it('should find the first anchor line', () => {
        const { editor } = fakeEditor(['a', '- [ ] one ^jump-anchor  ', '- [ ] two ^jump-anchor']);
        expect(findJumpAnchor(editor)).toEqual(1);
    });

    it.each(['- [ ] Call Bob', '- [ ] Call Bob ^jump-anchor-2', '- [ ] Call Bob^jump-anchor', '^jump-anchor x'])(
        'should not take "%s" for an anchor',
        (line: string) => {
            expect(findJumpAnchor(fakeEditor([line]).editor)).toBeNull();
        },
    );
});

describe('newEntryPrefix', () => {
    it.each([
        ['- [ ] Call Bob ^jump-anchor', '- [ ] '],
        ['- [x] Done ✅ 2026-10-27 ^jump-anchor', '- [ ] '],
        ['\t\t* [/] Nested ^jump-anchor', '\t\t* [ ] '],
        ['> + [ ] Quoted ^jump-anchor', '> + [ ] '],
        ['-   [ ] Wide ^jump-anchor', '-   [ ] '],
        ['9. [ ] Numbered ^jump-anchor', '10. [ ] '],
        ['  3) [-] Numbered ^jump-anchor', '  4) [ ] '],
    ])('should continue "%s" with "%s"', (line: string, expected: string) => {
        expect(newEntryPrefix(line)).toEqual(expected);
    });

    it.each(['- Plain ^jump-anchor', '3. Numbered ^jump-anchor', 'Some text ^jump-anchor', '## Heading ^jump-anchor'])(
        'should not continue "%s", which has no checkbox',
        (line: string) => {
            expect(newEntryPrefix(line)).toBeNull();
        },
    );
});

describe('goToJumpAnchor', () => {
    it('should put the cursor after the anchor and change nothing', () => {
        const { editor, state } = fakeEditor([...note]);
        goToJumpAnchor(editor, false);

        expect(state.lines).toEqual(note);
        expect(state.cursor).toEqual({ line: 2, ch: note[2].length });
        expect(state.scrolledTo).toEqual(state.cursor);
    });

    it('should start a new entry directly under the anchor line', () => {
        const { editor, state } = fakeEditor([...note]);
        goToJumpAnchor(editor, true);

        expect(state.lines).toEqual([
            '## Inbox',
            '',
            '- [ ] Call Bob ^jump-anchor',
            '- [ ] ',
            '    - [ ] Nested',
            '- [ ] Older item',
        ]);
        expect(state.cursor).toEqual({ line: 3, ch: 6 });
        expect(state.scrolledTo).toEqual(state.cursor);
    });

    it.each(['- Plain ^jump-anchor', 'Some text ^jump-anchor'])(
        'should go to the anchor "%s" without a checkbox, adding nothing',
        (anchor: string) => {
            const lines = ['# Heading', anchor, 'next'];
            const { editor, state } = fakeEditor([...lines]);
            goToJumpAnchor(editor, true);

            expect(state.lines).toEqual(lines);
            expect(state.cursor).toEqual({ line: 1, ch: anchor.length });
            expect(state.scrolledTo).toEqual(state.cursor);
        },
    );

    it('should leave the note and cursor alone without an anchor', () => {
        const lines = ['- [ ] Call Bob', '- [ ] Older item'];
        const { editor, state } = fakeEditor([...lines], { line: 1, ch: 3 });
        goToJumpAnchor(editor, true);

        expect(state.lines).toEqual(lines);
        expect(state.cursor).toEqual({ line: 1, ch: 3 });
        expect(state.scrolledTo).toBeNull();
    });
});

describe('Jump anchor commands', () => {
    function registeredCommands() {
        const commands: any[] = [];
        const plugin = { addCommand: (c: unknown) => commands.push(c) };
        registerJumpAnchorCommands(plugin as unknown as Plugin);
        return commands;
    }

    it('should register both commands with their default hotkeys', () => {
        expect(registeredCommands().map((c) => [c.id, c.name, c.hotkeys])).toEqual([
            ['go-to-jump-anchor', 'Go to jump anchor', [{ modifiers: ['Mod'], key: 'J' }]],
            ['new-entry-at-jump-anchor', 'New entry at jump anchor', [{ modifiers: ['Mod', 'Shift'], key: 'J' }]],
        ]);
    });

    it('should add an entry from the second command', () => {
        const { editor, state } = fakeEditor([...note]);
        registeredCommands()[1].editorCallback(editor);

        expect(state.lines[3]).toEqual('- [ ] ');
    });
});
