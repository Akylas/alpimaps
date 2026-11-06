import 'svelte/internal';

// exported by the runtime, left out of Svelte 4's types: the scheduler's flush, which the update guard needs
declare module 'svelte/internal' {
    export function flush(): void;
}
