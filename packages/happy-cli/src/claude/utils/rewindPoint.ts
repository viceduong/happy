/**
 * Locates where a "Rewind to here" lands in a Claude transcript.
 *
 * The app names the user message it wants to go back to, by its Claude uuid
 * when it has one and by its text otherwise (messages typed in the app reach
 * the server before Claude has assigned a uuid). Rewinding drops that message
 * and everything after it, so the conversation resumes at the message's parent:
 * the last chain entry of the turn before it. A message with no parent was the
 * first one, and rewinding to it means starting the conversation over.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getProjectPath } from './path';

export type RewindPoint = {
    /** Uuid of the user message being rewound; file snapshots are keyed by it. */
    userMessageUuid: string;
    /** Chain entry to resume at, or null to start a fresh conversation. */
    resumeAt: string | null;
};

type TranscriptEntry = {
    type?: string;
    uuid?: string;
    parentUuid?: string | null;
    isSidechain?: boolean;
    isMeta?: boolean;
    message?: { role?: string; content?: unknown };
};

function promptText(entry: TranscriptEntry): string | null {
    if (entry.type !== 'user' || entry.isSidechain || entry.isMeta || entry.message?.role !== 'user') return null;
    const content = entry.message.content;
    if (typeof content === 'string') return content;
    if (!Array.isArray(content) || content.some((block) => block?.type === 'tool_result')) return null;
    const text = content.filter((block) => block?.type === 'text').map((block) => block.text).join('\n');
    return text.length > 0 ? text : null;
}

export async function findRewindPoint(opts: {
    workingDirectory: string;
    claudeSessionId: string;
    claudeUuid?: string;
    text?: string;
}): Promise<RewindPoint | null> {
    const file = await readFile(join(getProjectPath(opts.workingDirectory), `${opts.claudeSessionId}.jsonl`), 'utf-8');
    const prompts: (TranscriptEntry & { text: string })[] = [];
    for (const line of file.split('\n')) {
        if (!line.trim()) continue;
        let entry: TranscriptEntry;
        try {
            entry = JSON.parse(line);
        } catch {
            continue;
        }
        const text = promptText(entry);
        if (text !== null && entry.uuid) prompts.push({ ...entry, text });
    }

    const wanted = opts.text?.trim();
    const match = (opts.claudeUuid ? prompts.find((p) => p.uuid === opts.claudeUuid) : undefined)
        ?? (wanted ? [...prompts].reverse().find((p) => p.text.trim() === wanted) : undefined);
    if (!match?.uuid) return null;
    return { userMessageUuid: match.uuid, resumeAt: match.parentUuid ?? null };
}
