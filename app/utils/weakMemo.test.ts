import { describe, expect, it, vi } from 'vitest';
import { weakMemo } from './weakMemo';

describe('weakMemo', () => {
    it('builds once per key', () => {
        const build = vi.fn((key: { id: number }) => ({ built: key.id }));
        const memo = weakMemo(build);
        const first = { id: 1 };
        expect(memo(first)).toBe(memo(first));
        expect(build).toHaveBeenCalledTimes(1);
    });

    it('builds again for another key, and keeps a falsy result', () => {
        const build = vi.fn(() => 0);
        const memo = weakMemo(build);
        expect(memo({})).toBe(0);
        expect(memo({})).toBe(0);
        const same = {};
        memo(same);
        memo(same);
        expect(build).toHaveBeenCalledTimes(3);
    });
});
