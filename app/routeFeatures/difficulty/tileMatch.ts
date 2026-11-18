/** The mtb level of a route's edges, read off the lines of the vector tiles it runs along. Pure: nothing here may import NativeScript. */
import type { Feature } from 'geojson';
import { runsFromEdges } from '~/routeFeatures/difficulty/runs';
import { UNKNOWN_LEVEL, mtbLevel } from '~/routeFeatures/difficulty/scale';
import type { DifficultyRun } from '~/utils/routeAnalysis/types';

/** A line of the tiles' `transportation` layer that has an mtb scale. */
export interface TileLine {
    /** [longitude, latitude] */
    coordinates: [number, number][];
    /** `mtb_scale` of the way. */
    mtbScale?: string | number;
    /** `mtb_scale_uphill`: how hard the way is to ride up. */
    mtbScaleUphill?: string | number;
}

export interface MtbEdge {
    /** route shape indexes */
    begin?: number;
    end?: number;
}

export interface MtbMatchOptions {
    /** metres from the edge a line may be at to be its way */
    tolerance?: number;
    /** the route's elevation at each shape index, m: an edge that gains height is read on the uphill scale */
    elevations?: number[];
}

export const DEFAULT_MATCH_TOLERANCE = 30;
const MAX_SAMPLES = 5;
const METERS_PER_DEGREE = 111_320;

type Position = [number, number];

const hasValue = (value: unknown) => value !== undefined && value !== null && value !== '';

/** The lines of tile features that carry a scale: a multi line is as many lines as it has parts, what is not a line is dropped. */
export function tileLines(features: Pick<Feature, 'geometry' | 'properties'>[]): TileLine[] {
    const lines: TileLine[] = [];
    for (const { geometry, properties } of features) {
        const mtbScale = properties?.mtb_scale;
        const mtbScaleUphill = properties?.mtb_scale_uphill;
        if (!hasValue(mtbScale) && !hasValue(mtbScaleUphill)) {
            continue;
        }
        const parts = geometry?.type === 'LineString' ? [geometry.coordinates] : geometry?.type === 'MultiLineString' ? geometry.coordinates : [];
        for (const coordinates of parts) {
            lines.push({ coordinates: coordinates.map(([longitude, latitude]) => [longitude, latitude]), mtbScale, mtbScaleUphill });
        }
    }
    return lines;
}

/** Metres from `point` to the segment `from`-`to`, on the plane around the point. */
function distanceToSegment(point: Position, from: Position, to: Position): number {
    const scale = Math.cos((point[1] * Math.PI) / 180);
    const toX = (position: Position) => (position[0] - point[0]) * scale * METERS_PER_DEGREE;
    const toY = (position: Position) => (position[1] - point[1]) * METERS_PER_DEGREE;
    const [fromX, fromY, toEndX, toEndY] = [toX(from), toY(from), toX(to), toY(to)];
    const dx = toEndX - fromX;
    const dy = toEndY - fromY;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared > 0 ? Math.min(Math.max((-fromX * dx - fromY * dy) / lengthSquared, 0), 1) : 0;
    return Math.hypot(fromX + along * dx, fromY + along * dy);
}

function distanceToLine(point: Position, coordinates: Position[]): number {
    let nearest = Infinity;
    for (let index = 1; index < coordinates.length; index++) {
        nearest = Math.min(nearest, distanceToSegment(point, coordinates[index - 1], coordinates[index]));
    }
    return nearest;
}

/** Up to `MAX_SAMPLES` of the route's points along the edge, its ends included. */
function samplesOf(route: Position[], begin: number, end: number): Position[] {
    const count = Math.min(MAX_SAMPLES, end - begin + 1);
    return Array.from({ length: count }, (_, index) => route[begin + Math.round(((end - begin) * index) / Math.max(count - 1, 1))]);
}

/** The level a line gives an edge: the scale of the direction the route goes, the other when it has none. */
function levelOf(line: TileLine, climbing: boolean): number {
    const down = mtbLevel(line.mtbScale);
    const up = mtbLevel(line.mtbScaleUphill);
    const [preferred, other] = climbing ? [up, down] : [down, up];
    return preferred !== UNKNOWN_LEVEL ? preferred : other;
}

/**
 * The runs of mtb levels along a route: each edge takes the level of the tile line its points are the closest to, on average, as
 * long as that is within the tolerance, else it is not rated. Runs of one level fuse, as they do for the sac scale.
 */
export function mtbRuns(edges: MtbEdge[], route: Position[], lines: TileLine[], { elevations, tolerance = DEFAULT_MATCH_TOLERANCE }: MtbMatchOptions = {}): DifficultyRun[] {
    const bounds = lines.map(({ coordinates }) => ({
        minX: Math.min(...coordinates.map(([longitude]) => longitude)),
        maxX: Math.max(...coordinates.map(([longitude]) => longitude)),
        minY: Math.min(...coordinates.map(([, latitude]) => latitude)),
        maxY: Math.max(...coordinates.map(([, latitude]) => latitude))
    }));
    const latitudeMargin = tolerance / METERS_PER_DEGREE;
    return runsFromEdges(
        edges.map(({ begin, end }) => {
            const samples = begin >= 0 && end > begin && end < route.length ? samplesOf(route, begin, end) : [];
            if (!samples.length) {
                return { begin, end, level: UNKNOWN_LEVEL };
            }
            const latitudes = samples.map(([, latitude]) => latitude);
            // a degree of longitude is shorter away from the equator
            const longitudeMargin = latitudeMargin / Math.cos((Math.max(...latitudes.map(Math.abs)) * Math.PI) / 180);
            const minX = Math.min(...samples.map(([longitude]) => longitude)) - longitudeMargin;
            const maxX = Math.max(...samples.map(([longitude]) => longitude)) + longitudeMargin;
            const minY = Math.min(...latitudes) - latitudeMargin;
            const maxY = Math.max(...latitudes) + latitudeMargin;
            let nearest = Infinity;
            let found: TileLine | undefined;
            lines.forEach((line, index) => {
                const box = bounds[index];
                // a line away from every sample cannot be the edge's way
                if (box.maxX < minX || box.minX > maxX || box.maxY < minY || box.minY > maxY) {
                    return;
                }
                const mean = samples.reduce((total, sample) => total + distanceToLine(sample, line.coordinates), 0) / samples.length;
                if (mean < nearest) {
                    nearest = mean;
                    found = line;
                }
            });
            const climbing = elevations ? elevations[end] > elevations[begin] : false;
            return { begin, end, level: found && nearest <= tolerance ? levelOf(found, climbing) : UNKNOWN_LEVEL };
        })
    );
}
