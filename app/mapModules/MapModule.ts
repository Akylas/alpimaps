import { l } from '@nativescript-community/l';
import Observable from '@nativescript-community/observable';
import { Layer } from '@nativescript-community/ui-carto/layers';
import { RasterTileClickInfo } from '@nativescript-community/ui-carto/layers/raster';
import { VectorElementEventData, VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import { Projection } from '@nativescript-community/ui-carto/projections';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
import { Drawer } from '@nativescript-community/ui-drawer';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { Frame, Page } from '@nativescript/core';
import { getRootView } from '@nativescript/core/application';
import { executeOnMainThread } from '@nativescript/core/utils';
import { navigate } from 'svelte-native';
import { NativeViewElementNode } from 'svelte-native/dom';
import { GeoHandler } from '~/handlers/GeoHandler';
import { IItem } from '~/models/Item';
import { showBottomSheet } from '~/utils/bottomsheet';
import { createGlobalEventListener, globalObservable } from '~/variables';
import CustomLayersModule from './CustomLayersModule';
import DirectionsPanel from './DirectionsPanel.svelte';
import ItemsModule from './ItemsModule';
import UserLocationModule from './UserLocationModule';

export interface IMapModule {
    onMapReady(mapView: CartoMap<LatLonKeys>);
    onMapDestroyed();
    onServiceLoaded?(geoHandler: GeoHandler);
    onServiceUnloaded?(geoHandler: GeoHandler);
    onMapMove?(e);
    onMapClicked?(e);
    onVectorTileClicked?(data: VectorTileEventData<LatLonKeys>);
    onVectorElementClicked?(data: VectorElementEventData<LatLonKeys>);
    onSelectedItem?(item: IItem, oldItem: IItem);
}
export type LayerType = 'map' | 'routes' | 'customLayers' | 'hillshade' | 'selection' | 'items' | 'directions' | 'userLocation' | 'search' | 'transit';

export interface MapContext {
    drawer: Drawer;
    mapModules: MapModules;
    innerDecoder: MBVectorTileDecoder;
    toggleMenu(side: string);
    showOptions();
    mapModule<T extends keyof MapModules>(id: T): MapModules[T];
    onMapReady(callback: (map: CartoMap<LatLonKeys>) => void);
    onMapMove(callback: (map: CartoMap<LatLonKeys>) => void);
    onMapStable(callback: (map: CartoMap<LatLonKeys>) => void);
    onMapIdle(callback: (map: CartoMap<LatLonKeys>) => void);
    onMapClicked(callback: (map: CartoMap<LatLonKeys>) => void);
    onVectorElementClicked(callback: (data: VectorElementEventData<LatLonKeys>) => void);
    onVectorTileClicked(callback: (data: VectorTileEventData<LatLonKeys>) => void);
    onVectorTileElementClicked(callback: (data: VectorTileEventData<LatLonKeys>) => void);
    getMainPage: () => NativeViewElementNode<Page>;
    getMap: () => CartoMap<LatLonKeys>;
    getProjection: () => Projection;
    setBottomSheetStepIndex: (value: number) => void;
    selectItem: (args: {
        item: IItem;
        showButtons?: boolean;
        isFeatureInteresting: boolean;
        peek?: boolean;
        setSelected?: boolean;
        minZoom?: number;
        zoom?: number;
        zoomDuration?: number;
        preventZoom?: boolean;
    }) => void;
    zoomToItem: (args: { item: IItem; zoom?: number; minZoom?: number; forceZoomOut?: boolean }) => void;
    unselectItem: () => void;
    getCurrentLanguage: () => string;
    getSelectedItem: () => IItem;
    getLayers: (layerId?: LayerType) => { layer: VectorTileLayer; id: string }[];
    addLayer: (layer: Layer<any, any>, layerId: LayerType) => number;
    insertLayer: (layer: Layer<any, any>, layerId: LayerType, index: number) => void;
    removeLayer: (layer: Layer<any, any>, layerId: LayerType) => void;
    moveLayer: (layer: Layer<any, any>, newIndex: number) => void;
    getLayerIndex: (layer: Layer<any, any>) => number;
    replaceLayer: (oldLayer: Layer<any, any>, layer: Layer<any, any>) => number;
    getLayerTypeFirstIndex: (layerId: LayerType) => number;
    vectorElementClicked: (data: VectorElementEventData<LatLonKeys>) => boolean;
    vectorTileClicked: (data: VectorTileEventData<LatLonKeys>) => boolean;
    vectorTileElementClicked: (data: VectorTileEventData<LatLonKeys>) => boolean;
    rasterTileClicked: (data: RasterTileClickInfo<LatLonKeys>) => boolean;
    getVectorTileDecoder(): MBVectorTileDecoder;
    getCurrentLayer(): VectorTileLayer;
    runOnModulesOnMainThread(functionName: string, ...args);
    runOnModules(functionName: string, ...args);
}

export interface MapModules {
    // mapScrollingWidgets: MapScrollingWidgets;
    // search: Search;
    customLayers: CustomLayersModule;
    directionsPanel: DirectionsPanel;
    userLocation: UserLocationModule;
    items: ItemsModule;
    // rightMenu: MapRightMenu;
    // bottomSheet: BottomSheetInner;
}

export function onNetworkChanged(callback: (theme) => void) {}
export let drawer: Drawer;

const mapContext: MapContext = {
    mapModules: {},
    onMapReady: createGlobalEventListener('onMapReady'),
    onMapMove: createGlobalEventListener('onMapMove'),
    onMapStable: createGlobalEventListener('onMapStable'),
    onMapIdle: createGlobalEventListener('onMapIdle'),
    onMapClicked: createGlobalEventListener('onMapClicked'),
    onVectorElementClicked: createGlobalEventListener('onVectorElementClicked'),
    onVectorTileElementClicked: createGlobalEventListener('onVectorTileElementClicked'),
    onRasterTileClicked: createGlobalEventListener('onRasterTileClicked'),
    mapModule<T extends keyof MapModules>(id: T) {
        return mapContext.mapModules && mapContext.mapModules[id];
    },
    runOnModulesOnMainThread(functionName: string, ...args) {
        executeOnMainThread(() => {
            this.runOnModules(functionName, ...args);
        });
    },
    runOnModules(functionName: string, ...args) {
        let result = Object.values(mapContext.mapModules).some((m) => {
            if (m && m[functionName]) {
                const result = (m[functionName] as Function).call(m, ...args);
                if (result) {
                    return result;
                }
                return false;
            }
        });
        if (!result) {
            const event: any = { eventName: functionName, data: args };
            globalObservable.notify(event);
            result = event.result;
        }
        return result;
    },
    innerDecoder: new MBVectorTileDecoder({
        style: 'voyager',
        liveReload: TNS_ENV !== 'production',
        [PRODUCTION ? 'zipPath' : 'dirPath']: `~/assets/internal_styles/inner${PRODUCTION ? '.zip' : ''}`
    })
} as any;

export function setMapContext(ctx) {
    Object.assign(mapContext, ctx);
}

export function getMapContext() {
    return mapContext;
}

export async function handleMapAction(action: string, options?) {
    const parent = Frame.topmost() || getRootView();
    switch (action) {
        case 'astronomy':
            const module = mapContext.mapModule('userLocation');
            const location = module.lastUserLocation || options;
            if (!location) {
                showSnack({ message: `${l('no_location_yet')}` });
                return;
            }
            const AstronomyView = (await import('~/components/AstronomyView.svelte')).default;
            await showBottomSheet({
                parent,
                view: AstronomyView,
                props: {
                    location
                }
            });
            break;
        case 'compass':
            try {
                const CompassView = (await import('~/components/CompassView.svelte')).default;
                await showBottomSheet({ parent, view: CompassView, transparent: true });
            } catch (err) {
                console.error('showCompass', err, err['stack']);
            }
            break;
        case 'altimeter':
            try {
                const AltimeterView = (await import('~/components/AltimeterView.svelte')).default;
                await showBottomSheet({ parent, view: AltimeterView });
            } catch (err) {
                console.error('showAltimeter', err, err['stack']);
            }
            break;
        case 'settings':
            const Settings = (await import('~/components/Settings.svelte')).default;
            navigate({ page: Settings });

            break;
    }
}

export default abstract class MapModule extends Observable implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    onMapReady(mapView: CartoMap<LatLonKeys>) {
        this.mapView = mapView;
    }
    onMapDestroyed() {
        this.mapView = null;
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
    onVectorTileElementClicked?(data: VectorTileEventData<LatLonKeys>);
    onSelectedItem?(item: IItem, oldItem: IItem);
}
