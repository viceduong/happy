/**
 * Hands text to a session's composer from elsewhere on the screen — "Rewind to
 * here" puts the rewound message back into the input so it can be edited and
 * sent again. The composer subscribes for its own session; a request with no
 * composer mounted lands in the stored draft, which the composer reads when it
 * mounts.
 */
import { storage } from './storage';

type Listener = (text: string) => void;

const listeners = new Map<string, Set<Listener>>();

export function requestComposerText(sessionId: string, text: string): void {
    const current = listeners.get(sessionId);
    if (current && current.size > 0) {
        for (const listener of current) listener(text);
        return;
    }
    storage.getState().updateSessionDraft(sessionId, text);
}

export function subscribeComposerText(sessionId: string, listener: Listener): () => void {
    let set = listeners.get(sessionId);
    if (!set) {
        set = new Set();
        listeners.set(sessionId, set);
    }
    set.add(listener);
    return () => {
        set!.delete(listener);
        if (set!.size === 0) listeners.delete(sessionId);
    };
}
