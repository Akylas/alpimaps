import type { MassifLayer, MassifMap } from '@nativescript-community/ui-massifmaps/api';

/**
 * Every kind of layer the map can hold. A feature that needs its own layer adds its id here and
 * to LAYERS_ORDER — the position in LAYERS_ORDER is what decides what draws on top of what.
 */
export type LayerType = 'map' | 'routes' | 'customLayers' | 'hillshade' | 'selection' | 'items' | 'directions' | 'navigation' | 'userLocation' | 'search' | 'transit' | 'admin';

/** Bottom to top: the first entry draws underneath everything else. */
export const LAYERS_ORDER: LayerType[] = ['map', 'customLayers', 'admin', 'routes', 'transit', 'hillshade', 'items', 'directions', 'navigation', 'search', 'selection', 'userLocation'];

export interface AddedLayer {
    layer: MassifLayer;
    layerId: LayerType;
}

/**
 * Keeps the map's layer list ordered by LAYERS_ORDER.
 *
 * The SDK only knows a flat list of layers, so inserting one at "the right place" means working out
 * an index from the layers already added. This owns that arithmetic and the bookkeeping array that
 * mirrors the SDK's list; the map component only forwards to it.
 *
 * Everything goes through `map.layers()`, which is the facade's own `Layers` object — nothing here
 * touches a native layer list.
 *
 * The map is passed as a getter because it does not exist until the map view reports ready, while
 * modules may already have asked for layers by then.
 */
export class LayerStack {
    private readonly addedLayers: AddedLayer[] = [];

    constructor(private readonly getMap: () => MassifMap) {}

    /** The tracked layers, in map order. Used to re-add everything after an activity re-create. */
    get layers(): AddedLayer[] {
        return this.addedLayers;
    }

    private indexOfLayer(layer: MassifLayer) {
        return this.addedLayers.findIndex((added) => added.layer === layer);
    }

    private orderOf(layerId: LayerType) {
        return LAYERS_ORDER.indexOf(layerId);
    }

    /**
     * `force` re-adds a layer to a freshly created map without touching the bookkeeping: after an
     * activity re-create the array is still populated but the native map is empty.
     */
    addLayer(layer: MassifLayer, layerId: LayerType, force = false) {
        const map = this.getMap();
        if (!map) {
            return;
        }
        if (force) {
            map.add(layer);
            return;
        }
        if (this.indexOfLayer(layer) !== -1) {
            return;
        }
        const layerIndex = this.orderOf(layerId);
        // the first layer that belongs above this one — insert just before it
        const realIndex = this.addedLayers.findIndex((added) => this.orderOf(added.layerId) > layerIndex);
        if (realIndex >= 0 && realIndex < this.addedLayers.length) {
            map.add(layer, realIndex);
            this.addedLayers.splice(realIndex, 0, { layer, layerId });
        } else {
            map.add(layer);
            this.addedLayers.push({ layer, layerId });
        }
    }

    /** Adds at `index` counted from the first layer of that type, so a type can hold an ordered set. */
    insertLayer(layer: MassifLayer, layerId: LayerType, index: number) {
        const map = this.getMap();
        if (!map) {
            return;
        }
        if (this.indexOfLayer(layer) !== -1) {
            return;
        }
        const layerIndex = this.orderOf(layerId);
        const realIndex =
            Math.max(
                this.addedLayers.findIndex((added) => this.orderOf(added.layerId) >= layerIndex),
                0
            ) + index;
        const layers = map.layers();
        if (realIndex >= 0 && realIndex < layers.count()) {
            layers.insert(realIndex, layer);
            this.addedLayers.splice(realIndex, 0, { layer, layerId });
        } else {
            map.add(layer);
            this.addedLayers.push({ layer, layerId });
        }
    }

    removeLayer(layer: MassifLayer) {
        const index = this.indexOfLayer(layer);
        if (index !== -1) {
            this.addedLayers.splice(index, 1);
        }
        this.getMap()?.removeLayer(layer);
    }

    moveLayer(layer: MassifLayer, newIndex: number) {
        const map = this.getMap();
        if (!map) {
            return;
        }
        const layers = map.layers();
        newIndex = Math.max(0, Math.min(newIndex, layers.count() - 1));
        const index = this.indexOfLayer(layer);
        if (index !== -1 && index !== newIndex) {
            const moved = this.addedLayers[index];
            this.addedLayers.splice(index, 1);
            this.addedLayers.splice(newIndex, 0, moved);
        }
        layers.remove(layer);
        layers.insert(newIndex, layer);
    }

    /** Swaps a layer in place, keeping its position — used when a decoder or datasource is rebuilt. */
    replaceLayer(oldLayer: MassifLayer, layer: MassifLayer) {
        const index = this.indexOfLayer(oldLayer);
        if (index !== -1) {
            this.addedLayers[index].layer = layer;
            this.getMap()?.layers().replace(index, layer);
        }
    }

    getLayerIndex(layer: MassifLayer) {
        return this.indexOfLayer(layer);
    }

    getLayerTypeFirstIndex(layerId: LayerType) {
        const layerIndex = this.orderOf(layerId);
        return this.addedLayers.findIndex((added) => this.orderOf(added.layerId) === layerIndex);
    }

    /** Every layer of one type, or a copy of the whole stack when called without an id. */
    getLayers(layerId?: LayerType): AddedLayer[] {
        if (!layerId) {
            return this.addedLayers.slice();
        }
        const layerIndex = this.orderOf(layerId);
        const startIndex = this.addedLayers.findIndex((added) => this.orderOf(added.layerId) === layerIndex);
        const endIndex = this.addedLayers.findIndex((added) => this.orderOf(added.layerId) > layerIndex);
        if (startIndex !== -1) {
            return this.addedLayers.slice(startIndex, endIndex !== -1 ? endIndex : undefined);
        }
        return [];
    }
}
