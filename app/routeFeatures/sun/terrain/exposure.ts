/** Terrain shade along a route: what is asked of the SDK and how its answers are put together. Pure: nothing here may import NativeScript. */

/** points of one call: a call is bounded by its tile loading, and the calls on a layer queue behind each other */
export const EXPOSURE_CHUNK = 250;

/** The sun is hidden by the terrain under this share of it lit, %. */
export const SHADE_BELOW = 30;

/** metres above the ground of the eyes, by what carries them */
export const EYE_HEIGHT = { hike: 1.5, bike: 1.2, motor: 1.2 };

/** The SDK's status bits of a point. */
export const EXPOSURE_STATUS = { COARSE_DEM: 1, NO_DEM: 2, DARK: 4, LOW_SUN: 8, TRUNCATED: 16 };

/** Where the sun is for a point of the route, degrees: azimuth clockwise from north, altitude as seen. */
export interface ExposureSample {
    lat: number;
    lon: number;
    azimuth: number;
    altitude: number;
}

/** What the SDK says of the points of one call. */
export interface ExposureChunk {
    /** 0..1 of the sun disc, -1 unknown */
    sunFraction: number[];
    status: number[];
}

/** What a route keeps of it. */
export interface TerrainShade {
    /** 0..100 per sample, -1 unknown: no ground to read it from */
    lit: number[];
    /** the samples the answer is weaker for: their status bits, but not the dark, which is no weakness */
    flags: { i: number; f: number }[];
    /** 0..1: the share of the samples read from ground fine enough to count */
    coverage: number;
}

export function chunkSamples<T>(samples: T[], size = EXPOSURE_CHUNK): T[][] {
    const chunks: T[][] = [];
    for (let from = 0; from < samples.length; from += size) {
        chunks.push(samples.slice(from, from + size));
    }
    return chunks;
}

/** Bits that make an answer weaker: the dark is not one, the sun is down and there is nothing to ask of the terrain. */
const WEAK = EXPOSURE_STATUS.COARSE_DEM | EXPOSURE_STATUS.NO_DEM | EXPOSURE_STATUS.LOW_SUN | EXPOSURE_STATUS.TRUNCATED;
/** Bits that mean the ground was not fine enough, or not there. */
const UNCOVERED = EXPOSURE_STATUS.COARSE_DEM | EXPOSURE_STATUS.NO_DEM;

export function mergeExposure(chunks: ExposureChunk[]): TerrainShade {
    const lit: number[] = [];
    const flags: TerrainShade['flags'] = [];
    let covered = 0;
    chunks.forEach((chunk) =>
        chunk.sunFraction.forEach((fraction, index) => {
            const status = chunk.status[index] ?? 0;
            const sample = lit.length;
            lit.push(fraction < 0 ? -1 : Math.round(fraction * 100));
            if (status & WEAK) {
                flags.push({ i: sample, f: status & WEAK });
            }
            if (!(status & UNCOVERED)) {
                covered++;
            }
        })
    );
    return { lit, flags, coverage: lit.length ? covered / lit.length : 1 };
}

/** The terrain hides the sun at a sample: a lit share that is known and low. */
export function isShaded(lit: number | undefined): boolean {
    return lit !== undefined && lit >= 0 && lit < SHADE_BELOW;
}
