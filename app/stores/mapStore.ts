import { ApplicationSettings } from '@nativescript/core';
import { get, writable } from 'svelte/store';
import type { RoutesType } from '~/mapModules/CustomLayersModule';

function settingsStore<T = any>(key, defaultValue: T) {
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
        updateMethod(key, v);
    });
    return store;
}

export const watchingLocation = writable(false);
export const queryingLocation = writable(false);
export const projectionModeSpherical = settingsStore('showGlobe', false);
export const show3DBuildings = settingsStore('show3DBuildings', false);
export const showContourLines = settingsStore('showContourLines', true);
export const showSlopePercentages = settingsStore('showSlopePercentages', false);
export const showRoutes = settingsStore('showRoutes', false);
export const contourLinesOpacity = settingsStore('contourLinesOpacity', -1);
export const mapFontScale = settingsStore('mapFontScale', 1);
export const preloading = settingsStore('preloading', true);
export const rotateEnabled = settingsStore('mapRotateEnabled', false);
export const pitchEnabled = settingsStore('mapPitchEnabled', false);
export const routesType = settingsStore<RoutesType>('routes_type', 0);
export const useOfflineGeocodeAddress = settingsStore('useOfflineGeocodeAddress', true);
export const useSystemGeocodeAddress = settingsStore('useSystemGeocodeAddress', true);
export const emphasisRails = settingsStore('emphasisRails', false);
export const emphasisDrinkingWater = settingsStore('emphasisDrinkingWater', false);
export const showSubBoundaries = settingsStore('showSubBoundaries', true);
export const cityMinZoom = settingsStore('cityMinZoom', -1);
export const forestPatternZoom = settingsStore('forestPatternZoom', -1);
export const rockPatternZoom = settingsStore('rockPatternZoom', -1);
export const screePatternZoom = settingsStore('screePatternZoom', -1);
export const scrubPatternZoom = settingsStore('scrubPatternZoom', -1);
export const showPolygonsBorder  = settingsStore('showPolygonsBorder', true);
export const showRoadShields = settingsStore('showRoadShields', true);
export const showRouteShields = settingsStore('showRouteShields', false);
export const showItemsLayer = settingsStore('showItemsLayer', true);
export const itemLock = writable(false);
export const routeDashMinZoom = settingsStore('routeDashMinZoom', -1);