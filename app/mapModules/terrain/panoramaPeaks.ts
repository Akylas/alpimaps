import { packageService } from '~/services/PackageService';
import { type MapPos, computeDistanceBetween } from '~/utils/geo';

// The summit set, collected once per viewpoint into memory: the live tiles thin `mountain_peak` as far
// tiles coarsen, so names came and went with the view. Occlusion stays the SDK's (`billboardOcclusionEnabled`).

/** OpenMapTiles' field names, so `peaksStyle` matches. */
export interface PanoramaPeak {
    name: string;
    /** Metres; `ele` in the style. */
    elevation: number;
    position: MapPos;
    /** Metres from the viewpoint. */
    distance: number;
}

export interface CollectPeaksOptions {
    /** Metres around the viewpoint. */
    radius: number;
    /** The zoom tiles are READ at: lower thins `mountain_peak`, higher costs 4^z tiles (z12 ~900 at 150 km). */
    zoom: number;
    /** How many summits to keep, highest first. */
    maxCount: number;
    /** Metres; summits below this are dropped before the cap. */
    minElevation: number;
}

/** The layer name the features go under, because `peaksStyle` selects `#mountain_peak`. */
export const PANORAMA_PEAKS_LAYER = 'mountain_peak';

/** Highest first. One search: `VectorTileSearchService` reads the tiles it needs itself. */
export async function collectPanoramaPeaks(viewpoint: MapPos, options: CollectPeaksOptions): Promise<PanoramaPeak[]> {
    const features = await packageService.searchInVectorTiles({
        position: viewpoint,
        searchRadius: options.radius,
        layers: [PANORAMA_PEAKS_LAYER],
        minZoom: options.zoom,
        maxZoom: options.zoom,
        // filtered in the service: most features are not named peaks, so a budget spent before it is wasted
        filterExpression: "class='peak'",
        // ...and generous: the service cuts by distance, so a small budget drops the far high summits
        // (Mont Blanc at 170 km) before the elevation sort sees them
        maxResults: Math.max(options.maxCount * 25, 50000),
        preventDuplicates: true,
        sortByDistance: true
    });
    if (!features?.length) {
        return [];
    }

    const peaks: PanoramaPeak[] = [];
    for (const feature of features) {
        const properties = feature.properties as Record<string, unknown>;
        // `class` is peak / volcano / saddle / ridge in OpenMapTiles; the style draws peaks.
        if (properties?.class !== 'peak') {
            continue;
        }
        const name = typeof properties.name === 'string' ? properties.name : null;
        if (!name) {
            continue;
        }
        const coordinates = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
        if (!coordinates) {
            continue;
        }
        const elevation = Number(properties.ele);
        if (!isFinite(elevation) || elevation < options.minElevation) {
            continue;
        }
        const position: MapPos = { lon: coordinates[0], lat: coordinates[1] };
        peaks.push({ name, elevation, position, distance: computeDistanceBetween(viewpoint, position) });
    }

    // highest first, so the cap keeps the summits a panorama is read by; the nearer wins a tie
    peaks.sort((left, right) => right.elevation - left.elevation || left.distance - right.distance);
    return peaks.slice(0, options.maxCount);
}

/**
 * Same properties as the tiles, so the two sources are interchangeable. `ele` stays a NUMBER: the style
 * does arithmetic on it.
 */
export function peaksToGeoJSON(peaks: PanoramaPeak[]): GeoJSON.FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: peaks.map((peak) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [peak.position.lon, peak.position.lat] },
            properties: { name: peak.name, ele: peak.elevation, class: 'peak' }
        }))
    };
}
