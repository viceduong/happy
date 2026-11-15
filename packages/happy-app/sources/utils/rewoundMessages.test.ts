import { describe, expect, it } from 'vitest';
import { hideRewoundMessages } from './rewoundMessages';
import type { Message } from '@/sync/typesMessage';

const at = (id: string, createdAt: number) => ({ id, createdAt }) as unknown as Message;

describe('hideRewoundMessages', () => {
    const messages = [at('a', 100), at('b', 200), at('c', 300), at('d', 400)];

    it('keeps everything when the session was never rewound', () => {
        expect(hideRewoundMessages(messages, undefined)).toBe(messages);
    });

    it('hides the rewound message and what followed it, up to the rewind', () => {
        expect(hideRewoundMessages(messages, [{ fromAt: 200, toAt: 350 }]).map((m) => m.id)).toEqual(['a', 'd']);
    });

    it('applies every rewind of the session', () => {
        expect(hideRewoundMessages(messages, [{ fromAt: 100, toAt: 150 }, { fromAt: 300, toAt: 300 }]).map((m) => m.id)).toEqual(['b', 'd']);
    });
});
