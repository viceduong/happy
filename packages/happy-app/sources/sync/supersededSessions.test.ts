import { describe, expect, it } from 'vitest';

import { findSupersededSessionIds } from './supersededSessions';
import type { Session } from './storageTypes';

function session(id: string, fields: { active?: boolean; activeAt?: number; updatedAt?: number; metadata?: Record<string, unknown> | null }): Session {
    return {
        id,
        active: fields.active ?? false,
        activeAt: fields.activeAt ?? 0,
        updatedAt: fields.updatedAt ?? 0,
        metadata: fields.metadata === undefined ? { path: '/p', host: 'h' } : fields.metadata,
    } as unknown as Session;
}

describe('findSupersededSessionIds', () => {
    it('keeps the active session of a resumed Claude conversation', () => {
        const old = session('old', { active: false, updatedAt: 20, metadata: { claudeSessionId: 'c1' } });
        const resumed = session('resumed', { active: true, updatedAt: 10, metadata: { claudeSessionId: 'c1' } });
        expect([...findSupersededSessionIds([old, resumed])]).toEqual(['old']);
    });

    it('keeps the most recent one when both are active', () => {
        const a = session('a', { active: true, activeAt: 100, metadata: { claudeSessionId: 'c1' } });
        const b = session('b', { active: true, activeAt: 200, metadata: { claudeSessionId: 'c1' } });
        const c = session('c', { active: true, activeAt: 150, metadata: { claudeSessionId: 'c1' } });
        expect(findSupersededSessionIds([a, b, c])).toEqual(new Set(['a', 'c']));
    });

    it('groups Codex threads separately from Claude sessions', () => {
        const claude = session('claude', { active: true, metadata: { claudeSessionId: 'x' } });
        const codex = session('codex', { active: true, metadata: { codexThreadId: 'x' } });
        expect(findSupersededSessionIds([claude, codex]).size).toBe(0);
    });

    it('leaves sessions without a conversation id, side chats and bots alone', () => {
        const plain = session('plain', { active: true });
        const noMeta = session('noMeta', { metadata: null });
        const side = session('side', { metadata: { claudeSessionId: 'c1', isSideChat: true } });
        const bot = session('bot', { metadata: { claudeSessionId: 'c1', bot: true } });
        const parent = session('parent', { active: true, metadata: { claudeSessionId: 'c1' } });
        expect(findSupersededSessionIds([plain, noMeta, side, bot, parent]).size).toBe(0);
    });
});
