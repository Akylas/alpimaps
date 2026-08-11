import { ApplicationSettings } from '@nativescript/core';
import { Writable, writable } from 'svelte/store';

export type SettingsStore<T> = Writable<T> & { reset: () => void };

/**
 * A svelte store backed by ApplicationSettings: writing to it persists, and writing the default
 * value removes the key so the default can still move in a later version.
 */
export function settingsStore<T = any>(key: string, defaultValue: T): SettingsStore<T> {
    const tpof = typeof defaultValue;
    let updateMethod;
    let startValue;
    switch (tpof) {
        case 'boolean':
            updateMethod = ApplicationSettings.setBoolean;
            startValue = ApplicationSettings.getBoolean(key, defaultValue as boolean);
            break;
        case 'number':
            updateMethod = ApplicationSettings.setNumber;
            startValue = ApplicationSettings.getNumber(key, defaultValue as number);
            break;

        default:
            updateMethod = ApplicationSettings.setString;
            startValue = ApplicationSettings.getString(key, defaultValue as string);
            break;
    }
    const store = writable<T>(startValue);
    let ignoreUpdate = true;
    store.subscribe((v) => {
        if (ignoreUpdate) {
            ignoreUpdate = false;
            return;
        }
        if (v === defaultValue) {
            ApplicationSettings.remove(key);
        } else {
            updateMethod(key, v);
        }
    });
    (store as SettingsStore<T>).reset = () => {
        store.set(defaultValue);
    };
    return store as SettingsStore<T>;
}
