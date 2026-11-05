import { storage } from '@/sync/storage';
import type { Session } from '@/sync/storageTypes';
import { pickFreshestUsageLimits, resetExpiredUsageWindows, type UsageLimitsSnapshot } from '@/sync/freshestUsageLimits';

/**
 * Plan limits to show for a session: the newest snapshot reported by any
 * session on the same machine (the account-wide quota is the same for all of
 * them, but each only refreshes its own copy while it works), with windows past
 * their reset time shown as reset. The selector returns a stored snapshot, so
 * the component only re-renders when the chosen snapshot changes.
 */
export function useFreshestUsageLimits(session: Session | null): UsageLimitsSnapshot | null {
    const machineId = session?.metadata?.machineId;
    const own = session?.agentState?.usageLimits ?? null;
    const freshest = storage((state) => pickFreshestUsageLimits(Object.values(state.sessions), machineId, own));
    return resetExpiredUsageWindows(freshest, Date.now());
}
