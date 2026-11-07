/** The rows of the Road safety card of the route page, and the shares the stats view says. Pure: nothing here may import NativeScript. */
import type { RoutePageRow } from '~/routeFeatures/registry';
import type { RoadRead, RoadRun } from '~/routeFeatures/road/sections';

export type RoadShareId = 'high' | 'medium' | 'rest' | 'unknown';

/** The i18n key that names each share. */
export const ROAD_SHARE_LABELS: Record<RoadShareId, string> = {
    high: 'road_level_high',
    medium: 'road_level_medium',
    rest: 'road_bar_rest',
    unknown: 'road_bar_unknown'
};

export interface RoadShare {
    id: RoadShareId;
    /** meters */
    meters: number;
}

export type RoadRowData =
    /** what the route is made of: the fast roads without a separated lane red then amber, the rest, what was not evaluated */
    | { type: 'bar'; shares: RoadShare[] }
    /** the sections' header: they fold away under it */
    | { type: 'header'; count: number; open: boolean }
    | { type: 'section'; id: number; run: RoadRun }
    /** what the figures are based on, and the meters not evaluated */
    | { type: 'note'; unknown: number };

/** How much of a route `total` meters long is each kind, the kinds it has none of left out. */
export function roadShares(read: RoadRead, total: number): RoadShare[] {
    const sum = (level: 2 | 3) => read.runs.filter(({ section }) => section.level === level).reduce((meters, { section }) => meters + section.length, 0);
    const high = sum(3);
    const medium = sum(2);
    const shares: RoadShare[] = [
        { id: 'high', meters: high },
        { id: 'medium', meters: medium },
        { id: 'rest', meters: Math.max(total - high - medium - read.unknown, 0) },
        { id: 'unknown', meters: read.unknown }
    ];
    return shares.filter(({ meters }) => meters > 0);
}

/** The bar, the sections under their header (listed only while open), and the note on where the figures come from. None before the risk is read. */
export function roadRows(read: RoadRead | null, total: number, sectionsOpen: boolean): RoutePageRow[] {
    if (!read) {
        return [];
    }
    return [
        { key: 'bar', data: { type: 'bar', shares: roadShares(read, total) } satisfies RoadRowData },
        ...(read.runs.length ? [{ key: 'header', data: { type: 'header', count: read.runs.length, open: sectionsOpen } satisfies RoadRowData }] : []),
        ...(sectionsOpen ? read.runs.map((run, id) => ({ key: `section${id}`, data: { type: 'section', id, run } satisfies RoadRowData })) : []),
        { key: 'note', data: { type: 'note', unknown: read.unknown } satisfies RoadRowData }
    ];
}
