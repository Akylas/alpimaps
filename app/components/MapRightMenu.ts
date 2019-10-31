import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { localize } from 'nativescript-localize';
import * as appSettings from '@nativescript/core/application-settings/application-settings';
import { profile } from '@nativescript/core/profiling';
import { action } from 'nativescript-material-dialogs';
import { Component } from 'vue-property-decorator';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import BaseVueComponent from './BaseVueComponent';
import Map, { MapModules } from './Map';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { IMapModule } from '~/mapModules/MapModule';
import { ObservableArray } from '@nativescript/core/data/observable-array/observable-array';
import { TextField } from 'nativescript-material-textfield';

function createGetter(key, type: string, options?: { defaultValue?: any }) {
    return function() {
        // console.log('calling getter', key, this.hasOwnProperty('m' + key));
        if (!this.hasOwnProperty('m' + key) || this['m' + key] === undefined) {
            if (type === 'boolean') {
                this['m' + key] = appSettings.getBoolean(key, options.defaultValue || false);
            } else if (type === 'number') {
                this['m' + key] = appSettings.getNumber(key, options.defaultValue || 0);
            } else {
                this['m' + key] = appSettings.getString(key, options.defaultValue || '');
            }
        }
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
function createSetter(key, type: string, options?: { defaultValue?: any }) {
    return function(newVal) {
        if (type === 'number') {
            if (typeof newVal === 'string') {
                newVal = parseFloat(newVal);
            }
            if (isNaN(newVal)) {
                newVal = 0;
            }
        }
        this['m' + key] = newVal;
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
        get: createGetter(key, type, options),
        set: createSetter(key, type, options),
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
export default class MapRightMenu extends BaseVueComponent implements IMapModule {
    mapView: CartoMap;
    mapComp: Map;
    customLayers: CustomLayersModule = null;
    customSources: ObservableArray<SourceItem> = null;
    currentLegend: string = null;

    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
        this.customLayers = this.mapComp.mapModules.customLayers;
        this.customSources = this.customLayers.customSources;
        this.log('onMapReady', this.customSources);
    }
    onMapDestroyed() {
        this.log('onMapDestroyed');
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
        this.mapModule('customLayers').addSource();
    }
    clearCache() {
        this.mapComp.clearCache();
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

    mounted() {
        super.mounted();
        this.$getMapComponent().mapModules.rightMenu = this;
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
    @booleanProperty showGlobe: boolean;
    @booleanProperty show3DBuildings: boolean;
    @booleanProperty showContourLines: boolean;
    @numberProperty contourLinesOpacity: number;
    @booleanProperty preloading: number;
    @stringProperty({ defaultValue: '0' }) zoomBiais: string;

    toggleGlobe() {
        this.showGlobe = !this.showGlobe;
    }
    toggle3DBuildings() {
        this.show3DBuildings = !this.show3DBuildings;
    }

    toggleContourLines() {
        this.showContourLines = !this.showContourLines;
    }

    onZoomBiaisChanged(e) {
        const textField = e.object as TextField;
        this.zoomBiais = textField.text;
    }
}
