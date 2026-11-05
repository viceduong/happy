import { describe, expect, it } from 'vitest';

import { pickFreshestUsageLimits, resetExpiredUsageWindows, type UsageLimitsSnapshot } from './freshestUsageLimits';
import type { Session } from './storageTypes';

function limits(capturedAt: number, utilization = 10, resetsAt: number | null = null): UsageLimitsSnapshot {
    return { capturedAt, windows: [{ id: 'five_hour', utilization, resetsAt }] } as UsageLimitsSnapshot;
}

function session(machineId: string | undefined, usageLimits: UsageLimitsSnapshot | undefined): Session {
    return { metadata: machineId ? { machineId } : null, agentState: usageLimits ? { usageLimits } : null } as unknown as Session;
}

describe('pickFreshestUsageLimits', () => {
    it('takes the newest snapshot among sessions on the same machine', () => {
        const own = limits(100);
        const newer = limits(300);
        const otherMachine = limits(900);
        const sessions = [session('m1', own), session('m1', limits(200)), session('m1', newer), session('m2', otherMachine)];
        expect(pickFreshestUsageLimits(sessions, 'm1', own)).toBe(newer);
    });

    it('keeps the own snapshot when it is the newest or there is no machine id', () => {
        const own = limits(500);
        expect(pickFreshestUsageLimits([session('m1', limits(100))], 'm1', own)).toBe(own);
        expect(pickFreshestUsageLimits([session('m1', limits(900))], undefined, own)).toBe(own);
    });

    it('uses another session when the own session has none yet', () => {
        const other = limits(100);
        expect(pickFreshestUsageLimits([session('m1', other), session('m1', undefined)], 'm1', null)).toBe(other);
    });
});

describe('resetExpiredUsageWindows', () => {
    it('shows a window past its reset as unused', () => {
        const result = resetExpiredUsageWindows(limits(1, 80, 1000), 2000);
        expect(result?.windows[0]).toMatchObject({ utilization: 0, status: 'allowed', resetsAt: null });
    });

    it('returns the same snapshot when nothing expired', () => {
        const snapshot = limits(1, 80, 5000);
        expect(resetExpiredUsageWindows(snapshot, 2000)).toBe(snapshot);
        expect(resetExpiredUsageWindows(null, 2000)).toBeNull();
    });
});
