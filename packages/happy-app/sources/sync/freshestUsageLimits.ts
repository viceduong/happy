import type { AgentState, Session } from './storageTypes';

export type UsageLimitsSnapshot = NonNullable<AgentState['usageLimits']>;

/**
 * Plan limits are account-wide, but each session only carries the snapshot its
 * own agent reported during its last turn, so an idle session shows stale
 * numbers. Among the sessions on the same machine (the same Claude login, in
 * practice) take the most recently captured snapshot; without a machine id,
 * keep the session's own.
 */
export function pickFreshestUsageLimits(
    sessions: Iterable<Session>,
    machineId: string | null | undefined,
    own: UsageLimitsSnapshot | null,
): UsageLimitsSnapshot | null {
    if (!machineId) return own;
    let freshest = own;
    for (const session of sessions) {
        const limits = session.agentState?.usageLimits;
        if (!limits || session.metadata?.machineId !== machineId) continue;
        if (!freshest || limits.capturedAt > freshest.capturedAt) freshest = limits;
    }
    return freshest;
}

/**
 * A window whose reset time has passed has started over, whatever its last
 * reported utilization was: show it as unused, with the next reset unknown.
 */
export function resetExpiredUsageWindows(limits: UsageLimitsSnapshot | null, now: number): UsageLimitsSnapshot | null {
    if (!limits) return null;
    let changed = false;
    const windows = limits.windows.map((window) => {
        if (window.resetsAt == null || window.resetsAt > now) return window;
        changed = true;
        return { ...window, utilization: 0, status: 'allowed', resetsAt: null };
    });
    return changed ? { ...limits, windows } : limits;
}
