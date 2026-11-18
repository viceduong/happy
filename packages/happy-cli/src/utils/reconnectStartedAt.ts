/**
 * When the resume of a session began: messages created before it belong to
 * the process that ran the session before, messages after it to this one.
 * The daemon stamps HAPPY_RECONNECT_AT when it handles the resume request;
 * without it, this process's own start stands in.
 */
const processStartedAt = Date.now();

export function reconnectStartedAt(env: NodeJS.ProcessEnv = process.env): number {
    const stamped = Number(env.HAPPY_RECONNECT_AT);
    return Number.isFinite(stamped) && stamped > 0 ? stamped : processStartedAt;
}
