/** Side streets along a known route, from the routing graph's trace attributes. Pure: nothing here may import NativeScript. */
import type { Junction } from './junctions';
import type { TravelProfile } from './travelMode';

export interface TraceEdge {
    end_shape_index?: number;
    end_heading?: number;
    end_node?: { intersecting_edges?: { begin_heading?: number; cyclability?: string; walkability?: string; driveability?: string }[] };
}

/** The attributes to ask the trace for: the edges' end shape index and heading, and what leaves each end node. */
export const TRACE_JUNCTION_ATTRIBUTES = [
    'edge.end_shape_index',
    'edge.end_heading',
    'node.intersecting_edge.begin_heading',
    'node.intersecting_edge.walkability',
    'node.intersecting_edge.cyclability',
    'node.intersecting_edge.driveability'
];

const ACCESS_KEY = { pedestrian: 'walkability', bicycle: 'cyclability', auto: 'driveability' } as const;
const EARTH_RADIUS = 6371000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function haversine(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
    const dLat = toRadians(to.lat - from.lat);
    const dLon = toRadians(to.lon - from.lon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(a));
}

/** Meters from the first point to each point. */
export function cumulativeDistances(points: { lat: number; lon: number }[]): number[] {
    const distances: number[] = [];
    let total = 0;
    points.forEach((point, index) => {
        if (index > 0) {
            total += haversine(points[index - 1], point);
        }
        distances.push(total);
    });
    return distances;
}

/**
 * The side streets at the end node of each route edge. `forward` means leaving the node along the street, as the
 * graph builder sets it. A street the profile has no access to, either way, is not listed.
 */
export function junctionsFromTrace(edges: TraceEdge[], profile: TravelProfile, points: { lat: number; lon: number }[]): Junction[] {
    const distances = cumulativeDistances(points);
    const junctions: Junction[] = [];
    for (const edge of edges) {
        const point = points[edge.end_shape_index];
        const streets = edge.end_node?.intersecting_edges;
        if (!point || !streets) {
            continue;
        }
        const exits: Junction['exits'] = [];
        for (const street of streets) {
            const access = street[ACCESS_KEY[profile]];
            if (access && street.begin_heading !== undefined && access !== 'none') {
                exits.push({ heading: street.begin_heading, enterable: access === 'forward' || access === 'both' });
            }
        }
        if (exits.length) {
            junctions.push({ distance: distances[edge.end_shape_index], lat: point.lat, lon: point.lon, arrival: edge.end_heading ?? 0, exits });
        }
    }
    return junctions;
}
