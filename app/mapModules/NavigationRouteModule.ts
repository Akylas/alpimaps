import type { Json, MassifLayer, MassifMap, MassifObject, MassifSource, Position } from '@nativescript-community/ui-massifmaps/api';
import type { Feature, Geometry } from 'geojson';
import { type Unsubscriber, get } from 'svelte/store';
import type { GeoLocation } from '~/handlers/GeoHandler';
import { getMetersPerPixel } from '~/helpers/geolib';
import MapModule, { getMapContext } from '~/mapModules/MapModule';
import { registerMapModule } from '~/mapModules/registry';
import type { IItem } from '~/models/Item';
import { type NavigationDetour, positionsToGeoJSONLine } from '~/services/navigation/NavigationRoute';
import { navigationDetour, navigationItem, navigationLocation, navigationOriginalItem, navigationProgress, navigationRejoinTarget } from '~/stores/navigationStore';
import { computeDistanceBetween, fromPosition, geometryCoordinates } from '~/utils/geo';
import type { RouteProgress } from '~/utils/navigation';
import type { RejoinTarget } from '~/utils/navigation';

const TAG = '[NavigationRouteModule]';

const mapContext = getMapContext();

/** the routes, matching the `navigation` layer of the inner style */
const NAVIGATION_LAYER = 1;
/** the connector, on its own layer because it is redrawn on every position */
const HINT_LAYER = 2;
/**
 * Screen length (dp) an arrow keeps before its turn. The style's widths barely shrink with zoom, so an
 * arrow of fixed metres collapses to its head when zoomed out: lengths follow the zoom instead.
 */
const ARROW_SCREEN_LENGTH = 36;
/** screen length (dp) of shaft kept between the turn and the head, which comes on top of the head's own length */
const ARROW_SHAFT_AFTER = 10;
/** floor in metres, so a very close zoom does not shrink the arrow below its head */
const ARROW_MIN_LENGTH = 6;
/** below this the turn is not readable anyway and the arrow would swamp the route */
const ARROW_MIN_ZOOM = 13;
/** a turn this close to the end of the route is the arrival: no route left to draw past it */
const ARROW_END_TOLERANCE = 2;

/** the casing head's length (dp): `line-arrow-length` times `@nav_maneuver_casing_width`, keep in sync with the style */
function arrowHeadScreenLength(zoom: number) {
    const casingWidth = zoom <= 12 ? 12 : zoom <= 16 ? 12 + ((zoom - 12) * 9) / 4 : zoom <= 18 ? 21 + (zoom - 16) * 3.5 : 28;
    return casingWidth * 1.72;
}

/** metres for the arrow's screen lengths at this zoom, stepped by half a zoom so the arrow is not rebuilt every frame */
function arrowSizesAt(zoom: number, latitude: number) {
    const steppedZoom = Math.round(zoom * 2) / 2;
    const metersPerPixel = getMetersPerPixel({ lat: latitude }, steppedZoom);
    const headScreenLength = arrowHeadScreenLength(steppedZoom);
    return {
        before: Math.max(ARROW_MIN_LENGTH, Math.round(ARROW_SCREEN_LENGTH * metersPerPixel)),
        // the head eats the end of the line: the shaft past the turn only shows beyond it
        after: Math.max(ARROW_MIN_LENGTH, Math.round((headScreenLength + ARROW_SHAFT_AFTER) * metersPerPixel)),
        head: Math.round(headScreenLength * metersPerPixel)
    };
}

// Navigation follows its own route copy (`NavigationRoute`), never the selected item, so it is drawn
// on its own layer. The `navigating` style parameter makes the item/directions styles drop their selected look.
export default class NavigationRouteModule extends MapModule {
    dataSource: MassifSource<'massif::GeoJSONVectorTileDataSource'>;
    layer: MassifLayer<'massif::VectorTileLayer'>;
    private readonly subscriptions: Unsubscriber[] = [];
    private item: IItem = null;
    private originalItem: IItem = null;
    private detour: NavigationDetour = null;
    private rejoinTarget: RejoinTarget = null;
    private location: GeoLocation = null;
    private arrowBuilder: MassifObject<'massif::ManeuverArrowBuilder'>;
    // the arrows' own layer, stacked after the route's: a layer of the same tiles draws under the route
    private maneuverSource: MassifSource<'massif::GeoJSONVectorTileDataSource'>;
    private maneuverLayer: MassifLayer<'massif::VectorTileLayer'>;
    private maneuverLayerId: number;
    /** the route as the builder takes it, rebuilt with the item */
    private routePositions: Position[] = null;
    /** metres from the start of the route to each of `routePositions` */
    private routeDistances: number[] = null;
    /** what the arrow was last drawn for, so a fix on the same maneuver costs nothing */
    private arrowKey: string = null;

    constructor() {
        super();
        // stores rather than events: a subscription cannot miss a change made before the map was ready
        this.subscriptions.push(
            navigationItem.subscribe((item) => {
                this.item = item;
                this.routePositions = null;
                this.routeDistances = null;
                this.clearManeuver();
                this.draw();
            }),
            navigationProgress.subscribe((progress) => this.drawManeuver(progress)),
            navigationDetour.subscribe((detour) => {
                this.detour = detour;
                this.draw();
            }),
            navigationOriginalItem.subscribe((item) => {
                this.originalItem = item;
                this.draw();
            }),
            navigationRejoinTarget.subscribe((target) => {
                this.rejoinTarget = target;
                this.drawHint();
            }),
            navigationLocation.subscribe((location) => {
                this.location = location;
                // only matters while there is a target: the connector starts at the user
                if (this.rejoinTarget) {
                    this.drawHint();
                }
            })
        );
    }

    onMapDestroyed() {
        super.onMapDestroyed();
        this.subscriptions.forEach((unsubscribe) => unsubscribe());
        this.subscriptions.length = 0;
        this.dataSource = null;
        this.layer = null;
        // released with the map
        this.arrowBuilder = null;
        this.maneuverSource = null;
        this.maneuverLayer = null;
        this.arrowKey = null;
    }

    onMapReady(map: MassifMap) {
        super.onMapReady(map);
        // navigation may have been running before the map came back (an android activity re-create)
        this.draw();
        this.drawManeuver(get(navigationProgress));
    }

    // the arrow's length follows the zoom
    onMapMove() {
        this.drawManeuver(get(navigationProgress));
    }

    // the throttled move event can skip the final zoom, which would leave the arrows of the old one
    onMapStable() {
        this.drawManeuver(get(navigationProgress));
    }

    private getOrCreateLayer() {
        if (!this.layer) {
            const map = mapContext.getMap();
            this.dataSource = map.source('source.navigation', { type: 'geojson', simplifyTolerance: 2, minZoom: 0, maxZoom: 24 });
            this.dataSource.createLayer('navigation');
            this.dataSource.createLayer('navigation_hint');
            this.layer = map.buildLayer('layer.navigation', {
                type: 'vector',
                source: this.dataSource.id,
                style: mapContext.innerDecoder.id,
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0,
                labelRenderOrder: 'VECTOR_TILE_RENDER_ORDER_LAST'
            });
            mapContext.addLayer(this.layer, 'navigation');
        }
        return this.layer;
    }

    // the map's hook rather than a decoder event: the decoder is destroyed as part of the change
    vectorTileDecoderChanged() {
        const oldLayer = this.layer;
        if (!oldLayer) {
            return;
        }
        this.layer = null;
        this.dataSource?.destroy();
        this.dataSource = null;
        oldLayer.destroy();
        mapContext.replaceLayer(oldLayer, this.getOrCreateLayer());
        const oldManeuverLayer = this.maneuverLayer;
        if (oldManeuverLayer) {
            this.maneuverLayer = null;
            this.maneuverSource?.destroy();
            this.maneuverSource = null;
            oldManeuverLayer.destroy();
            mapContext.replaceLayer(oldManeuverLayer, this.getOrCreateManeuverLayer());
        }
        this.draw();
        this.drawHint();
        this.arrowKey = null;
        this.drawManeuver(get(navigationProgress));
    }

    private getOrCreateManeuverLayer() {
        if (!this.maneuverLayer) {
            // after the route's layer, so it is added above it in the same stack slot
            this.getOrCreateLayer();
            const map = mapContext.getMap();
            this.maneuverSource = map.source('source.navigation.maneuver', { type: 'geojson', minZoom: 0, maxZoom: 24 });
            this.maneuverLayerId = this.maneuverSource.createLayer('maneuver');
            this.maneuverLayer = map.buildLayer('layer.navigation.maneuver', {
                type: 'vector',
                source: this.maneuverSource.id,
                style: mapContext.innerDecoder.id,
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0
            });
            mapContext.addLayer(this.maneuverLayer, 'navigation');
        }
        return this.maneuverLayer;
    }

    private clearManeuver() {
        this.arrowKey = null;
        this.maneuverSource?.setGeoJSON(this.maneuverLayerId, { type: 'FeatureCollection', features: [] });
    }

    // the next maneuver and the one after it (the banner's "then"); none on a detour, whose
    // instructions index the detour leg, nor off route
    private drawManeuver(progress: RouteProgress) {
        // idle, and nothing drawn: onMapMove lands here on every frame
        if (!progress?.instruction && !this.arrowKey) {
            return;
        }
        const map = mapContext.getMap();
        if (!map) {
            return;
        }
        const item = this.item;
        const camera = map.camera();
        const zoom = camera.zoom();
        const onRoute = !!progress && !progress.offRoute && !progress.onDetour && !!progress.instruction && !!item && zoom >= ARROW_MIN_ZOOM;
        const arrows = onRoute ? this.computeArrows(progress, zoom, fromPosition(camera.position()).lat) : [];
        const key = arrows.length ? `${item.id}:${arrows.map((arrow) => `${arrow.index}/${Math.round(arrow.lengthBefore)}/${Math.round(arrow.lengthAfter)}`).join(',')}` : null;
        if (key === this.arrowKey || (!key && !this.maneuverLayer)) {
            return;
        }
        this.arrowKey = key;
        this.getOrCreateManeuverLayer();
        const features: Json[] = [];
        if (key) {
            if (!this.arrowBuilder) {
                this.arrowBuilder = mapContext.getMap().object('geometry', 'navigation.maneuver', { type: 'maneuver-arrow', lengthBefore: ARROW_MIN_LENGTH, lengthAfter: ARROW_MIN_LENGTH });
            }
            arrows.forEach(({ index, lengthAfter, lengthBefore }) => {
                this.arrowBuilder.set('lengthBefore', lengthBefore);
                this.arrowBuilder.set('lengthAfter', lengthAfter);
                const arrow = this.arrowBuilder.call('buildArrowAtIndex', this.routePositions, index);
                if (arrow && typeof arrow === 'object' && !Array.isArray(arrow) && Array.isArray(arrow.features)) {
                    features.push(...arrow.features);
                }
            });
        }
        this.maneuverSource.setGeoJSON(this.maneuverLayerId, { type: 'FeatureCollection', features });
    }

    // The head eats the end of its line, so the route past the last turn has to be longer than the head:
    // otherwise the shaft after the turn is gone and the head sits on the corner as a blob.
    private computeArrows(progress: RouteProgress, zoom: number, latitude: number) {
        const item = this.item;
        if (!this.routePositions) {
            this.routePositions = item.geometry ? geometryCoordinates(item.geometry).map((coordinates): Position => [coordinates[0], coordinates[1]]) : [];
            this.routeDistances = this.routePositions.map(() => 0);
            for (let index = 1; index < this.routePositions.length; index++) {
                this.routeDistances[index] = this.routeDistances[index - 1] + computeDistanceBetween(fromPosition(this.routePositions[index - 1]), fromPosition(this.routePositions[index]));
            }
        }
        const routeLength = this.routeDistances[this.routeDistances.length - 1] ?? 0;
        const sizes = arrowSizesAt(zoom, latitude);
        const instruction = progress.instruction;
        const following = item.instructions?.[progress.instructionIndex + 1];
        const previousLegLength = item.instructions?.[progress.instructionIndex - 1]?.dist;
        // not back through the previous turn
        const lengthBefore = previousLegLength > 0 ? Math.min(sizes.before, previousLegLength / 2) : sizes.before;
        const routeAfter = (turnIndex: number) => routeLength - (this.routeDistances[turnIndex] ?? routeLength);
        const fits = (turnIndex: number) => {
            const left = routeAfter(turnIndex);
            return left >= sizes.after || left <= ARROW_END_TOLERANCE;
        };
        // at the end of the route there is no shaft past the turn, so the one before it has to hold the head
        const arrow = (turn: { index: number }, before: number, length = sizes.after) => ({
            index: turn.index,
            lengthBefore: routeAfter(turn.index) <= ARROW_END_TOLERANCE ? Math.max(before, sizes.after) : before,
            lengthAfter: length
        });
        const gap = progress.distanceToFollowingInstruction;
        // two turns closer than their arrows and a head apart: one arrow through both, one head, instead
        // of the second arrow starting under the first one's head
        if (following && gap >= 0 && gap <= sizes.before + sizes.after + sizes.head && fits(following.index)) {
            return [arrow(instruction, lengthBefore, gap + sizes.after)];
        }
        return [fits(instruction.index) ? arrow(instruction, lengthBefore) : null, following && fits(following.index) ? arrow(following, sizes.before) : null].filter(Boolean);
    }

    // at most three features: rebuilding is cheapest
    private draw() {
        const item = this.item;
        const features: Feature[] = [];
        if (item) {
            if (this.originalItem?.geometry) {
                // what the user planned, kept visible so a reroute reads as a change and not a mystery
                features.push(lineFeature('original', this.originalItem.geometry));
            }
            if (item.geometry) {
                features.push(lineFeature('route', item.geometry));
            }
            if (this.detour) {
                features.push(...detourFeatures(this.detour));
            }
        }
        if (!features.length && !this.layer) {
            // nothing to draw and nothing drawn: do not create a layer just to empty it
            return;
        }
        this.getOrCreateLayer();
        DEV_LOG && console.log(TAG, 'drawing', features.map((feature) => feature.properties.class).join(', ') || 'nothing');
        this.dataSource.setGeoJSON(NAVIGATION_LAYER, { type: 'FeatureCollection', features });
        this.setNavigating(!!item);
    }

    // straight line to the rejoin point: a direction hint, not a path to follow
    private drawHint() {
        const target = this.rejoinTarget;
        const location = this.location;
        const features: Feature[] = [];
        if (target && location) {
            features.push(
                lineFeature('connector', {
                    type: 'LineString',
                    coordinates: [
                        [location.lon, location.lat],
                        [target.position.lon, target.position.lat]
                    ]
                })
            );
        }
        if (!features.length && !this.layer) {
            return;
        }
        this.getOrCreateLayer();
        this.dataSource.setGeoJSON(HINT_LAYER, { type: 'FeatureCollection', features });
    }

    /** Tells the item and directions styles to stop drawing their selected look. */
    private setNavigating(navigating: boolean) {
        mapContext.innerDecoder?.call('setStyleParameter', 'navigating', navigating ? '1' : '0');
    }
}

function lineFeature(className: string, geometry: Geometry, properties: Record<string, unknown> = {}): Feature {
    return { type: 'Feature', geometry, properties: { class: className, ...properties } };
}

function detourFeatures(detour: NavigationDetour): Feature[] {
    const geometry = positionsToGeoJSONLine(detour.positions);
    return geometry ? [lineFeature('detour', geometry)] : [];
}

declare module '~/mapModules/registry' {
    interface MapModules {
        navigationRoute: NavigationRouteModule;
    }
}

export function registerNavigationRouteModule() {
    registerMapModule('navigationRoute', new NavigationRouteModule());
}
