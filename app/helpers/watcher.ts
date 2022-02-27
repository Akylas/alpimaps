import { Writable, writable } from 'svelte/store';

function watcher<T>(initialValue, watchFunction) {
    const { subscribe, update } = writable<T>(initialValue);
    return {
        subscribe,
        set: (value) => {
            update((oldvalue) => {
                watchFunction(oldvalue, value);
                return value;
            });
        }
    } as Writable<T>;
}

export default watcher;
