import { createHistoryStore } from '~/stores/historyStore';

const HISTORY_SIZE = 5;

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
