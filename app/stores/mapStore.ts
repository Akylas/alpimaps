import { getBoolean, getNumber, getString, setBoolean, setNumber, setString } from '@nativescript/core/application-settings';
import { Writable, get, writable } from 'svelte/store';
const { subscribe, set, update } = writable({
    watchingLocation: false,
    queryingLocation: false,
    showGlobe: getBoolean('showGlobe', false),
    show3DBuildings: getBoolean('show3DBuildings', false),
    showContourLines: getBoolean('showContourLines', true),
    showSlopePercentages: getBoolean('showSlopePercentages', false),
    showRoutes: getBoolean('showRoutes', false),
    contourLinesOpacity: getNumber('contourLinesOpacity', 1),
    zoomBiais: getString('zoomBiais', '0'),
    preloading: getBoolean('preloading', false),
    rotateEnabled: getBoolean('mapRotateEnabled', false),
    pitchEnabled: getBoolean('mapPitchEnabled', false)
});

const store = {
    subscribe,
    get watchingLocation() {
        return get(store).watchingLocation;
    },
    set watchingLocation(value) {
        update((s) => {
            s.watchingLocation = value;
            return s;
        });
    },
    get queryingLocation() {
        return get(store).queryingLocation;
    },
    set queryingLocation(value) {
        update((s) => {
            s.queryingLocation = value;
            return s;
        });
    },
    setShowGlobe: (value: boolean) =>
        update((s) => {
            s.showGlobe = value;
            setBoolean('showGlobe', value);
            return s;
        }),
    setShow3DBuildings: (value: boolean) =>
        update((s) => {
            s.show3DBuildings = value;
            setBoolean('show3DBuildings', value);
            return s;
        }),
    setShowContourLines: (value: boolean) =>
        update((s) => {
            s.showContourLines = value;
            setBoolean('showContourLines', value);
            return s;
        }),
    setShowRoutes: (value: boolean) =>
        update((s) => {
            s.showRoutes = value;
            setBoolean('showRoutes', value);
            return s;
        }),
    setShowSlopePercentages: (value: boolean) =>
        update((s) => {
            s.showSlopePercentages = value;
            setBoolean('showSlopePercentages', value);
            return s;
        }),
    setPreloading: (value: boolean) =>
        update((s) => {
            s.preloading = value;
            setBoolean('preloading', value);
            return s;
        }),
    setContourLinesOpacity: (value: number) =>
        update((s) => {
            s.contourLinesOpacity = value;
            setNumber('contourLinesOpacity', value);
            return s;
        }),
    setZoomBiais: (value: string) =>
        update((s) => {
            s.zoomBiais = value;
            setString('zoomBiais', value);
            return s;
        }),
    setRotateEnabled: (value: boolean) =>
        update((s) => {
            s.rotateEnabled = value;
            setBoolean('mapRotateEnabled', value);
            return s;
        }),
    setPitchEnabled: (value: boolean) =>
        update((s) => {
            s.pitchEnabled = value;
            setBoolean('mapPitchEnabled', value);
            return s;
        })
};
export default store;
