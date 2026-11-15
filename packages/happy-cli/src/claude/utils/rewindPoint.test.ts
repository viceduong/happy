import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findRewindPoint } from './rewindPoint';
import { getProjectPath } from './path';

const workingDirectory = join(tmpdir(), 'rewind-project');
const claudeSessionId = '11111111-1111-1111-1111-111111111111';

function writeTranscript(entries: object[]) {
    const dir = getProjectPath(workingDirectory);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${claudeSessionId}.jsonl`), entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

// Two turns: "first" -> answer, then "second" (with a tool round trip) -> answer.
const transcript = [
    { type: 'user', uuid: 'u1', parentUuid: null, message: { role: 'user', content: 'first' } },
    { type: 'assistant', uuid: 'a1', parentUuid: 'u1', message: { role: 'assistant', content: [{ type: 'text', text: 'one' }] } },
    { type: 'user', uuid: 'u2', parentUuid: 'a1', message: { role: 'user', content: [{ type: 'text', text: 'second' }] } },
    { type: 'assistant', uuid: 'a2', parentUuid: 'u2', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: {} }] } },
    { type: 'user', uuid: 'r2', parentUuid: 'a2', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } },
    { type: 'assistant', uuid: 'a3', parentUuid: 'r2', message: { role: 'assistant', content: [{ type: 'text', text: 'two' }] } },
];

describe('findRewindPoint', () => {
    let configDir: string;

    beforeEach(() => {
        configDir = mkdtempSync(join(tmpdir(), 'rewind-claude-'));
        process.env.CLAUDE_CONFIG_DIR = configDir;
        writeTranscript(transcript);
    });

    afterEach(() => {
        delete process.env.CLAUDE_CONFIG_DIR;
        rmSync(configDir, { recursive: true, force: true });
    });

    it('resumes at the last entry of the turn before the message', async () => {
        expect(await findRewindPoint({ workingDirectory, claudeSessionId, claudeUuid: 'u2' }))
            .toEqual({ userMessageUuid: 'u2', resumeAt: 'a1' });
    });

    it('finds a message typed in the app by its text when it has no uuid', async () => {
        expect(await findRewindPoint({ workingDirectory, claudeSessionId, text: '  second ' }))
            .toEqual({ userMessageUuid: 'u2', resumeAt: 'a1' });
    });

    it('starts over when rewinding to the first message', async () => {
        expect(await findRewindPoint({ workingDirectory, claudeSessionId, claudeUuid: 'u1' }))
            .toEqual({ userMessageUuid: 'u1', resumeAt: null });
    });

    it('never treats a tool result as a user message', async () => {
        expect(await findRewindPoint({ workingDirectory, claudeSessionId, claudeUuid: 'r2' })).toBeNull();
    });
});
