import { getBoolean, getNumber, getString, setBoolean, setNumber, setString } from '@nativescript/core/application-settings';
import { get, writable } from 'svelte/store';

function settingsStore(key, defaultValue) {
    const tpof = typeof defaultValue;
    let updateMethod;
    let startValue;
    switch (tpof) {
        case 'boolean':
            updateMethod = setBoolean;
            startValue = getBoolean(key, defaultValue);
            break;
        case 'number':
            updateMethod = setNumber;
            startValue = getNumber(key, defaultValue);
            break;

        default:
            updateMethod = setString;
            startValue = getString(key, defaultValue);
            break;
    }
    const store = writable(startValue);
    let ignoreUpdate = true;
    store.subscribe((v) => {
        if (ignoreUpdate) {
            ignoreUpdate = false;
            return;
        }
        updateMethod(key, v);
    });
    return store;
}

export const watchingLocation = writable(false);
export const queryingLocation = writable(false);
export const showGlobe = settingsStore('showGlobe', false);
export const show3DBuildings = settingsStore('show3DBuildings', false);
export const showContourLines = settingsStore('showContourLines', true);
export const showSlopePercentages = settingsStore('showSlopePercentages', false);
export const showRoutes = settingsStore('showRoutes', false);
export const contourLinesOpacity = settingsStore('contourLinesOpacity', 1);
export const preloading = settingsStore('preloading', true);
export const rotateEnabled = settingsStore('mapRotateEnabled', false);
export const pitchEnabled = settingsStore('mapPitchEnabled', false);
