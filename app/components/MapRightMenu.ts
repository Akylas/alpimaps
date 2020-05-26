import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { $t } from '~/helpers/locale';
import * as appSettings from '@nativescript/core/application-settings/application-settings';
import { profile } from '@nativescript/core/profiling';
import { action } from 'nativescript-material-dialogs';
import { Component } from 'vue-property-decorator';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import BottomSheetBase from './BottomSheet/BottomSheetBase';
import BaseVueComponent from './BaseVueComponent';
import Map, { MapModules } from './Map';
import { CartoMap } from 'nativescript-carto/ui';
import { IMapModule } from '~/mapModules/MapModule';
import { ObservableArray } from '@nativescript/core/data/observable-array/observable-array';
import { TextField } from 'nativescript-material-textfield';
import LayerOptionsBottomSheet from './LayerOptionsBottomSheet';

function createGetter(target: Object, key, type: string, options?: { defaultValue?: any }) {
    // console.log('calling getter', key, target.hasOwnProperty('m' + key), target['m' + key]);
        if (!target.hasOwnProperty('m' + key) || target['m' + key] === undefined) {
            if (type === 'boolean') {
                target['m' + key] = appSettings.getBoolean(key, options.defaultValue || false);
            } else if (type === 'number') {
                target['m' + key] = appSettings.getNumber(key, options.defaultValue || 0);
            } else {
                target['m' + key] = appSettings.getString(key, options.defaultValue || '');
            }
        }
    return function() {
        
        let result = this['m' + key];
        if (type === 'number' && typeof result !== 'number') {
            result = parseFloat(result);
        } else if (type === 'string' && typeof result !== 'string') {
            result = result + '';
        }
        // console.log('calling getter2', key, result, this['m' + key]);
        return result;
    };
}
function createSetter(target: Object, key, type: string, options?: { defaultValue?: any }) {
    return function(newVal) {
        // console.log('calling setter', key, this.hasOwnProperty('m' + key), this['m' + key], newVal, type);
        if (type === 'number') {
            if (typeof newVal === 'string') {
                newVal = parseFloat(newVal);
            }
            if (isNaN(newVal)) {
                newVal = 0;
            }
        }
        this['m' + key] = newVal;
        // console.log('calling setter done', key, this.hasOwnProperty('m' + key), this['m' + key], newVal, type);
        if (type === 'boolean') {
            appSettings.setBoolean(key, newVal);
        } else if (type === 'number') {
            appSettings.setNumber(key, newVal);
        } else {
            appSettings.setString(key, newVal);
        }
        if (this.mapComp) {
            this.mapComp[key] = newVal;
        }
    };
}

function propertyGenerator(target: Object, key: string, type: string, options?: { defaultValue?: any }) {
    // console.log('mapPropertyGenerator', key, Object.keys(options));
    Object.defineProperty(target, key, {
        get: createGetter(target, key, type, options),
        set: createSetter(target, key, type, options),
        enumerable: true,
        configurable: true
    });
}
export function numberProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function numberProperty(options: { defaultValue?: any }): (target: any, k?, desc?: PropertyDescriptor) => any;
export function numberProperty(...args) {
    const options = args[0];
    if (args[1] === undefined) {
        return function(target: any, key?: string, descriptor?: PropertyDescriptor) {
            return propertyGenerator(target, key, 'number', options);
        };
    } else {
        return propertyGenerator(args[0], args[1], 'number', {});
    }
}
export function stringProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function stringProperty(options: { defaultValue?: any }): (target: any, k?, desc?: PropertyDescriptor) => any;
export function stringProperty(...args) {
    const options = args[0];
    if (args[1] === undefined) {
        return function(target: any, key?: string, descriptor?: PropertyDescriptor) {
            return propertyGenerator(target, key, 'string', options);
        };
    } else {
        return propertyGenerator(args[0], args[1], 'string', {});
    }
}
export function booleanProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function booleanProperty(options: { defaultValue?: any }): (target: any, k?, desc?: PropertyDescriptor) => any;
export function booleanProperty(...args) {
    const options = args[0];
    if (args[1] === undefined) {
        return function(target: any, key?: string, descriptor?: PropertyDescriptor) {
            return propertyGenerator(target, key, 'boolean', options);
        };
    } else {
        return propertyGenerator(args[0], args[1], 'boolean', {});
    }
}

@Component({
    components: {}
})
export default class MapRightMenu extends BottomSheetBase implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    mapComp: Map;
    customLayers: CustomLayersModule = null;
    customSources: ObservableArray<SourceItem> = [] as any;
    currentLegend: string = null;

    @booleanProperty showGlobe: boolean;
    @booleanProperty show3DBuildings: boolean;
    @booleanProperty showContourLines: boolean;
    @numberProperty contourLinesOpacity: number;
    @booleanProperty preloading: boolean;
    @stringProperty({ defaultValue: '0' }) zoomBiais: string;

    onMapReady(mapComp: Map, mapView: CartoMap<LatLonKeys>) {
        this.mapView = mapView;
        this.mapComp = mapComp;
        this.customLayers = this.mapModule('customLayers');
        this.customSources = this.customLayers.customSources;
    }
    onMapDestroyed() {
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

    addSource() {
        this.customLayers.addSource();
    }
    clearCache() {
        this.mapComp.clearCache();
    }
    selectLocalMbtilesFolder() {
        this.customLayers.selectLocalMbtilesFolder();
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

    get packageServiceEnabled() {
        return this.mapComp && this.mapComp.packageServiceEnabled;
    }

    mounted() {
        super.mounted();
        // this.$getMapComponent().mapModules.rightMenu = this;
        // this.log('mounted', !!this.mapComp);
    }
    onLayerOpacityChanged(item, event) {
        const opacity = event.value / 100;
        // this.log('onLayerOpacityChanged', item.name, event.value, opacity);
        item.layer.opacity = opacity;
        appSettings.setNumber(item.name + '_opacity', opacity);
        item.layer.visible = opacity !== 0;
        this.mapView.requestRedraw();
        // item.layer.refresh();
    }

    showSourceOptions(item: SourceItem) {
        this.$showBottomSheet(LayerOptionsBottomSheet, {
            props:{
                item
            }
        });
        this.holder.close();
        // const actions = [$t('delete')];
        // if (item.provider.cacheable !== false) {
        //     actions.push($t('clear_cache'));
        // }
        // if (item.legend) {
        //     actions.push($t('legend'));
        // }
        // action({
        //     title: `${item.name} Source`,
        //     message: 'Pick Action',
        //     actions: actions
        // }).then(result => {
        //     switch (result) {
        //         case 'delete': {
        //             this.customLayers.deleteSource(item.name);
        //             break;
        //         }
        //         case 'clear_cache': {
        //             ((item.layer as any).dataSource as PersistentCacheTileDataSource).clear();
        //             item.layer.clearTileCaches(true);
        //             break;
        //         }
        //         case 'legend':
        //             // this.log('showing legend', item.legend);
        //             this.currentLegend = item.legend;
        //             // if (item.legend.endsWith('.html')) {

        //             // } else {
        //             //     const PhotoViewer = require('nativescript-photoviewer');
        //             //     new PhotoViewer().showGallery([item.legend]);
        //             // }

        //             break;
        //     }
        // });
    }

    toggleGlobe() {
        console.log('toggleGlobe', this.showGlobe, !this.showGlobe);
        this.showGlobe = !this.showGlobe;
        console.log('toggleGlobe done', this.showGlobe);
    }
    toggle3DBuildings() {
        this.show3DBuildings = !this.show3DBuildings;
    }

    togglePreloading() {
        console.log('togglePreloading', this.preloading);
        this.preloading = !this.preloading;
        console.log('togglePreloadingd done', this.preloading);
    }
    toggleContourLines() {
        this.showContourLines = !this.showContourLines;
    }

    onZoomBiaisChanged(e) {
        const textField = e.object as TextField;
        this.zoomBiais = textField.text;
    }
}
