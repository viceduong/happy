import type { Session } from '@/sync/storageTypes';

/**
 * The timestamp the session list sorts on.
 *
 * Prefers `metadata.lastMeaningfulMessageAt`, which the agent publishes and
 * every device therefore agrees on. Agents that do not write it yet (the
 * released CLI does not) fall back to the later of `lastMessageSentAt` — this
 * device's own record of the last message it sent — and, for a session that
 * is no longer running, the server's `activeAt`: the last time its process was
 * alive. Without it a session driven from the terminal or another device sorts
 * by its creation date, however recently it was used. A running session's
 * `activeAt` moves on every heartbeat, so it is left out there.
 *
 * Kept apart from sessionUtils, which reaches for React and the translation
 * table; this is plain arithmetic over stored fields.
 */
export function getSessionActivityAt(session: Session): number {
    return session.metadata?.lastMeaningfulMessageAt
        ?? Math.max(session.lastMessageSentAt ?? 0, session.active ? 0 : session.activeAt, session.createdAt);
}
