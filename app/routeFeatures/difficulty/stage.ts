import { SAC_EDGE_ATTRIBUTES, sacRuns } from '~/routeFeatures/difficulty/runs';
import { scaleForActivity } from '~/routeFeatures/difficulty/scale';
import { mtbRuns, tileLines } from '~/routeFeatures/difficulty/tileMatch';
import { networkService } from '~/services/NetworkService';
import { packageService } from '~/services/PackageService';
import { layerInputsHash } from '~/utils/routeAnalysis/freshness';
import { type AnalysisStage, StageError } from '~/utils/routeAnalysis/pipeline';

/** What the mtb scale needs of the route's edges: where each is on the route, the level comes from the tiles. */
const MTB_EDGE_ATTRIBUTES = ['edge.begin_shape_index', 'edge.end_shape_index'];

/** Route points per tile search: the service measures every feature to the whole line, so a long route is searched in parts. */
const TILE_SEARCH_POINTS = 200;
/** The search radius in metres: wider than the match tolerance, `mtbRuns` does the fine reading. */
const TILE_SEARCH_RADIUS = 40;
/** The tiles are read at the zoom the paths of the map are at. */
const TILE_SEARCH_ZOOM = 14;

/** The tile features along the route, `null` when the app has no offline tiles to read. */
async function tileFeaturesAlong(points: { lat: number; lon: number }[], aborted: () => boolean) {
    const features: GeoJSON.Feature[] = [];
    for (let start = 0; start < points.length - 1; start += TILE_SEARCH_POINTS - 1) {
        if (aborted()) {
            throw new StageError('error', 'aborted');
        }
        const found = await packageService.searchInVectorTiles({
            geometry: { type: 'LineString', coordinates: points.slice(start, start + TILE_SEARCH_POINTS).map(({ lat, lon }) => [lon, lat]) },
            searchRadius: TILE_SEARCH_RADIUS,
            layers: ['transportation'],
            minZoom: TILE_SEARCH_ZOOM,
            maxZoom: TILE_SEARCH_ZOOM,
            maxResults: 100000,
            // it drops what has the same name: paths have none
            preventDuplicates: false,
            sortByDistance: false
        });
        if (!found) {
            return null;
        }
        features.push(...found);
    }
    return features;
}

/**
 * Reads how hard the route is: a hike from the `sac_scale` Valhalla matches on each edge, a bike ride from the `mtb_scale`
 * of the tile lines it runs along. Valhalla has no mtb scale on its edges.
 */
export const difficultyStage: AnalysisStage = {
    layer: 'difficulty',
    // the offline routing service is one singleton, shared with the other stages that ask it
    resource: 'routing',
    async run({ inputs, item, signal }) {
        const scale = scaleForActivity(inputs.activity);
        if (!scale) {
            throw new StageError('error', 'no difficulty scale for this activity');
        }
        if (!packageService.offlineRoutingSearchService() && !networkService.connected) {
            throw new StageError('offline');
        }
        const edges = await packageService.getStats({ item, profile: scale === 'sac' ? 'pedestrian' : 'bicycle', attributes: scale === 'sac' ? SAC_EDGE_ATTRIBUTES : MTB_EDGE_ATTRIBUTES });
        if (!edges?.length) {
            throw new StageError('error', 'no route to match');
        }
        let runs;
        if (scale === 'sac') {
            runs = sacRuns(edges);
        } else {
            const points = packageService.getRouteItemPoses(item);
            const features = await tileFeaturesAlong(points, () => signal.aborted);
            // no road of the tiles along the route at all: they are not there, which is not a route with no rated trail
            if (!features?.length) {
                throw new StageError('error', 'no offline tiles');
            }
            const data = item.profile?.data;
            // the climb of an edge is read where the profile and the route have the same points
            const elevations = data?.length === points.length ? data.map((point) => point.a) : undefined;
            runs = mtbRuns(
                edges.map((edge) => ({ begin: edge.begin_shape_index, end: edge.end_shape_index })),
                points.map(({ lat, lon }) => [lon, lat]),
                tileLines(features),
                { elevations }
            );
        }
        return {
            prov: {
                computedAt: Date.now(),
                inputsHash: layerInputsHash('difficulty', inputs),
                provider: scale === 'sac' ? (packageService.offlineRoutingSearchService() ? 'valhalla-offline' : 'valhalla-online') : 'valhalla+tiles',
                quality: 'ok'
            },
            data: { v: 1 as const, scale, src: scale === 'sac' ? ('valhalla' as const) : ('tiles' as const), runs }
        };
    }
};
