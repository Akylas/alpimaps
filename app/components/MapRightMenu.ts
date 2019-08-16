import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { localize } from 'nativescript-localize';
import * as appSettings from 'tns-core-modules/application-settings/application-settings';
import { profile } from 'tns-core-modules/profiling';
import { action } from 'ui/dialogs';
import { Component } from 'vue-property-decorator';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import BaseVueComponent from './BaseVueComponent';
import Map, { MapModules } from './Map';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { IMapModule } from '~/mapModules/MapModule';
import { ObservableArray } from 'tns-core-modules/data/observable-array/observable-array';

@Component({
    components: {}
})
export default class MapRightMenu extends BaseVueComponent implements IMapModule {
    mapView: CartoMap;
    mapComp: Map;
    customLayers: CustomLayersModule = null;
    customSources: ObservableArray<SourceItem> = new ObservableArray([]);
    currentLegend: string = null;
    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
        this.customLayers = this.mapComp.mapModules.customLayers;
        this.customSources = this.customLayers.customSources;
        // this.log('onMapReady', this.customSources);
    }
    onMapDestroyed() {
        // this.log('onMapDestroyed');
        this.mapView = null;
        this.mapComp = null;
        this.customLayers = null;
        this.customSources = null;
    }

    mapModule<T extends keyof MapModules>(id: T) {
        if (this.mapComp) {
            return this.mapComp.mapModules[id];
        }
        return null;
    }
    constructor() {
        super();

        this.bShow3DBuildings = appSettings.getBoolean('show3DBuildings', false);
        this.bShowContourLines = appSettings.getBoolean('showContourLines', false);
        this.bShowGlobe = appSettings.getBoolean('showGlobe', false);
        this.bZoomBiais = appSettings.getNumber('zoomBiais', 0);
        if (isNaN(this.bZoomBiais)) {
            this.bZoomBiais = 0;
        }
    }
    // get customSources() {
    //     this.log('get customSources', !!this.mapComp);
    //     if (this.mapComp) {
    //         return this.customLayers.customSources;
    //     }
    //     return [];
    // }

    // get mapComp() {
    //     this.log('get mapComp1', !!this.mMapComp);
    //     if (!this.mMapComp) {
    //         this.mMapComp = this.$getMapComponent();
    //         this.log('get mapComp', this.mMapComp);
    //     }
    //     return this.mMapComp;
    // }

    @profile
    mounted() {
        super.mounted();
        this.$getMapComponent().mapModules.rightMenu = this;
        // this.log('mounted', !!this.mapComp);
    }
    onLayerOpacityChanged(item, event) {
        const opacity = event.value / 100;
        // this.log('onLayerOpacityChanged', item.name, opacity);
        item.layer.opacity = opacity;
        appSettings.setNumber(item.name + '_opacity', opacity);
        item.layer.visible = opacity !== 0;
        this.mapView.requestRedraw();
        // item.layer.refresh();
    }

    onSourceLongPress(item: SourceItem) {
        const actions = ['delete'];
        if (item.provider.cacheable !== false) {
            actions.push('clear_cache');
        }
        if (item.legend) {
            actions.push('legend');
        }
        action({
            title: `${item.name} Source`,
            message: 'Pick Action',
            actions: actions.map(s => localize(s))
        }).then(result => {
            switch (result) {
                case 'delete': {
                    this.customLayers.deleteSource(item.name);
                    break;
                }
                case 'clear_cache': {
                    ((item.layer as any).dataSource as PersistentCacheTileDataSource).clear();
                    item.layer.clearTileCaches(true);
                    break;
                }
                case 'legend':
                    // this.log('showing legend', item.legend);
                    this.currentLegend = item.legend;
                    // if (item.legend.endsWith('.html')) {

                    // } else {
                    //     const PhotoViewer = require('nativescript-photoviewer');
                    //     new PhotoViewer().showGallery([item.legend]);
                    // }

                    break;
            }
        });
    }

    bShowGlobe = false;
    get showGlobe() {
        return this.bShowGlobe;
    }
    set showGlobe(value: boolean) {
        this.bShowGlobe = value;
        appSettings.setBoolean('showGlobe', value);
        if (this.mapComp) {
            this.mapComp.showGlobe = value;
        }
    }
    toggleGlobe() {
        this.showGlobe = !this.bShowGlobe;
    }
    bShow3DBuildings = false;
    get show3DBuildings() {
        return this.bShow3DBuildings;
    }
    set show3DBuildings(value: boolean) {
        this.bShow3DBuildings = value;
        appSettings.setBoolean('show3DBuildings', value);
        if (this.mapComp) {
            this.mapComp.show3DBuildings = value;
        }
    }
    toggle3DBuildings() {
        this.show3DBuildings = !this.bShow3DBuildings;
    }
    bShowContourLines = false;
    get showContourLines() {
        return this.bShowContourLines;
    }
    set showContourLines(value: boolean) {
        this.bShowContourLines = value;
        appSettings.setBoolean('showContourLines', value);
        if (this.mapComp) {
            this.mapComp.showContourLines = value;
        }
    }
    toggleContourLines() {
        this.showContourLines = !this.bShowContourLines;
    }
    _contourLinesOpacity = 1;
    get contourLinesOpacity() {
        return this._contourLinesOpacity;
    }
    set contourLinesOpacity(value: number) {
        this._contourLinesOpacity = value;
        appSettings.setNumber('contourLinesOpacity', value);
        if (this.mapComp) {
            this.mapComp.contourLinesOpacity = value;
        }
    }

    bZoomBiais = 0;
    get zoomBiais() {
        return this.bZoomBiais + '';
    }
    set zoomBiais(value: string) {
        this.bZoomBiais = parseFloat(value);
        if (isNaN(this.bZoomBiais)) {
            this.bZoomBiais = 0;
        }
        appSettings.setNumber('zoomBiais', this.bZoomBiais);
        if (this.mapComp) {
            this.mapComp.zoomBiais = this.bZoomBiais;
        }
    }
    onZoomBiaisChanged(e) {
        this.zoomBiais = e.value;
    }
}
