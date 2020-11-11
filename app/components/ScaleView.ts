import BaseVueComponent from './BaseVueComponent';
import { Component } from 'vue-property-decorator';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { IMapModule } from '~/mapModules/MapModule';
import Map from '~/components/Map';
import { MapPos } from '@nativescript-community/ui-carto/core';
import { Screen } from '@nativescript/core/platform';
import { convertDistance } from '~/helpers/formatter';

function getMetersPerPixel(pos: MapPos<LatLonKeys>, zoom: number) {
    // 156543.03392804097 == 2 * Math.PI * 6378137 / 256
    // return dpi undependant pixels
    return (156543.03392804097 * Math.cos((pos.lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

const DPI = Screen.mainScreen.widthDIPs;
const XDPI = DPI / Screen.mainScreen.scale;
const PX_PER_CM = XDPI / 2.54;
const INCH_IN_CM = 2.54;

@Component({})
export default class ScaleView extends BaseVueComponent implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    mapComp: Map;

    scaleText = null;
    scaleWidth = 80;

    constructor() {
        super();
    }
    mounted() {
        super.mounted();
    }

    updateData() {
        const cartoMap = this.mapView;
        if (!cartoMap) {
            return;
        }
        const zoom = cartoMap.zoom;

        const newMpp = Math.round(getMetersPerPixel(cartoMap.focusPos, zoom) * 100) / 100;
        const metersPerCM = PX_PER_CM * newMpp;
        const data = convertDistance(metersPerCM);
        this.scaleText = `${data.value.toFixed(1)} ${data.unit}(${zoom.toFixed(1)})`;
    }
    onMapReady(mapComp: Map, mapView: CartoMap<LatLonKeys>) {
        this.mapView = mapView;
        this.mapComp = mapComp;
        this.updateData();
    }
    onMapDestroyed() {
        this.mapView = null;
        this.mapComp = null;
    }
    onLayoutChange() {
        this.scaleWidth = INCH_IN_CM * DPI;
        this.updateData();
    }
    onMapMove(e) {
        const cartoMap = this.mapView;
        if (!cartoMap) {
            return;
        }
        this.updateData();
        // console.log(zoom, newMpp, metersPerCM, data, this.scaleText);
    }
}
