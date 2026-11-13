import { describe, expect, it, vi } from 'vitest';

vi.mock('@/text', () => ({ t: (key: string) => key }));

import { getSessionName } from './sessionUtils';
import type { Session } from '@/sync/storageTypes';

function sessionWith(metadata: Partial<NonNullable<Session['metadata']>>): Session {
    return {
        id: 's1',
        seq: 0,
        createdAt: 0,
        updatedAt: 0,
        active: false,
        activeAt: 0,
        metadata: { path: '/project', host: 'host', ...metadata },
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 0,
        thinking: false,
        thinkingAt: 0,
        presence: 0,
    };
}

describe('getSessionName', () => {
    it('prefers the name the user gave over the agent summary', () => {
        const session = sessionWith({ customTitle: 'Release prep', summary: { text: 'Fix the build', updatedAt: 1 } });
        expect(getSessionName(session)).toBe('Release prep');
    });

    it('falls back to the summary when the custom name is blank', () => {
        const session = sessionWith({ customTitle: '   ', summary: { text: 'Fix the build', updatedAt: 1 } });
        expect(getSessionName(session)).toBe('Fix the build');
    });

    it('uses the new-chat label without a name or summary', () => {
        expect(getSessionName(sessionWith({}))).toBe('session.newChat');
    });
});
