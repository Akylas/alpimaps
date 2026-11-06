import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardFlush } from './svelteFlushGuard';

describe('guardFlush', () => {
    let uninstall: () => void;
    afterEach(() => uninstall?.());

    it('reports an error thrown by the scheduled flush, which would otherwise be swallowed', async () => {
        const error = new Error('boom');
        const flush = vi.fn().mockImplementationOnce(() => {
            throw error;
        });
        const onError = vi.fn();
        uninstall = guardFlush(flush, onError);
        await Promise.resolve().then(flush);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(error);
    });

    it('runs the flush once more after an error: it is what lets the scheduler schedule again, a frozen one never updates a component', async () => {
        const flush = vi.fn().mockImplementationOnce(() => {
            throw new Error('boom');
        });
        uninstall = guardFlush(flush, () => undefined);
        await Promise.resolve().then(flush);
        expect(flush).toHaveBeenCalledTimes(2);
    });

    it('does not report a flush that goes well, nor touch another promise', async () => {
        const flush = vi.fn();
        const onError = vi.fn();
        uninstall = guardFlush(flush, onError);
        const value = await Promise.resolve(3).then((number) => number + 1);
        await Promise.resolve().then(flush);
        expect(value).toBe(4);
        expect(flush).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it('does not report twice when the recovering flush throws too, and leaves promises as they were once uninstalled', async () => {
        const flush = vi.fn(() => {
            throw new Error('always');
        });
        const onError = vi.fn();
        const before = Promise.prototype.then;
        uninstall = guardFlush(flush, onError);
        await Promise.resolve().then(flush);
        expect(onError).toHaveBeenCalledTimes(1);
        uninstall();
        expect(Promise.prototype.then).toBe(before);
    });
});
