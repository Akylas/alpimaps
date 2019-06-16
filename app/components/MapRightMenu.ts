import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { localize } from 'nativescript-localize';
import * as appSettings from 'tns-core-modules/application-settings/application-settings';
import { profile } from 'tns-core-modules/profiling';
import { action } from 'ui/dialogs';
import { Component } from 'vue-property-decorator';
import { SourceItem } from '~/mapModules/CustomLayersModule';
import BaseVueComponent from './BaseVueComponent';
import Map, { MapModules } from './Map';
import { CartoMap } from 'nativescript-carto/ui/ui';

@Component({
    components: {}
})
export default class MapRightMenu extends BaseVueComponent {
    mapModule<T extends keyof MapModules>(id: T) {
        return this.mapComp.mapModules[id];
    }
    constructor() {
        super();
    }
    get customSources() {
        return this.mapModule('customLayers').customSources;
    }
    mMapComp: Map;
    mCartoMap: CartoMap;
    get cartoMap() {
        if (!this.mCartoMap && this.mapComp) {
            this.mCartoMap = this.mapComp.cartoMap;
        }
        return this.mCartoMap;
    }

    get mapComp() {
        if (!this.mMapComp) {
            this.mMapComp = this.$getMapComponent();
        }
        return this.mMapComp;
    }
    @profile
    mounted() {
        super.mounted();
        this.log('mounted');
        this.bShow3DBuildings = appSettings.getBoolean('show3DBuildings', false);
        this.bShowContourLines = appSettings.getBoolean('showContourLines', false);
        this.bShowGlobe = appSettings.getBoolean('showGlobe', false);
    }
    onLayerOpacityChanged(item, event) {
        const opacity = event.value / 100;
        item.layer.opacity = opacity;
        appSettings.setNumber(item.name + '_opacity', opacity);
        item.layer.visible = opacity !== 0;
        this.cartoMap.requestRedraw();
        // item.layer.refresh();
        console.log('onLayerOpacityChanged', item.name, event.value, item.opacity);
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
            actions: ['delete', 'clear_cache'].map(s => localize(s))
        }).then(result => {
            switch (result) {
                case 'delete': {
                    this.mapModule('customLayers').deleteSource(item.name);
                    break;
                }
                case 'clear_cache': {
                    ((item.layer as any).dataSource as PersistentCacheTileDataSource).clear();
                    item.layer.clearTileCaches(true);
                    break;
                }
                case 'legend':
                    const PhotoViewer = require('nativescript-photoviewer');
                    new PhotoViewer().showGallery([item.legend]);
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
}
