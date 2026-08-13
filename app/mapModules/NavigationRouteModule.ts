import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
import { VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import type { Feature, Geometry } from 'geojson';
import type { Unsubscriber } from 'svelte/store';
import type { GeoLocation } from '~/handlers/GeoHandler';
import MapModule, { getMapContext } from '~/mapModules/MapModule';
import { registerMapModule } from '~/mapModules/registry';
import type { IItem } from '~/models/Item';
import { type NavigationDetour, positionsToGeoJSONLine } from '~/services/navigation/NavigationRoute';
import { navigationDetour, navigationItem, navigationLocation, navigationOriginalItem, navigationRejoinTarget } from '~/stores/navigationStore';
import type { RejoinTarget } from '~/utils/navigation';

const TAG = '[NavigationRouteModule]';

const mapContext = getMapContext();

/** the routes, matching the `navigation` layer of the inner style */
const NAVIGATION_LAYER = 1;
/** the connector, on its own layer because it is redrawn on every position */
const HINT_LAYER = 2;

/**
 * Draws what navigation is actually following.
 *
 * Navigation runs on its own copy of the route (see `NavigationRoute`), never on the selected item, so
 * the map cannot rely on the selection to show it: this module owns a layer of its own and draws the
 * followed route, the detour taking the user back to it, and the route a full reroute replaced.
 *
 * While it is drawing, the `navigating` style parameter tells the items and directions styles to drop
 * their selected look, so the planned route stays visible underneath without competing with the line
 * the user is meant to follow. The selected item itself is never touched — it is still there, with the
 * same item sheet, once navigation ends.
 */
export default class NavigationRouteModule extends MapModule {
    dataSource: GeoJSONVectorTileDataSource;
    layer: VectorTileLayer;
    private readonly subscriptions: Unsubscriber[] = [];
    private item: IItem = null;
    private originalItem: IItem = null;
    private detour: NavigationDetour = null;
    private rejoinTarget: RejoinTarget = null;
    private location: GeoLocation = null;

    constructor() {
        super();
        // stores rather than navigation events: what has to be drawn is exactly what they hold, and a
        // subscription cannot miss a change that happened before the map was ready
        this.subscriptions.push(
            navigationItem.subscribe((item) => {
                this.item = item;
                this.draw();
            }),
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
    }

    onMapReady(mapView: CartoMap<LatLonKeys>) {
        super.onMapReady(mapView);
        // navigation may have been running before the map came back (an android activity re-create)
        this.draw();
    }

    private getOrCreateLayer() {
        if (!this.layer) {
            this.dataSource = new GeoJSONVectorTileDataSource({ simplifyTolerance: 2, minZoom: 0, maxZoom: 24 });
            this.dataSource.createLayer('navigation');
            this.dataSource.createLayer('navigation_hint');
            this.layer = new VectorTileLayer({
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0,
                labelRenderOrder: VectorTileRenderOrder.LAST,
                dataSource: this.dataSource,
                decoder: mapContext.innerDecoder
            });
            // the decoder is rebuilt on a style change, and a layer holds the old one for ever
            mapContext.innerDecoder.once('change', this.rebuildLayer, this);
            mapContext.addLayer(this.layer, 'navigation');
        }
        return this.layer;
    }

    private rebuildLayer() {
        const oldLayer = this.layer;
        if (!oldLayer) {
            return;
        }
        this.layer = null;
        this.dataSource = null;
        mapContext.replaceLayer(oldLayer, this.getOrCreateLayer());
        this.draw();
        this.drawHint();
    }

    /** Redraws everything the layer holds. There are at most three features: rebuilding is cheapest. */
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
        this.dataSource.setLayerGeoJSONString(NAVIGATION_LAYER, { type: 'FeatureCollection', features });
        this.setNavigating(!!item);
    }

    /**
     * The straight line from the user to the point they are being sent back to.
     *
     * It is not a way to go — there may be a cliff across it — it is the answer to "which way is the
     * route", which is the first thing you want when you realise you left it.
     */
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
        this.dataSource.setLayerGeoJSONString(HINT_LAYER, { type: 'FeatureCollection', features });
    }

    /** Tells the item and directions styles to stop drawing their selected look. */
    private setNavigating(navigating: boolean) {
        mapContext.innerDecoder?.setStyleParameter('navigating', navigating ? '1' : '0');
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
