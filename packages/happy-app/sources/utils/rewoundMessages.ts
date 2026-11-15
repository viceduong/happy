import type { Message } from '@/sync/typesMessage';

export type RewindRange = { fromAt: number; toAt: number };

/**
 * Drops the messages a "Rewind to here" took back. Each rewind records the
 * time span from the rewound message to the moment of the rewind; anything
 * created inside a span is no longer part of the conversation. The messages
 * stay on the server — this only decides what the chat shows.
 */
export function hideRewoundMessages(messages: Message[], rewinds: RewindRange[] | undefined): Message[] {
    if (!rewinds || rewinds.length === 0) return messages;
    return messages.filter((message) => !rewinds.some((r) => message.createdAt >= r.fromAt && message.createdAt <= r.toAt));
}
