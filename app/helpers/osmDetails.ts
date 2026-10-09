import { File, knownFolders, path } from '@nativescript/core';
import type { Point } from 'geojson';
import { readable, writable } from 'svelte/store';
import type { IItem } from '~/models/Item';
import { NetworkConnectionStateEvent, networkService } from '~/services/NetworkService';

export const osmElementTypes = { N: 'node', W: 'way' };

/** older than this, the saved details are looked up again when the card is opened */
export const OSM_DETAILS_FRESH_DURATION = 24 * 3600 * 1000;

const CACHE_FILE = 'osm_details_cache.json';
const CACHE_SIZE = 200;
const CACHE_SAVE_DELAY = 2000;

/** connected and not forced offline: the getter already covers both */
export const networkOnline = readable(networkService.connected, (set) => {
    const update = () => set(networkService.connected);
    update();
    networkService.on(NetworkConnectionStateEvent, update);
    return () => networkService.off(NetworkConnectionStateEvent, update);
});

export interface OSMDetailsState {
    loading?: boolean;
    /** the last lookup found no opening hours, or failed: the check hours chip stays hidden */
    missed?: boolean;
    fetchedAt?: number;
}
const MAX_STATES = 300;
export const osmDetailsStates = writable<Record<string, OSMDetailsState>>({});
export function updateOSMDetailsState(key: string, patch: OSMDetailsState) {
    if (!key) {
        return;
    }
    osmDetailsStates.update((states) => {
        const result = { ...states, [key]: { ...states[key], ...patch } };
        const keys = Object.keys(result);
        if (keys.length > MAX_STATES) {
            delete result[keys[0]];
        }
        return result;
    });
}

export function osmItemRef(item: IItem) {
    const properties = item?.properties;
    const type = osmElementTypes[properties?.osm_type];
    if (type && /^\d+$/.test(String(properties.osm_id))) {
        return { type, id: String(properties.osm_id) };
    }
}

/** the osm element when the item came from the geocoder, else its rounded position and name */
export function osmItemKey(item: IItem) {
    const ref = osmItemRef(item);
    if (ref) {
        return `${ref.type}/${ref.id}`;
    }
    const geometry = item?.geometry as Point;
    if (geometry?.type === 'Point') {
        return `${geometry.coordinates[1].toFixed(4)},${geometry.coordinates[0].toFixed(4)},${item.properties?.name ?? ''}`;
    }
    return '';
}

// kinds of place that do not have hours, phone or website worth a lookup
const NO_DETAILS_CLASSES = ['natural', 'place', 'boundary', 'waterway', 'landuse'];

/** a place we can match on OpenStreetMap: a point with a name or a geocoder osm id */
export function canLookupOSMDetails(item: IItem) {
    return !!item && !item.route && (item.geometry as Point)?.type === 'Point' && !NO_DETAILS_CLASSES.includes(item.properties?.class) && (!!item.properties?.name || !!osmItemRef(item));
}

export interface CachedOSMElement {
    id: number;
    type?: string;
    tags: Record<string, string>;
    fetchedAt: number;
}

let cachePromise: Promise<Map<string, CachedOSMElement>>;
let saveTimer: ReturnType<typeof setTimeout>;

function cacheFilePath() {
    return path.join(knownFolders.documents().path, CACHE_FILE);
}

function loadCache() {
    if (!cachePromise) {
        cachePromise = (async () => {
            try {
                const filePath = cacheFilePath();
                if (File.exists(filePath)) {
                    return new Map<string, CachedOSMElement>(JSON.parse(await File.fromPath(filePath).readText()));
                }
            } catch (error) {
                DEV_LOG && console.error('osm details cache load failed', error);
            }
            return new Map<string, CachedOSMElement>();
        })();
    }
    return cachePromise;
}

export async function getCachedOSMElement(key: string) {
    const cache = await loadCache();
    const entry = cache.get(key);
    if (entry) {
        // most recently used last
        cache.delete(key);
        cache.set(key, entry);
    }
    return entry;
}

export async function setCachedOSMElement(key: string, entry: CachedOSMElement) {
    const cache = await loadCache();
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > CACHE_SIZE) {
        cache.delete(cache.keys().next().value);
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        File.fromPath(cacheFilePath())
            .writeText(JSON.stringify([...cache]))
            .catch((error) => DEV_LOG && console.error('osm details cache save failed', error));
    }, CACHE_SAVE_DELAY);
}
