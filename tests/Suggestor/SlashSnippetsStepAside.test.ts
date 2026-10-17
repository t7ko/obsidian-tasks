import type { App } from 'obsidian';
import {
    SLASH_SNIPPETS_PLUGIN_ID,
    getSlashSnippetsTrigger,
    isTypingSlashSnippet,
    shouldStepAsideForSlashSnippets,
} from '../../src/Suggestor/SlashSnippetsStepAside';

interface FakePluginState {
    enabled: boolean;
    loaded: boolean;
    settings?: { slashTrigger?: unknown };
}

function makeApp({ enabled, loaded, settings }: FakePluginState): App {
    const enabledPlugins = new Set<string>(['some-other-plugin']);
    if (enabled) {
        enabledPlugins.add(SLASH_SNIPPETS_PLUGIN_ID);
    }
    const plugins: Record<string, object> = { 'some-other-plugin': {} };
    if (loaded) {
        plugins[SLASH_SNIPPETS_PLUGIN_ID] = { settings };
    }
    return { plugins: { enabledPlugins, plugins } } as unknown as App;
}

const enabledWithSlash = { enabled: true, loaded: true, settings: { slashTrigger: '/' } };

describe('isTypingSlashSnippet', () => {
    it.each([
        ['- [ ] Call Bob /', true],
        ['- [ ] Call Bob /tod', true],
        ['- [ ] /tod', true],
        ['- [ ] /ударе', true],
        ['- [ ] Pay 2026/10/17', true],
        ['- [ ] a/b and /tod', true],
        ['- [ ] Read https://example.com/pa', true],
        ['- [ ] Call Bob', false],
        ['', false],
        ['- [ ] Call Bob / ', false],
        ['- [ ] Call /tod\t', false],
        ['- [ ] Call /tod x', false],
        ['- [ ] Read https://example.com/page ', false],
        ['- [ ] Read https://example.com/page 📅 ', false],
    ])('with trigger "/", line before cursor "%s" -> %s', (lineBeforeCursor: string, expected: boolean) => {
        expect(isTypingSlashSnippet(lineBeforeCursor, '/')).toEqual(expected);
    });

    it.each([
        [';', '- [ ] Call Bob ;tod', true],
        [';', '- [ ] Call Bob /tod', false],
        [';;', '- [ ] Call Bob ;;tod', true],
        [';;', '- [ ] Call Bob ;; tod', false],
        [';;', '- [ ] Call Bob ;tod', false],
    ])(
        'with trigger "%s", line before cursor "%s" -> %s',
        (trigger: string, lineBeforeCursor: string, expected: boolean) => {
            expect(isTypingSlashSnippet(lineBeforeCursor, trigger)).toEqual(expected);
        },
    );

    it.each([
        ['undefined (plugin not enabled)', undefined],
        ['empty', ''],
        ['a space', ' '],
        ['a tab', '\t'],
    ])('never steps aside when the trigger is %s', (_description: string, trigger: string | undefined) => {
        expect(isTypingSlashSnippet('- [ ] Call Bob /tod', trigger)).toEqual(false);
        expect(isTypingSlashSnippet('- [ ] Call Bob', trigger)).toEqual(false);
    });
});

describe('getSlashSnippetsTrigger', () => {
    it('reads the trigger from the enabled plugin', () => {
        expect(getSlashSnippetsTrigger(makeApp(enabledWithSlash))).toEqual('/');
    });

    it('reads the current trigger each time, so changing the setting needs no reload', () => {
        const settings = { slashTrigger: '/' };
        const app = makeApp({ enabled: true, loaded: true, settings });
        expect(getSlashSnippetsTrigger(app)).toEqual('/');

        settings.slashTrigger = ';';
        expect(getSlashSnippetsTrigger(app)).toEqual(';');
    });

    it.each([
        ['installed but disabled', { enabled: false, loaded: true, settings: { slashTrigger: '/' } }],
        ['enabled but not loaded yet', { enabled: true, loaded: false }],
        ['loaded without settings', { enabled: true, loaded: true }],
        ['without a trigger setting', { enabled: true, loaded: true, settings: {} }],
        ['with a trigger that is not text', { enabled: true, loaded: true, settings: { slashTrigger: 47 } }],
    ])('gives undefined when the plugin is %s', (_description: string, state: FakePluginState) => {
        expect(getSlashSnippetsTrigger(makeApp(state))).toBeUndefined();
    });

    it('gives undefined when the plugin manager is missing', () => {
        expect(getSlashSnippetsTrigger({} as unknown as App)).toBeUndefined();
    });
});

describe('shouldStepAsideForSlashSnippets', () => {
    const line = '- [ ] Call Bob /tod about the report';
    const cursorAfterSnippetName = '- [ ] Call Bob /tod'.length;

    it('steps aside while a snippet name is typed before the cursor', () => {
        expect(shouldStepAsideForSlashSnippets(makeApp(enabledWithSlash), line, cursorAfterSnippetName)).toEqual(true);
    });

    it('only looks at the text before the cursor', () => {
        expect(shouldStepAsideForSlashSnippets(makeApp(enabledWithSlash), line, line.length)).toEqual(false);
        expect(shouldStepAsideForSlashSnippets(makeApp(enabledWithSlash), line, '- [ ] Call'.length)).toEqual(false);
    });

    it('does not step aside when Slash snippets is disabled', () => {
        const app = makeApp({ ...enabledWithSlash, enabled: false });
        expect(shouldStepAsideForSlashSnippets(app, line, cursorAfterSnippetName)).toEqual(false);
    });
});
