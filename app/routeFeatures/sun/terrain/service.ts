/** Asks the SDK, through the hillshade layer that owns the elevation model, where the terrain hides the sun. */
import type { ExposureAsker } from '~/routeFeatures/sun/terrain/layer';
import { packageService } from '~/services/PackageService';

/** How long a call may wait for tiles before it answers with what it has: an update of the ride waits on it, a minute would be too long. */
const LOAD_TIMEOUT_MS = 8000;

interface SunExposureLayer {
    sunExposure(
        positions: { lat: number; lon: number }[],
        sun: [number, number][],
        options: { eyeHeight: number; loadTimeoutMs: number; releaseCache: boolean }
    ): Promise<{ sunFraction: number[]; status: number[] }>;
}

// the plugin the app is built with may not have the call yet: the layer is asked, not assumed
function hasSunExposure(layer: unknown): layer is SunExposureLayer {
    return typeof layer === 'object' && layer !== null && 'sunExposure' in layer && typeof layer.sunExposure === 'function';
}

function exposureLayer(): SunExposureLayer | null {
    const layer = packageService.hillshadeLayer;
    return hasSunExposure(layer) ? layer : null;
}

/** There is an elevation model, and the SDK can read the sun over it. */
export function terrainShadeAvailable(): boolean {
    return exposureLayer() !== null;
}

export const exposeSamples: ExposureAsker = async (samples, { eyeHeight, last }) => {
    const layer = exposureLayer();
    if (!layer) {
        throw new Error('no elevation model to read the sun over');
    }
    const answer = await layer.sunExposure(
        samples.map(({ lat, lon }) => ({ lat, lon })),
        samples.map(({ altitude, azimuth }): [number, number] => [azimuth, altitude]),
        // the layer's own cache is cleared after the last call only: the calls before it share the tiles of the route
        { eyeHeight, loadTimeoutMs: LOAD_TIMEOUT_MS, releaseCache: last }
    );
    return { sunFraction: answer.sunFraction, status: answer.status };
};
