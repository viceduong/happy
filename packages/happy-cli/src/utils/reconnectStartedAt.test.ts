import { describe, expect, it } from 'vitest';
import { reconnectStartedAt } from './reconnectStartedAt';

describe('reconnectStartedAt', () => {
    it('uses the time the daemon stamped on the resume', () => {
        expect(reconnectStartedAt({ HAPPY_RECONNECT_AT: '1794900000000' })).toBe(1794900000000);
    });

    it('falls back to this process starting when nothing was stamped', () => {
        const value = reconnectStartedAt({});
        expect(value).toBeLessThanOrEqual(Date.now());
        expect(value).toBeGreaterThan(Date.now() - 60_000);
    });

    it('ignores a malformed stamp', () => {
        expect(reconnectStartedAt({ HAPPY_RECONNECT_AT: 'soon' })).not.toBeNaN();
    });
});
