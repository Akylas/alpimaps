import type { MassifLayer, MassifMap, MassifSource } from '@nativescript-community/ui-massifmaps/api';
import type { Feature } from 'geojson';
import { type Unsubscriber, get, writable } from 'svelte/store';
import { type GeoHandler, UserLocationdEvent, type UserLocationdEventData } from '~/handlers/GeoHandler';
import { getMetersPerPixel } from '~/helpers/geolib';
import MapModule, { getMapContext } from '~/mapModules/MapModule';
import { userFollowStore } from '~/mapModules/UserLocationModule';
import { registerMapModule } from '~/mapModules/registry';
import {
    type Fix,
    type Junction,
    type LookAhead,
    type RoadAhead,
    type TurnOption,
    destinationPoint,
    distanceMeters,
    exitSide,
    lookAheadDue,
    roadAheadChip,
    turnOptions
} from '~/routeFeatures/junctions/junctions';
import { cumulativeDistances } from '~/routeFeatures/junctions/traceJunctions';
import type { TravelProfile } from '~/routeFeatures/junctions/travelMode';
import { packageService } from '~/services/PackageService';
import { isNavigating, junctionLookAhead, navigationItem, navigationProgress, showNoEntry, showTurnOptions } from '~/stores/navigationStore';
import { activeTravelProfile } from '~/stores/travelModeStore';

const TAG = '[JunctionOptionsModule]';
const mapContext = getMapContext();

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
    /** a free ride: the fix the graph was last asked from, what it said, and for which profile */
    private ride: { fix: Fix; look: LookAhead; profile: TravelProfile } = null;
    private rideBusy = false;
    private geoHandler: GeoHandler;

    constructor() {
        super();
        // stores rather than events: a subscription cannot miss a change made before the map was ready
        this.subscriptions.push(
            showTurnOptions.subscribe(() => this.reset()),
            showNoEntry.subscribe(() => this.reset()),
            junctionLookAhead.subscribe(() => this.reset()),
            activeTravelProfile.subscribe(() => this.update()),
            navigationItem.subscribe(() => this.update()),
            isNavigating.subscribe(() => this.update()),
            userFollowStore.subscribe(() => this.update()),
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

    onServiceLoaded(geoHandler: GeoHandler) {
        this.geoHandler = geoHandler;
        geoHandler.on(UserLocationdEvent, this.onLocation, this);
    }

    onServiceUnloaded(geoHandler: GeoHandler) {
        geoHandler?.off(UserLocationdEvent, this.onLocation, this);
        this.geoHandler = null;
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
        this.ride = null;
        if (get(junctionChips)) {
            junctionChips.set(null);
        }
        this.dataSource?.setGeoJSON(this.layerIndex, { type: 'FeatureCollection', features: [] });
    }

    // what is shown or how far it looks changed: what was read is read again
    private reset() {
        this.ride = null;
        this.stubKey = null;
        this.update();
    }

    private update() {
        if (!get(showTurnOptions) && !get(showNoEntry)) {
            this.clear();
        } else if (get(isNavigating)) {
            this.ride = null;
            this.updateRoute();
        } else if (get(userFollowStore)) {
            this.updateRide();
        } else {
            this.clear();
        }
    }

    // a route is followed: the junctions come from the route's own graph edges, read once
    private updateRoute() {
        const item = get(navigationItem);
        const progress = get(navigationProgress);
        if (!item || !progress || progress.offRoute || progress.onDetour) {
            this.clear();
            return;
        }
        void this.load(item, get(activeTravelProfile));
        if (!this.distances) {
            return;
        }
        const from = this.distances[progress.onPathIndex] ?? 0;
        this.showChips(from, null);
    }

    // a free ride: no route, so the graph is asked what is ahead, again once the user has moved or turned
    private updateRide() {
        if (this.ride && this.ride.profile !== get(activeTravelProfile)) {
            this.clear();
        }
    }

    private onLocation(event: UserLocationdEventData) {
        const location = event.location;
        if (!location || !this.active() || get(isNavigating) || !get(userFollowStore)) {
            return;
        }
        const fix: Fix = { lat: location.lat, lon: location.lon, bearing: location.bearing, time: Date.now() };
        if (!this.rideBusy && lookAheadDue(this.ride?.fix ?? null, fix)) {
            void this.lookAhead(fix);
        } else if (this.ride) {
            this.showRide(distanceMeters(this.ride.fix, fix));
        }
    }

    private async lookAhead(fix: Fix) {
        this.rideBusy = true;
        const profile = get(activeTravelProfile);
        try {
            const look = await packageService.lookAhead({ lat: fix.lat, lon: fix.lon, bearing: fix.bearing, length: get(junctionLookAhead), profile });
            if (look && this.active() && !get(isNavigating) && get(userFollowStore)) {
                this.ride = { fix, look, profile };
                this.showRide(0);
            }
        } catch (error) {
            DEV_LOG && console.error(TAG, 'look ahead failed', error);
        } finally {
            this.rideBusy = false;
        }
    }

    // `from`: meters travelled since the graph was asked
    private showRide(from: number) {
        const { look } = this.ride;
        this.junctions = look.junctions;
        this.showChips(from, look.ahead);
    }

    private active() {
        return get(showTurnOptions) || get(showNoEntry);
    }

    // the turns are the opt-in; the no-entry warnings are on unless switched off
    private showChips(from: number, ahead: RoadAhead | undefined) {
        const lead = get(junctionLookAhead);
        const turns = get(showTurnOptions);
        const { left, right } = turns ? turnOptions(this.junctions, from, lead) : { left: null, right: null };
        junctionChips.set({ left, right, ahead: get(showNoEntry) ? roadAheadChip(ahead, from, lead) : null });
        this.drawStubs(from, lead, turns, get(showNoEntry));
    }

    private drawStubs(from: number, lead: number, turns: boolean, noEntry: boolean) {
        const map = mapContext.getMap();
        if (!map) {
            return;
        }
        const zoom = map.camera().zoom();
        const ahead = this.junctions.filter((junction) => junction.distance >= from && junction.distance <= from + lead).slice(0, STUB_JUNCTIONS);
        const length = ahead.length && zoom >= STUB_MIN_ZOOM ? Math.max(STUB_MIN_LENGTH, Math.round(STUB_SCREEN_LENGTH * getMetersPerPixel({ lat: ahead[0].lat }, Math.round(zoom * 2) / 2))) : 0;
        const key = length ? `${length}:${turns}:${noEntry}:${ahead.map((junction) => junction.distance.toFixed(0)).join(',')}` : null;
        if (key === this.stubKey || (!key && !this.layer)) {
            return;
        }
        this.stubKey = key;
        const features: Feature[] = [];
        for (const junction of key ? ahead : []) {
            for (const exit of junction.exits) {
                if (!exitSide(junction.arrival, exit.heading) || !(exit.enterable ? turns : noEntry)) {
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
