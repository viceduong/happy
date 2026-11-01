import * as React from 'react';

import { sessionAllow, sessionDeny } from '@/sync/ops';
import { ToolViewProps } from './_all';
import {
    InlineQuestionForm,
    type InlineQuestion,
    type InlineQuestionAnswers,
    type InlineQuestionCustomAnswers,
} from './InlineQuestionForm';

interface AskUserQuestionInput {
    questions?: Array<{
        question: string;
        header: string;
        options: Array<{ label: string; description?: string }>;
        multiSelect?: boolean;
    }>;
}

export const AskUserQuestionView = React.memo<ToolViewProps>(({ tool, sessionId }) => {
    const input = tool.input as AskUserQuestionInput | undefined;
    const questions = React.useMemo<InlineQuestion[]>(() => (
        (input?.questions ?? []).map((question, index) => ({
            ...question,
            id: `question-${index}`,
            required: true,
        }))
    ), [input?.questions]);

    const handleSubmit = React.useCallback(async (answers: InlineQuestionAnswers, customAnswers: InlineQuestionCustomAnswers) => {
        if (!sessionId || !tool.permission?.id) return;

        const providerAnswers: Record<string, string> = {};
        questions.forEach((question, index) => {
            const originalQuestion = input?.questions?.[index];
            // The user's own answer reads as one more chosen value.
            const values = [...(answers[question.id] ?? []), ...(customAnswers[question.id] ? [customAnswers[question.id]] : [])];
            if (originalQuestion && values.length) {
                providerAnswers[originalQuestion.question] = values.join(', ');
            }
        });

        // Claude resolves AskUserQuestion through its permission callback and
        // expects the chosen values merged into the tool input.
        await sessionAllow(
            sessionId,
            tool.permission.id,
            undefined,
            undefined,
            'approved',
            { answers: providerAnswers },
        );
    }, [input?.questions, questions, sessionId, tool.permission?.id]);

    // A declined question is an ordinary denied permission: Claude gets the
    // CLI's rejection, stops, and waits for the user's next message.
    const handleCancel = React.useCallback(async () => {
        if (!sessionId || !tool.permission?.id) return;
        await sessionDeny(sessionId, tool.permission.id);
    }, [sessionId, tool.permission?.id]);

    if (questions.length === 0) return null;

    const declined = tool.permission?.status === 'denied' || tool.permission?.status === 'canceled';

    return (
        <InlineQuestionForm
            questions={questions}
            canInteract={tool.state === 'running'}
            submittedAnswers={tool.state === 'completed' || declined ? {} : undefined}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
        />
    );
});