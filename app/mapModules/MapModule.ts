import Map from '~/components/Map';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { GeoHandler } from '~/handlers/GeoHandler';
import { VectorElementEventData, VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
import Observable from '@nativescript-community/observable';
import { IItem } from '~/models/Item';

export interface IMapModule {
    onMapReady(mapComp: Map, mapView: CartoMap<LatLonKeys>);
    onMapDestroyed();
    onServiceLoaded?(geoHandler: GeoHandler);
    onServiceUnloaded?(geoHandler: GeoHandler);
    onMapMove?(e);
    onMapClicked?(e);
    onVectorTileClicked?(data: VectorTileEventData<LatLonKeys>);
    onVectorElementClicked?(data: VectorElementEventData<LatLonKeys>);
    onSelectedItem?(item: IItem, oldItem: IItem);
}

export default abstract class MapModule extends Observable implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    mapComp: Map;
    onMapReady(mapComp: Map, mapView: CartoMap<LatLonKeys>) {
        this.mapView = mapView;
        this.mapComp = mapComp;
    }
    onMapDestroyed() {
        this.mapView = null;
        this.mapComp = null;
    }
    log(...args) {
        console.log(`[${this.constructor.name}]`, ...args);
    }
    onServiceLoaded?(geoHandler: GeoHandler);
    onServiceUnloaded?(geoHandler: GeoHandler);
    onMapMove?(e);
    onMapClicked?(e);
    onVectorTileClicked?(data: VectorTileEventData<LatLonKeys>);
    onVectorElementClicked?(data: VectorElementEventData<LatLonKeys>);
    onSelectedItem?(item: IItem, oldItem: IItem);
}
