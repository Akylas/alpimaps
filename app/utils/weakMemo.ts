/** `build`, run once per key: the key is replaced, never edited, when what it holds changes. */
export function weakMemo<Key extends object, Value>(build: (key: Key) => Value): (key: Key) => Value {
    const cache = new WeakMap<Key, Value>();
    return (key) => {
        if (!cache.has(key)) {
            cache.set(key, build(key));
        }
        return cache.get(key);
    };
}
