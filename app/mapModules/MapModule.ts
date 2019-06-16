import Map from '~/components/Map';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { GeoHandler } from '~/handlers/GeoHandler';
import { VectorElementEventData, VectorTileEventData } from 'nativescript-carto/layers/vector';
import { Item } from './ItemsModule';
import { clog } from '~/utils/logging';
export default abstract class MapModule {
    mapView: CartoMap;
    mapComp: Map;
    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
    }
    onMapDestroyed() {
        this.mapView = null;
        this.mapComp = null;
    }
    log(...args) {
        clog(`[${this.constructor.name}]`, ...args);
    }
    onServiceLoaded?(geoHandler: GeoHandler);
    onServiceUnloaded?(geoHandler: GeoHandler);
    onMapMove?(e);
    onMapClicked?(e);
    onVectorTileClicked?(data: VectorTileEventData);
    onVectorElementClicked?(data: VectorElementEventData);
    onSelectedItem?(item: Item, oldItem: Item);
}
