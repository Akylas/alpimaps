/** The rows of the Road safety card of the route page. Pure: nothing here may import NativeScript. */
import type { RoutePageRow } from '~/routeFeatures/registry';
import type { RoadRead, RoadRun } from '~/routeFeatures/road/sections';

export type RoadRowData =
    /** the share of the route, in meters, that is fast without a separated lane, red then amber */
    | { type: 'bar'; high: number; medium: number; total: number }
    | { type: 'section'; id: number; run: RoadRun }
    /** what the figures are based on, and the meters not evaluated */
    | { type: 'note'; unknown: number };

/** The stacked bar, a row for each risky section, and the note on where the figures come from. None before the risk is read. */
export function roadRows(read: RoadRead | null, total: number): RoutePageRow[] {
    if (!read) {
        return [];
    }
    const sum = (level: 2 | 3) => read.runs.filter(({ section }) => section.level === level).reduce((meters, { section }) => meters + section.length, 0);
    return [
        { key: 'bar', data: { type: 'bar', high: sum(3), medium: sum(2), total } satisfies RoadRowData },
        ...read.runs.map((run, id) => ({ key: `section${id}`, data: { type: 'section', id, run } satisfies RoadRowData })),
        { key: 'note', data: { type: 'note', unknown: read.unknown } satisfies RoadRowData }
    ];
}
