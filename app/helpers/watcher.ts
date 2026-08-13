import { Writable, writable } from 'svelte/store';

/**
 * A writable that reports the previous value alongside the new one.
 *
 * Svelte stores only hand subscribers the new value, but some callers need to react to the change
 * itself — what was deselected, not just what is selected now.
 *
 * `onChange` runs inside the update, so it sees the old value before any subscriber sees the new one.
 */
export default function watcher<T>(initialValue: T, onChange: (oldValue: T, value: T) => void): Writable<T> {
    const store = writable<T>(initialValue);
    return {
        subscribe: store.subscribe,
        set(value: T) {
            store.update((oldValue) => {
                onChange(oldValue, value);
                return value;
            });
        },
        update(updater: (value: T) => T) {
            store.update((oldValue) => {
                const value = updater(oldValue);
                onChange(oldValue, value);
                return value;
            });
        }
    };
}
