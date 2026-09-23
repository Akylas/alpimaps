import { packageService } from '~/services/PackageService';
import { type MapPos, computeDistanceBetween } from '~/utils/geo';

/**
 * The panorama's summit set, resolved ONCE for a viewpoint.
 *
 * Why this exists at all is the difference between our panorama and peakfinder.com's: theirs settles
 * which summits the viewpoint can name before it draws a frame (`PeakVisibilityChecker`,
 * `VisiblePOIsDBAdapter` in their wasm) and lays them out in one pass over the whole 360°. Ours asks
 * the vector-tile label culler, every frame, about whatever tiles the camera has caused to be loaded
 * — so the answer moves as the view turns, which is exactly the two complaints: too few names, and
 * names that come and go while you look around.
 *
 * Two separate things went wrong there, and only one of them is the culler's.
 *
 *  - The DATA moves. A layer's far tiles are allowed to coarsen to `cameraTileZoom - coarsening`,
 *    and `mountain_peak` thins out as the zoom drops — the famous summits survive to z6, the rest do
 *    not. So a range on the horizon offers a different set of features depending on which tiles
 *    happen to be resident, and turning the view changes that.
 *  - The PLACEMENT moves, because the culler is a screen-space pass and the screen turns.
 *
 * This fixes the first, which is the one that makes labels vanish outright. Every summit within the
 * view distance is collected once, into memory, and handed to the map as a `GeoJSONVectorTileDataSource`
 * — which serves every feature at every zoom, because the whole set is already there. Nothing about
 * the summit set then depends on the camera.
 *
 * What is NOT here, deliberately: a visibility ray-march. The SDK already occludes billboards against
 * the rendered terrain depth per pixel (`billboardOcclusionEnabled`), which is both more accurate
 * than a DEM march and free, and it remembers its verdicts so they do not flicker. Doing it here
 * would mean pushing a million sample positions per viewpoint across the bridge into
 * `getElevations`, and the marshalling alone costs more than the whole panorama. The native horizon
 * profile peakfinder runs is the way to have it as DATA — a "visible peaks" list, a silhouette to
 * export — and that belongs in the SDK, not here.
 */

/** What one summit carries into the layer. OpenMapTiles' own field names, so `peaksStyle` matches. */
export interface PanoramaPeak {
    name: string;
    /** Metres. `ele` in the style, and what the label rank is sorted on. */
    elevation: number;
    position: MapPos;
    /** Metres from the viewpoint, for the cap below. */
    distance: number;
}

export interface CollectPeaksOptions {
    /** Metres around the viewpoint. */
    radius: number;
    /**
     * The zoom the tiles are READ at, which is the whole cost of this.
     *
     * OpenMapTiles thins `mountain_peak` by zoom, so a low zoom is a smaller set and not merely a
     * coarser one — which is the bug this class of fix exists for. A high zoom is the full set and a
     * tile count that grows as 4^z: at a 150 km radius z12 is some 900 tiles and z14 is fourteen
     * thousand. 12 is the compromise, and it is a setting because the answer depends on the package.
     */
    zoom: number;
    /** How many summits to keep, highest first. */
    maxCount: number;
    /** Metres; summits below this are dropped before the cap. */
    minElevation: number;
}

/** The layer name the features go under, because `peaksStyle` selects `#mountain_peak`. */
export const PANORAMA_PEAKS_LAYER = 'mountain_peak';

/**
 * Every summit around the viewpoint, highest first.
 *
 * One search rather than a ring-by-ring walk: `VectorTileSearchService` already reads the tiles it
 * needs itself, and splitting it would only spread the same tile reads over more round trips.
 */
export async function collectPanoramaPeaks(viewpoint: MapPos, options: CollectPeaksOptions): Promise<PanoramaPeak[]> {
    const features = await packageService.searchInVectorTiles({
        position: viewpoint,
        searchRadius: options.radius,
        layers: [PANORAMA_PEAKS_LAYER],
        minZoom: options.zoom,
        maxZoom: options.zoom,
        // FILTERED IN THE SERVICE, not after it. The layer carries saddles, ridges and volcanoes as
        // well as peaks, and most of its features have no name or no elevation - so a budget spent
        // before the filter is mostly spent on rows that are then thrown away.
        filterExpression: "class='peak'",
        // ...and generous, because the cap below interacts badly with the cut above. The service's
        // cut is by DISTANCE (sortByDistance), so whatever the budget does not cover is dropped
        // NEAREST-FIRST - which removes exactly the far high summits a panorama is read by. At a
        // 170 km radius in the Alps the old 8000 was consumed inside the first few tens of km, and
        // Mont Blanc was cut before the elevation sort below ever saw it, while lower but nearer
        // summits survived. This has to be large enough that the cap never binds.
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

    // Highest first, so the cap keeps the summits a panorama is read by. Distance breaks a tie for
    // the same reason `text-rank` subtracts it: of two peaks the same height, the near one is the
    // one being looked at.
    peaks.sort((left, right) => right.elevation - left.elevation || left.distance - right.distance);
    return peaks.slice(0, options.maxCount);
}

/**
 * The collection the map is given.
 *
 * Deliberately the same three properties the tiles carry — `name`, `ele`, `class` — so this source
 * and the live one are interchangeable and `peaksStyle` needs no branch. `ele` goes back out as a
 * NUMBER: the style does arithmetic on it (`text-rank: [ele] - [view::distance]/1000`).
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
