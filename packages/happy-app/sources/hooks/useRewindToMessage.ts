import * as React from 'react';
import { Modal } from '@/modal';
import { sessionRewind } from '@/sync/ops';
import { requestComposerText } from '@/sync/composerPrefill';
import { storage } from '@/sync/storage';
import type { UserTextMessage } from '@/sync/typesMessage';
import { isRigMetadata } from '@/sync/rig';
import { t } from '@/text';

/**
 * "Rewind to here" on one of the user's own messages: the conversation goes
 * back to just before it, the message and everything after it leave the chat,
 * and its text returns to the input to be edited and sent again. One choice
 * is asked for — whether Claude's file edits since then are undone too.
 *
 * Returns undefined where rewinding cannot work (not a Claude session, or a
 * Happy Agent session), so callers simply leave the menu item out.
 */
export function useRewindToMessage(sessionId: string): ((message: UserTextMessage, text: string) => void) | undefined {
    const metadata = storage((state) => state.sessions[sessionId]?.metadata);
    const supported = !!metadata && (!metadata.flavor || metadata.flavor === 'claude') && !isRigMetadata(metadata);

    const rewind = React.useCallback(async (message: UserTextMessage, text: string, undoFiles: boolean) => {
        const result = await sessionRewind(sessionId, {
            claudeUuid: message.claudeUuid,
            text,
            fromAt: message.createdAt,
            undoFiles,
        });
        if (!result.ok) {
            Modal.alert(t('session.rewindFailedTitle'), result.error ?? t('session.rewindNeedsRunning'));
            return;
        }
        requestComposerText(sessionId, text);
        if (undoFiles && result.files && !result.files.canRewind) {
            Modal.alert(t('session.rewindCodeNotUndoneTitle'), result.files.error ?? t('session.rewindCodeNotUndone'));
        }
    }, [sessionId]);

    const start = React.useCallback((message: UserTextMessage, text: string) => {
        Modal.alert(t('session.rewindTitle'), t('session.rewindMessage'), [
            { text: t('session.rewindConversation'), onPress: () => { void rewind(message, text, false); } },
            { text: t('session.rewindAndUndoCode'), onPress: () => { void rewind(message, text, true); } },
            { text: t('common.cancel'), style: 'cancel' },
        ]);
    }, [rewind]);

    return supported ? start : undefined;
}
