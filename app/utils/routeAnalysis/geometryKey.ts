import type { Geometry } from 'geojson';

const SAMPLES = 64;
const METERS_PER_DEGREE = 111320;

function flatten(geometry: Geometry): number[][] {
    switch (geometry?.type) {
        case 'Point':
            return [geometry.coordinates];
        case 'LineString':
        case 'MultiPoint':
            return geometry.coordinates;
        case 'MultiLineString':
        case 'Polygon':
            return geometry.coordinates.flat();
        default:
            return [];
    }
}

function hashStep(hash: number, value: number) {
    return Math.imul(hash ^ value, 16777619) >>> 0;
}

/**
 * Cheap identity of a route's shape: vertex count, length and ~64 sampled vertices. Altitude is
 * ignored, an export appends it to the stored coordinates.
 */
export function geometryKey(geometry: Geometry): string {
    const coordinates = flatten(geometry);
    const count = coordinates.length;
    let length = 0;
    for (let index = 1; index < count; index++) {
        const [lon, lat] = coordinates[index];
        const [previousLon, previousLat] = coordinates[index - 1];
        const dx = (lon - previousLon) * Math.cos((lat * Math.PI) / 180);
        length += Math.hypot(dx, lat - previousLat) * METERS_PER_DEGREE;
    }
    let hash = 2166136261;
    const sampled = Math.min(count, SAMPLES);
    for (let sample = 0; sample < sampled; sample++) {
        const [lon, lat] = coordinates[sampled === 1 ? 0 : Math.round((sample * (count - 1)) / (sampled - 1))];
        hash = hashStep(hashStep(hash, Math.round(lon * 1e6)), Math.round(lat * 1e6));
    }
    return `${count}:${Math.round(length)}:${hash.toString(36)}`;
}
