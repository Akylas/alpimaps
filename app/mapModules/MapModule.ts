import Map from '~/components/Map';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { GeoHandler } from '~/handlers/GeoHandler';
import { VectorElementEventData, VectorTileEventData } from 'nativescript-carto/layers/vector';
export default abstract class MapModule {
    mapView: CartoMap;
    mapComp: Map;
    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
    }
    onServiceLoaded?(geoHandler: GeoHandler);
    onServiceUnloaded?(geoHandler: GeoHandler);
    onMapMove?(e);
    onMapClicked?(e);
    onVectorTileClicked?(data: VectorTileEventData);
    onVectorElementClicked?(data: VectorElementEventData);
}
