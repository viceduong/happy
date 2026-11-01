import type { Session } from './storageTypes';

/**
 * Sessions that are older copies of the same agent conversation.
 *
 * `happy --resume`, `happy -c` and `happy claude --resume <id>` start a new
 * Happy session for a conversation that already has one, so the list showed
 * the same chat several times. A conversation is identified by the agent's own
 * id (Claude session id, Codex thread id); of its sessions only the most recent
 * stays in the list: an active one over an inactive one, then the latest
 * activity. Side chats and bots are left alone.
 */
export function findSupersededSessionIds(sessions: Iterable<Session>): Set<string> {
    const latest = new Map<string, Session>();
    const superseded = new Set<string>();
    for (const session of sessions) {
        const key = conversationKey(session);
        if (!key) continue;
        const current = latest.get(key);
        if (!current) {
            latest.set(key, session);
        } else if (isNewer(session, current)) {
            superseded.add(current.id);
            latest.set(key, session);
        } else {
            superseded.add(session.id);
        }
    }
    return superseded;
}

function conversationKey(session: Session): string | null {
    const metadata = session.metadata;
    if (!metadata || metadata.isSideChat || metadata.bot) return null;
    if (metadata.claudeSessionId) return `claude:${metadata.claudeSessionId}`;
    if (metadata.codexThreadId) return `codex:${metadata.codexThreadId}`;
    return null;
}

function isNewer(candidate: Session, current: Session): boolean {
    if (candidate.active !== current.active) return candidate.active;
    return Math.max(candidate.activeAt, candidate.updatedAt) > Math.max(current.activeAt, current.updatedAt);
}
