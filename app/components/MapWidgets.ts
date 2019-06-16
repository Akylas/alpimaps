import { CartoMap } from 'nativescript-carto/ui/ui';
import { Component } from 'vue-property-decorator';
import Map from '~/components/Map';
import { GeoHandler } from '~/handlers/GeoHandler';
import { Item } from '~/mapModules/ItemsModule';
import MapModule from '~/mapModules/MapModule';
import BgServiceComponent from './BgServiceComponent';

@Component({
    // components: {}
})
export default class MapWidgets extends BgServiceComponent implements MapModule {
    mapView: CartoMap;
    mapComp: Map;

    currentMapRotation = 0;

    selectedItem: Item = null;
    onSelectedItem(selectedItem: Item, oldItem: Item) {
        this.selectedItem = selectedItem;
    }

    mounted() {
        super.mounted();
    }

    onServiceLoaded(geoHandler: GeoHandler) {}
    onServiceUnloaded(geoHandler: GeoHandler) {}

    resetBearing() {
        this.mapView.setBearing(0, 200);
    }

    onMapMove(e) {
        const cartoMap = this.mapView;
        if (!cartoMap) {
            return;
        }
        const bearing = cartoMap.bearing;
        // this.log('onMapMove', bearing);
        this.currentMapRotation = Math.round(bearing * 100) / 100;
        // if (zoom < 10) {
        //     this.suggestionPackage = undefined;
        //     this.suggestionPackageName = undefined;
        // }
    }

    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
    }
    onMapDestroyed() {
        this.mapView = null;
        this.mapComp = null;
    }
}
