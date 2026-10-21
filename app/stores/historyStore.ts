import type { Point } from 'geojson';
import { derived } from 'svelte/store';
import type { IItem } from '~/models/Item';
import { settingsStore } from '~/stores/settingsStore';

function parseEntries<T>(json: string): T[] {
    try {
        const entries = JSON.parse(json);
        return Array.isArray(entries) ? entries : [];
    } catch {
        return [];
    }
}

/** Most recent first, persisted as one JSON string. */
export function createHistoryStore<T>({ isSame, key, max }: { key: string; max: number; isSame: (a: T, b: T) => boolean }) {
    const json = settingsStore(key, '[]');
    const { subscribe } = derived(json, (value) => parseEntries<T>(value));
    function update(updater: (entries: T[]) => T[]) {
        json.update((value) => {
            const entries = updater(parseEntries<T>(value));
            return entries.length ? JSON.stringify(entries) : '[]';
        });
    }
    return {
        subscribe,
        add: (entry: T) => update((entries) => [entry, ...entries.filter((existing) => !isSame(existing, entry))].slice(0, max)),
        remove: (entry: T) => update((entries) => entries.filter((existing) => !isSame(existing, entry))),
        clear: () => json.set('[]')
    };
}

const HISTORY_SIZE = 5;

/** A search result as shown in the list: just what is needed to show it again and select it. */
export interface SearchHistoryItem extends IItem {
    geometry: Point;
    title: string;
    subtitle?: string;
    categoryLabel?: string;
    style: { color?: string; icon: string };
}

function sameSearchItem(a: SearchHistoryItem, b: SearchHistoryItem) {
    const { osm_id: osmIdA, osm_type: osmTypeA } = a.properties || {};
    const { osm_id: osmIdB, osm_type: osmTypeB } = b.properties || {};
    if (osmIdA && osmIdB) {
        return osmIdA === osmIdB && osmTypeA === osmTypeB;
    }
    const [lonA, latA] = a.geometry.coordinates;
    const [lonB, latB] = b.geometry.coordinates;
    return a.title === b.title && lonA.toFixed(5) === lonB.toFixed(5) && latA.toFixed(5) === latB.toFixed(5);
}

export const searchHistory = createHistoryStore<SearchHistoryItem>({ key: 'search_history', max: HISTORY_SIZE, isSame: sameSearchItem });

export function rememberSearchItem(item: SearchHistoryItem) {
    if (item?.geometry?.type !== 'Point' || !item.title) {
        return;
    }
    const { categoryLabel, geometry, properties, style, subtitle, title } = item;
    searchHistory.add({ geometry, properties, title, subtitle, categoryLabel, style });
}

export interface TransitHistoryPlace {
    name: string;
    position: { lat: number; lon: number };
}

export interface TransitHistoryEntry {
    from: TransitHistoryPlace;
    to: TransitHistoryPlace;
    /** ISO date, null for "now" */
    time: string | null;
    arriveBy: boolean;
}

function samePlace(a: TransitHistoryPlace, b: TransitHistoryPlace) {
    return a.position.lat === b.position.lat && a.position.lon === b.position.lon;
}

export const transitHistory = createHistoryStore<TransitHistoryEntry>({
    key: 'transit_history',
    max: HISTORY_SIZE,
    isSame: (a, b) => samePlace(a.from, b.from) && samePlace(a.to, b.to) && a.time === b.time && a.arriveBy === b.arriveBy
});
