import type { MassifLayer, MassifMap, MassifSource } from '@nativescript-community/ui-massifmaps/api';
import type { Feature, FeatureCollection } from 'geojson';
import { type GeoHandler, type Session, type SessionEventData, SessionState, SessionStateEvent, SessionUpdatedEvent } from '~/handlers/GeoHandler';
import MapModule, { getMapContext } from '~/mapModules/MapModule';
import { registerMapModule } from '~/mapModules/registry';
import { createTrace } from '~/routeFeatures/ride/trace';

const mapContext = getMapContext();

function lineCollection(coordinates: [number, number][]): FeatureCollection {
    const features: Feature[] = coordinates.length >= 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }] : [];
    return { type: 'FeatureCollection', features };
}

/**
 * The track of the ride being recorded, drawn as it goes. The trace comes in two layers of one source: the
 * committed part is handed to the map every few dozen fixes, the tail (the last stretch) on every fix.
 */
export default class RideTraceModule extends MapModule {
    private dataSource: MassifSource<'massif::GeoJSONVectorTileDataSource'>;
    private layer: MassifLayer<'massif::VectorTileLayer'>;
    private committedIndex: number;
    private tailIndex: number;
    private geoHandler: GeoHandler;
    private readonly trace = createTrace();
    /** how many fixes of the session the trace has seen */
    private consumed = 0;
    /** the committed part changed while there was no map to draw it on */
    private committedDirty = false;

    onServiceLoaded(geoHandler: GeoHandler) {
        this.geoHandler = geoHandler;
        geoHandler.on(SessionUpdatedEvent, this.onSession, this);
        geoHandler.on(SessionStateEvent, this.onSession, this);
        // the map came back while a ride was recording: its trace is in the session
        this.follow(geoHandler.getCurrentSession());
    }

    onServiceUnloaded(geoHandler: GeoHandler) {
        geoHandler?.off(SessionUpdatedEvent, this.onSession, this);
        geoHandler?.off(SessionStateEvent, this.onSession, this);
        this.geoHandler = null;
    }

    onMapReady(map: MassifMap) {
        super.onMapReady(map);
        this.draw(true);
    }

    onMapDestroyed() {
        super.onMapDestroyed();
        this.dataSource = null;
        this.layer = null;
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
        this.draw(true);
    }

    private onSession(event: SessionEventData) {
        this.follow(event.data);
    }

    private follow(session: Session | undefined) {
        if (!session || !this.geoHandler?.recordTrack || session.state === SessionState.STOPPED) {
            this.clear();
            return;
        }
        const fixes = session.locs;
        // a new session starts over
        if (fixes.length < this.consumed) {
            this.clear();
        }
        let committed = false;
        let changed = false;
        for (; this.consumed < fixes.length; this.consumed++) {
            const added = this.trace.add(fixes[this.consumed]);
            changed ||= !!added;
            committed ||= added === 'committed';
        }
        if (changed) {
            this.draw(committed);
        }
    }

    private clear() {
        const drawn = this.consumed > 0 || this.committedDirty;
        this.trace.reset();
        this.consumed = 0;
        this.committedDirty = false;
        if (drawn && this.dataSource) {
            this.dataSource.setGeoJSON(this.committedIndex, lineCollection([]));
            this.dataSource.setGeoJSON(this.tailIndex, lineCollection([]));
        }
    }

    private draw(committed: boolean) {
        this.committedDirty ||= committed;
        // nothing recorded, nothing to draw: the layers are only made for a ride
        if (!mapContext.getMap() || (!this.layer && !this.consumed)) {
            return;
        }
        this.getOrCreateLayer();
        if (this.committedDirty) {
            this.dataSource.setGeoJSON(this.committedIndex, lineCollection(this.trace.committed()));
            this.committedDirty = false;
        }
        this.dataSource.setGeoJSON(this.tailIndex, lineCollection(this.trace.tail()));
    }

    private getOrCreateLayer() {
        if (!this.layer) {
            const map = mapContext.getMap();
            this.dataSource = map.source('source.recording', { type: 'geojson', minZoom: 0, maxZoom: 24 });
            this.committedIndex = this.dataSource.createLayer('recording');
            this.tailIndex = this.dataSource.createLayer('recording_tail');
            this.layer = map.buildLayer('layer.recording', {
                type: 'vector',
                source: this.dataSource.id,
                style: mapContext.innerDecoder.id,
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0
            });
            mapContext.addLayer(this.layer, 'navigation');
            // a layer made late draws what was recorded before it
            this.committedDirty = true;
        }
        return this.layer;
    }
}

declare module '~/mapModules/registry' {
    interface MapModules {
        rideTrace: RideTraceModule;
    }
}

export function registerRideTraceModule() {
    registerMapModule('rideTrace', new RideTraceModule());
}
