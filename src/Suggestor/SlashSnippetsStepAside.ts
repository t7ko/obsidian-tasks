import type { App } from 'obsidian';

/**
 * t7 fork: let the Slash snippets plugin show its popup on task lines.
 *
 * Obsidian shows one editor suggest popup at a time, and Tasks' auto-suggest answers on
 * almost every task line, so Slash snippets never got a chance there. Tasks now steps
 * aside while the user is typing a snippet name: right after the Slash snippets trigger,
 * before any whitespace.
 *
 * Spec: fork-features/slash-snippets-step-aside.md
 */

export const SLASH_SNIPPETS_PLUGIN_ID = 'slash-snippets';

/**
 * The parts of Obsidian's (undocumented) plugin manager and of the Slash snippets plugin
 * that are read here. Everything is optional, so a change in either degrades to "don't step aside".
 */
interface AppWithPlugins {
    plugins?: {
        enabledPlugins?: Set<string>;
        plugins?: Record<string, { settings?: { slashTrigger?: unknown } } | undefined>;
    };
}

/**
 * The trigger text from the Slash snippets settings, read live,
 * or `undefined` if the plugin is not installed, not enabled or not loaded.
 */
export function getSlashSnippetsTrigger(app: App): string | undefined {
    const pluginManager = (app as unknown as AppWithPlugins).plugins;
    if (!pluginManager?.enabledPlugins?.has(SLASH_SNIPPETS_PLUGIN_ID)) {
        return undefined;
    }

    const trigger = pluginManager.plugins?.[SLASH_SNIPPETS_PLUGIN_ID]?.settings?.slashTrigger;
    return typeof trigger === 'string' ? trigger : undefined;
}

/**
 * True if the user is typing a snippet name: the text before the cursor contains the trigger,
 * and there is no whitespace between the last trigger and the cursor.
 *
 * An empty or whitespace-only trigger never counts, as it would silence Tasks' auto-suggest everywhere.
 *
 * @param lineBeforeCursor The text of the line from its start up to the cursor.
 * @param trigger The Slash snippets trigger, or `undefined` if the plugin is not enabled.
 */
export function isTypingSlashSnippet(lineBeforeCursor: string, trigger: string | undefined): boolean {
    if (trigger === undefined || trigger.trim() === '') {
        return false;
    }

    const triggerIndex = lineBeforeCursor.lastIndexOf(trigger);
    if (triggerIndex === -1) {
        return false;
    }

    const snippetName = lineBeforeCursor.slice(triggerIndex + trigger.length);
    return !/\s/.test(snippetName);
}

/**
 * True if Tasks' auto-suggest should make no suggestions, so that Slash snippets can show its popup.
 *
 * @param app The Obsidian app, to find the Slash snippets plugin.
 * @param line The whole text of the line the cursor is on.
 * @param cursorCh The cursor position in that line.
 */
export function shouldStepAsideForSlashSnippets(app: App, line: string, cursorCh: number): boolean {
    return isTypingSlashSnippet(line.slice(0, cursorCh), getSlashSnippetsTrigger(app));
}
