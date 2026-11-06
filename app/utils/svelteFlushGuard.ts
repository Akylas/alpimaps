/**
 * Svelte 4 runs its updates in a promise callback, so an error thrown by a reactive statement or a template expression is swallowed, and the
 * scheduler is left marked as scheduled: no component updates after it, which looks like a sheet that does not open or a list that does
 * not change while the app still answers taps. This reports such an error and calls the flush once more, which clears the mark. Pure: nothing
 * of NativeScript or of the app in it, `flush` is Svelte's own (`svelte/internal`). Returns what takes it off.
 */
export function guardFlush(flush: () => void, onError: (error: unknown) => void): () => void {
    const nativeThen = Promise.prototype.then;
    Promise.prototype.then = function (this: Promise<unknown>, onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        // the scheduler's own callback, by identity: its name does not survive a minified build
        if (onFulfilled === flush) {
            onFulfilled = () => {
                try {
                    flush();
                } catch (error) {
                    onError(error);
                    try {
                        flush();
                    } catch {
                        // already reported
                    }
                }
            };
        }
        return nativeThen.call(this, onFulfilled, onRejected);
    } as typeof Promise.prototype.then;
    return () => {
        Promise.prototype.then = nativeThen;
    };
}
