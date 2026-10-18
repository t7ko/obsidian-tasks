import moment from 'moment';
import {
    type DayFileKind,
    HISTORY_FOLDER,
    type HistoryFileSystem,
    comparableRecord,
    loadHistory,
    parseDay,
    saveDay,
    serializeDay,
} from '../../src/HorizonHistory/HistoryFiles';
import type { HistoryEntry, HistoryRecord } from '../../src/HorizonHistory/HistoryRecord';

window.moment = moment;

class FakeFileSystem implements HistoryFileSystem {
    public readonly files = new Map<string, string>();
    public readonly folders = new Set<string>();

    public async exists(path: string) {
        return this.files.has(path) || this.folders.has(path);
    }

    public async read(path: string) {
        const content = this.files.get(path);
        if (content === undefined) {
            throw new Error(`no file ${path}`);
        }
        return content;
    }

    public async write(path: string, data: string) {
        this.files.set(path, data);
    }

    public async mkdir(path: string) {
        this.folders.add(path);
    }

    public async list(path: string) {
        return { files: [...this.files.keys()].filter((file) => file.startsWith(path + '/')), folders: [] };
    }

    public addDay(day: string, kind: DayFileKind, records: HistoryRecord[]) {
        this.folders.add(HISTORY_FOLDER);
        this.files.set(`${HISTORY_FOLDER}/${day}.json`, serializeDay(day, kind, records.map(toEntry)));
    }
}

function toEntry(record: HistoryRecord): HistoryEntry {
    return { ...record, key: 'unused' };
}

function record(id: string, fields: Partial<HistoryRecord> = {}): HistoryRecord {
    return {
        id,
        path: 'notes.md',
        line: 3,
        text: `- [ ] Task ${id} 🔭 today`,
        horizon: 'today',
        status: 'open',
        planned: '2026-10-12',
        pushes: 0,
        since: '2026-10-02',
        ...fields,
    };
}

function summary(entries: HistoryEntry[]) {
    return entries
        .map((entry) => `${entry.id} ${entry.status}${entry.closedOn ? ' ' + entry.closedOn : ''} ${entry.text}`)
        .sort();
}

describe('day file content', () => {
    it('has one task per line, sorted by path and line', () => {
        const entries = [
            record('c', { path: 'b.md', line: 1, horizon: 'none', planned: undefined }),
            record('b', { line: 9, status: 'done', closed: '2026-10-17' }),
            record('a', { line: 2 }),
        ].map(toEntry);
        expect(serializeDay('2026-10-17', 'full', entries)).toEqual(
            [
                '{',
                '  "version": 2,',
                '  "date": "2026-10-17",',
                '  "kind": "full",',
                '  "tasks": [',
                '    {"id":"c","path":"b.md","line":1,"text":"- [ ] Task c 🔭 today","horizon":"none","status":"open","pushes":0,"since":"2026-10-02"},',
                '    {"id":"a","path":"notes.md","line":2,"text":"- [ ] Task a 🔭 today","horizon":"today","status":"open","planned":"2026-10-12","pushes":0,"since":"2026-10-02"},',
                '    {"id":"b","path":"notes.md","line":9,"text":"- [ ] Task b 🔭 today","horizon":"today","status":"done","closed":"2026-10-17","planned":"2026-10-12","pushes":0,"since":"2026-10-02"}',
                '  ]',
                '}',
                '',
            ].join('\n'),
        );
    });

    it('writes an empty day', () => {
        expect(serializeDay('2026-10-17', 'changes', [])).toEqual(
            '{\n  "version": 2,\n  "date": "2026-10-17",\n  "kind": "changes",\n  "tasks": []\n}\n',
        );
    });

    it('reads what it writes', () => {
        const records = [
            record('a'),
            record('b', { status: 'cancelled', closed: '2026-10-15', line: 5 }),
            record('c', { horizon: 'none', planned: undefined, line: 6 }),
        ];
        expect(parseDay(serializeDay('2026-10-17', 'changes', records.map(toEntry)))).toEqual({
            kind: 'changes',
            records: records.map((r) => JSON.parse(JSON.stringify(r))),
        });
    });

    it('reads a file of the first format as full', () => {
        const content = JSON.stringify({ version: 1, date: '2026-10-17', tasks: [record('a')] });
        expect(parseDay(content)).toEqual({ kind: 'full', records: [record('a')] });
    });

    it('skips malformed tasks', () => {
        const content = JSON.stringify({
            version: 2,
            date: '2026-10-17',
            kind: 'full',
            tasks: [record('a'), { ...record('b'), horizon: 'someday' }, { ...record('c'), planned: 'soon' }, 'x'],
        });
        expect(parseDay(content).records.map((r) => r.id)).toEqual(['a']);
    });

    it.each(['', '[]', '{"version": 3, "kind": "full", "tasks": []}', '{"version": 2, "tasks": []}', '{"version": 1}'])(
        'rejects %j',
        (content) => {
            expect(() => parseDay(content)).toThrow();
        },
    );

    it('compares records without their line', () => {
        expect(comparableRecord(record('a', { line: 3 }))).toEqual(comparableRecord(record('a', { line: 30 })));
        expect(comparableRecord(record('a'))).not.toEqual(comparableRecord(record('a', { pushes: 1 })));
    });
});

describe('loading the history', () => {
    it('is empty without a history folder', async () => {
        expect(await loadHistory(new FakeFileSystem(), '2026-10-17')).toEqual({
            entries: [],
            entriesBeforeToday: [],
            latestFullDay: null,
            hasTodayFile: false,
        });
    });

    it('takes the newest full file and the changes after it', async () => {
        const fileSystem = new FakeFileSystem();
        fileSystem.addDay('2026-10-12', 'full', [record('a'), record('b')]);
        fileSystem.addDay('2026-10-14', 'changes', [
            record('b', { status: 'done', closed: '2026-10-14' }),
            record('c', { text: 'c new' }),
        ]);
        fileSystem.addDay('2026-10-15', 'changes', [record('a', { text: 'a edited' })]);

        const loaded = await loadHistory(fileSystem, '2026-10-17');

        expect(loaded.latestFullDay).toEqual('2026-10-12');
        expect(loaded.hasTodayFile).toEqual(false);
        expect(summary(loaded.entries)).toEqual([
            'a open a edited',
            'b done 2026-10-14 - [ ] Task b 🔭 today',
            'c open c new',
        ]);
        expect(summary(loaded.entriesBeforeToday)).toEqual(summary(loaded.entries));
        expect(loaded.entries.find((entry) => entry.id === 'c')?.key).toEqual('c new');
    });

    it('takes recent closings from before the newest full file, and no open tasks from there', async () => {
        const fileSystem = new FakeFileSystem();
        fileSystem.addDay('2026-09-01', 'full', [record('too-old', { status: 'done', closed: '2026-09-01' })]);
        fileSystem.addDay('2026-10-05', 'changes', [
            record('done', { status: 'done', closed: '2026-10-05' }),
            record('gone'),
        ]);
        fileSystem.addDay('2026-10-12', 'full', [record('a')]);

        const loaded = await loadHistory(fileSystem, '2026-10-17');

        expect(summary(loaded.entries)).toEqual([
            'a open - [ ] Task a 🔭 today',
            'done done 2026-10-05 - [ ] Task done 🔭 today',
        ]);
    });

    it('falls back to an older full file if the newest is unreadable', async () => {
        const fileSystem = new FakeFileSystem();
        fileSystem.addDay('2026-10-10', 'full', [record('a')]);
        fileSystem.addDay('2026-10-11', 'changes', [record('b')]);
        fileSystem.files.set(`${HISTORY_FOLDER}/2026-10-12.json`, '{"version": 2, "tasks": [');
        fileSystem.addDay('2026-10-13', 'changes', [record('c')]);

        const loaded = await loadHistory(fileSystem, '2026-10-17');

        expect(loaded.latestFullDay).toEqual('2026-10-10');
        expect(loaded.entries.map((entry) => entry.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('applies every change file when there is no full file', async () => {
        const fileSystem = new FakeFileSystem();
        fileSystem.addDay('2026-10-10', 'changes', [record('a'), record('b')]);
        fileSystem.addDay('2026-10-11', 'changes', [record('b', { status: 'dropped', closed: '2026-10-11' })]);

        const loaded = await loadHistory(fileSystem, '2026-10-17');

        expect(loaded.latestFullDay).toBeNull();
        expect(summary(loaded.entries)).toEqual([
            'a open - [ ] Task a 🔭 today',
            'b dropped 2026-10-11 - [ ] Task b 🔭 today',
        ]);
    });

    it('keeps the state before today apart', async () => {
        const fileSystem = new FakeFileSystem();
        fileSystem.addDay('2026-10-12', 'full', [record('a')]);
        fileSystem.addDay('2026-10-17', 'changes', [record('a', { text: 'a edited' })]);

        const loaded = await loadHistory(fileSystem, '2026-10-17');

        expect(loaded.hasTodayFile).toEqual(true);
        expect(summary(loaded.entries)).toEqual(['a open a edited']);
        expect(summary(loaded.entriesBeforeToday)).toEqual(['a open - [ ] Task a 🔭 today']);
    });

    it('ignores files after today and other files', async () => {
        const fileSystem = new FakeFileSystem();
        fileSystem.addDay('2026-10-14', 'full', [record('a')]);
        fileSystem.addDay('2026-10-18', 'changes', [record('future')]);
        fileSystem.files.set(`${HISTORY_FOLDER}/notes.json`, '{}');

        const loaded = await loadHistory(fileSystem, '2026-10-17');

        expect(loaded.latestFullDay).toEqual('2026-10-14');
        expect(loaded.entries.map((entry) => entry.id)).toEqual(['a']);
    });
});

describe('saving a day', () => {
    it('creates the history folder and writes the file', async () => {
        const fileSystem = new FakeFileSystem();
        await saveDay(fileSystem, '2026-10-17', 'content');
        expect(fileSystem.folders.has(HISTORY_FOLDER)).toEqual(true);
        expect(fileSystem.files.get('.tasks-history/2026-10-17.json')).toEqual('content');
    });
});
