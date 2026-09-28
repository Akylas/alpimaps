import type { MassifLayer, MassifMap, MassifSource } from '@nativescript-community/ui-massifmaps/api';
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

    constructor() {
        super();
        // stores rather than events: a subscription cannot miss a change made before the map was ready
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

    onMapReady(map: MassifMap) {
        super.onMapReady(map);
        // navigation may have been running before the map came back (an android activity re-create)
        this.draw();
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
        this.draw();
        this.drawHint();
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
