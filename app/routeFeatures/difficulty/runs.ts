/** The stretches of a route of one difficulty level, read off its Valhalla edges. Pure: nothing here may import NativeScript. */
import { sacLevel } from '~/routeFeatures/difficulty/scale';
import type { DifficultyRun } from '~/utils/routeAnalysis/types';

/** What the stats call returns per edge, `trace_attributes` shaped. */
export interface SacEdge {
    sac_scale?: number;
    begin_shape_index?: number;
    end_shape_index?: number;
}

/** The edge attributes the sac scale needs, asked of the stats call. */
export const SAC_EDGE_ATTRIBUTES = ['edge.sac_scale', 'edge.begin_shape_index', 'edge.end_shape_index'];

/**
 * One run per stretch of the same level: valhalla splits a road into many edges, the consecutive ones of a level fuse. Runs are not
 * merged further, so a short hard step stays where it is.
 */
export function runsFromEdges(edges: { begin?: number; end?: number; level: number }[]): DifficultyRun[] {
    const runs: DifficultyRun[] = [];
    for (const { begin, end, level } of edges) {
        // an edge the match gave no place on the route
        if (!(begin >= 0 && end > begin)) {
            continue;
        }
        const previous = runs[runs.length - 1];
        if (previous?.level === level && previous.end === begin) {
            previous.end = end;
        } else {
            runs.push({ start: begin, end, level });
        }
    }
    return runs;
}

export function sacRuns(edges: SacEdge[]): DifficultyRun[] {
    return runsFromEdges(edges.map((edge) => ({ begin: edge.begin_shape_index, end: edge.end_shape_index, level: sacLevel(edge.sac_scale) })));
}
