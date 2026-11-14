import type { MassifLayer, MassifMap, MassifSource } from '@nativescript-community/ui-massifmaps/api';
import type { Feature } from 'geojson';
import { type Unsubscriber, get, writable } from 'svelte/store';
import { getMetersPerPixel } from '~/helpers/geolib';
import MapModule, { getMapContext } from '~/mapModules/MapModule';
import { registerMapModule } from '~/mapModules/registry';
import { type Junction, type RoadAhead, type TurnOption, destinationPoint, exitSide, turnOptions } from '~/routeFeatures/junctions/junctions';
import { cumulativeDistances } from '~/routeFeatures/junctions/traceJunctions';
import type { TravelProfile } from '~/routeFeatures/junctions/travelMode';
import { packageService } from '~/services/PackageService';
import { isNavigating, navigationItem, navigationProgress } from '~/stores/navigationStore';
import { activeTravelProfile, showTurnOptions } from '~/stores/travelModeStore';

const TAG = '[JunctionOptionsModule]';
const mapContext = getMapContext();

/** how far ahead the chips look, in meters */
const LEAD = 400;
/** the junctions whose side streets are drawn on the map */
const STUB_JUNCTIONS = 3;
/** screen length (dp) of a side street's stub, floored in meters so a close zoom does not shrink it to nothing */
const STUB_SCREEN_LENGTH = 26;
const STUB_MIN_LENGTH = 6;
/** below this the stubs would only clutter the map */
const STUB_MIN_ZOOM = 15;

export interface JunctionChipsState {
    left: TurnOption | null;
    right: TurnOption | null;
    ahead: RoadAhead | null;
}

/** What the chips show; null while there is nothing to tell. */
export const junctionChips = writable<JunctionChipsState>(null);

/** The side streets at the next junctions, as chips and as stubs on the map. */
export default class JunctionOptionsModule extends MapModule {
    private dataSource: MassifSource<'massif::GeoJSONVectorTileDataSource'>;
    private layer: MassifLayer<'massif::VectorTileLayer'>;
    private layerIndex: number;
    private readonly subscriptions: Unsubscriber[] = [];
    /** the route's junctions, and the meters from the start to each of its points */
    private junctions: Junction[] = [];
    private distances: number[] = null;
    private loadedKey: string = null;
    private stubKey: string = null;

    constructor() {
        super();
        // stores rather than events: a subscription cannot miss a change made before the map was ready
        this.subscriptions.push(
            showTurnOptions.subscribe(() => this.update()),
            activeTravelProfile.subscribe(() => this.update()),
            navigationItem.subscribe(() => this.update()),
            isNavigating.subscribe(() => this.update()),
            navigationProgress.subscribe(() => this.update())
        );
    }

    onMapDestroyed() {
        super.onMapDestroyed();
        this.subscriptions.forEach((unsubscribe) => unsubscribe());
        this.subscriptions.length = 0;
        this.dataSource = null;
        this.layer = null;
        this.stubKey = null;
    }

    onMapReady(map: MassifMap) {
        super.onMapReady(map);
        this.update();
    }

    // the stubs' length follows the zoom
    onMapStable() {
        this.update();
    }

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
        this.stubKey = null;
        this.update();
    }

    private getOrCreateLayer() {
        if (!this.layer) {
            const map = mapContext.getMap();
            this.dataSource = map.source('source.junctions', { type: 'geojson', minZoom: 0, maxZoom: 24 });
            this.layerIndex = this.dataSource.createLayer('junctions');
            this.layer = map.buildLayer('layer.junctions', {
                type: 'vector',
                source: this.dataSource.id,
                style: mapContext.innerDecoder.id,
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0
            });
            mapContext.addLayer(this.layer, 'navigation');
        }
        return this.layer;
    }

    private async load(item, profile: TravelProfile) {
        const key = `${item.id}:${profile}`;
        if (key === this.loadedKey) {
            return;
        }
        this.loadedKey = key;
        this.junctions = [];
        this.distances = null;
        try {
            const junctions = await packageService.getRouteJunctions({ item, profile });
            if (this.loadedKey !== key) {
                return;
            }
            this.junctions = junctions;
            this.distances = cumulativeDistances(packageService.getRouteItemPoses(item));
            this.update();
        } catch (error) {
            DEV_LOG && console.error(TAG, 'junctions failed', error);
        }
    }

    private clear() {
        this.loadedKey = null;
        this.junctions = [];
        this.distances = null;
        this.stubKey = null;
        if (get(junctionChips)) {
            junctionChips.set(null);
        }
        this.dataSource?.setGeoJSON(this.layerIndex, { type: 'FeatureCollection', features: [] });
    }

    // a route is followed: the junctions come from the route's own graph edges, read once
    private update() {
        const item = get(navigationItem);
        const progress = get(navigationProgress);
        if (!get(showTurnOptions) || !get(isNavigating) || !item || !progress || progress.offRoute || progress.onDetour) {
            this.clear();
            return;
        }
        void this.load(item, get(activeTravelProfile));
        if (!this.distances) {
            return;
        }
        const from = this.distances[progress.onPathIndex] ?? 0;
        const { left, right } = turnOptions(this.junctions, from, LEAD);
        junctionChips.set({ left, right, ahead: null });
        this.drawStubs(from);
    }

    private drawStubs(from: number) {
        const map = mapContext.getMap();
        if (!map) {
            return;
        }
        const zoom = map.camera().zoom();
        const ahead = this.junctions.filter((junction) => junction.distance >= from && junction.distance <= from + LEAD).slice(0, STUB_JUNCTIONS);
        const length = ahead.length && zoom >= STUB_MIN_ZOOM ? Math.max(STUB_MIN_LENGTH, Math.round(STUB_SCREEN_LENGTH * getMetersPerPixel({ lat: ahead[0].lat }, Math.round(zoom * 2) / 2))) : 0;
        const key = length ? `${length}:${ahead.map((junction) => junction.distance.toFixed(0)).join(',')}` : null;
        if (key === this.stubKey || (!key && !this.layer)) {
            return;
        }
        this.stubKey = key;
        const features: Feature[] = [];
        for (const junction of key ? ahead : []) {
            for (const exit of junction.exits) {
                if (!exitSide(junction.arrival, exit.heading)) {
                    continue;
                }
                const end = destinationPoint(junction.lat, junction.lon, exit.heading, length);
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [junction.lon, junction.lat],
                            [end.lon, end.lat]
                        ]
                    },
                    properties: { class: exit.enterable ? 'enter' : 'forbid' }
                });
            }
        }
        this.getOrCreateLayer();
        this.dataSource.setGeoJSON(this.layerIndex, { type: 'FeatureCollection', features });
    }
}

declare module '~/mapModules/registry' {
    interface MapModules {
        junctionOptions: JunctionOptionsModule;
    }
}

export function registerJunctionOptionsModule() {
    registerMapModule('junctionOptions', new JunctionOptionsModule());
}
