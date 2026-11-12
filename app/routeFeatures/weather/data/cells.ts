/** The next hours of the ride as cells of a few minutes, for the dock. Pure: nothing here may import NativeScript. */
import type { WeatherRead } from '~/routeFeatures/weather/data/read';

export const CELL_MINUTES = 20;
export const CELL_COUNT = 6;
const MINUTE_MS = 60000;

export interface AheadCell {
    /** epoch ms the rider is there */
    at: number;
    /** the vertex of the route it is */
    vertex: number;
    temp?: number;
    /** mm/h */
    precip?: number;
    code?: number;
    cloud?: number;
    /** the phase of the moon as a glyph, when it is night there */
    moon?: string;
    /** km/h: the wind, and the part of it against (above 0) or behind (below 0) the ride and across it (above 0 from the right) */
    wind?: number;
    head?: number;
    cross?: number;
}

/**
 * The weather where the rider is `CELL_MINUTES` minutes apart from `now`, for as long as the route lasts: the read must be timed from the
 * rider's vertex (`ahead`), so `timeAt(fromIndex)` is now.
 */
export function aheadCells(read: Pick<WeatherRead, 'at' | 'rows' | 'timeAt'>, { fromIndex, lastIndex }: { fromIndex: number; lastIndex: number }, now: number, count = CELL_COUNT): AheadCell[] {
    const cells: AheadCell[] = [];
    if (fromIndex > lastIndex) {
        return cells;
    }
    for (let cell = 0; cell < count; cell++) {
        const time = now + cell * CELL_MINUTES * MINUTE_MS;
        if (read.timeAt(lastIndex) < time) {
            break;
        }
        // the first vertex the rider gets to at or after the time: the times only grow along the route
        let low = fromIndex;
        let high = lastIndex;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (read.timeAt(middle) < time) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }
        const reading = read.at(low);
        cells.push({
            at: time,
            vertex: low,
            temp: reading?.temp,
            precip: reading?.precip,
            code: reading?.code,
            cloud: reading?.cloud,
            moon: read.rows.find((row) => low >= row.i0 && low <= row.i1)?.moon,
            wind: reading?.wind,
            head: reading?.head,
            cross: reading?.cross
        });
    }
    return cells;
}

/** km/h of wind under which there is no mark worth the room */
const WIND_MARK_MIN = 3;

/** The wind as the ride feels it: which way it blows on the rider (down the screen: in the face) and the part that is the biggest of it. */
export function windMark(cell: Pick<AheadCell, 'head' | 'cross'>): { arrow: '↓' | '↑' | '←' | '→'; speed: number } | undefined {
    const head = cell.head ?? 0;
    const cross = cell.cross ?? 0;
    if (Math.max(Math.abs(head), Math.abs(cross)) < WIND_MARK_MIN) {
        return undefined;
    }
    if (Math.abs(head) >= Math.abs(cross)) {
        return { arrow: head > 0 ? '↓' : '↑', speed: Math.abs(head) };
    }
    // from the right, it blows to the left
    return { arrow: cross > 0 ? '←' : '→', speed: Math.abs(cross) };
}
