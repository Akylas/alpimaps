import { getBoolean, getNumber, getString, setBoolean, setNumber, setString } from '@nativescript/core/application-settings';
import { get, writable } from 'svelte/store';

const storeData = {
    watchingLocation: false,
    queryingLocation: false,
    showGlobe: getBoolean('showGlobe', false),
    show3DBuildings: getBoolean('show3DBuildings', false),
    showContourLines: getBoolean('showContourLines', true),
    showSlopePercentages: getBoolean('showSlopePercentages', false),
    showRoutes: getBoolean('showRoutes', false),
    contourLinesOpacity: getNumber('contourLinesOpacity', 1),
    preloading: getBoolean('preloading', false),
    rotateEnabled: getBoolean('mapRotateEnabled', false),
    pitchEnabled: getBoolean('mapPitchEnabled', false)
};
const store = writable(storeData);

const storeProperties = ['watchingLocation', 'queryingLocation'];

class ProxyClass {
    [k: string]: any;
    subscribe = store.subscribe;
    constructor() {
        const proxy = new Proxy(store, this);
        return proxy;
    }
    get(internal, prop, receiver) {
        if (storeData.hasOwnProperty(prop)) {
            return get(internal)[prop];
        }
        return Reflect.get(internal, prop, receiver);
    }
    set(internal, prop, value) {
        internal.update((s) => {
            s[prop] = value;
            if (storeProperties.indexOf(prop) === -1) {
                if (typeof value === 'boolean') {
                    setBoolean(prop, value);
                } else {
                    setNumber(prop, value);
                }
            }
            return s;
        });
        return true;
    }
}
const mapStore = new ProxyClass();
export default mapStore;
