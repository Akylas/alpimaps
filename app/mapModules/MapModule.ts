import { l } from '@nativescript-community/l';
import Observable from '@nativescript-community/observable';
import { arrayToNativeVector } from '@nativescript-community/ui-carto/core';
import { Layer } from '@nativescript-community/ui-carto/layers';
import type { RasterTileClickInfo } from '@nativescript-community/ui-carto/layers/raster';
import { VectorElementEventData, VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import { Projection } from '@nativescript-community/ui-carto/projections';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { DirAssetPackage, ZippedAssetPackage } from '@nativescript-community/ui-carto/utils';
import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { Application, File, Folder, Frame, Page, knownFolders, path } from '@nativescript/core';
import { executeOnMainThread } from '@nativescript/core/utils';
import { navigate } from 'svelte-native';
import { NativeViewElementNode } from 'svelte-native/dom';
import type DirectionsPanel from '~/components/DirectionsPanel.svelte';
import { GeoHandler } from '~/handlers/GeoHandler';
import type CustomLayersModule from '~/mapModules/CustomLayersModule';
import type ItemsModule from '~/mapModules/ItemsModule';
import type UserLocationModule from '~/mapModules/UserLocationModule';
import type { IItem } from '~/models/Item';
import { getBGServiceInstance } from '~/services/BgService';
import { showBottomSheet } from '~/utils/svelte/bottomsheet';
import { listFolderFiles } from '~/utils/utils.common';
import { createGlobalEventListener, globalObservable } from '~/variables';
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

export type ContextCallback<T = CartoMap<LatLonKeys>> = (data: T) => void;

const appPath = knownFolders.currentApp().path;
const styleAssets = ['fonts/osm.ttf'];
// console.log('styleAssets', styleAssets);

function loadAsset(name) {
    // console.log('loadAsset', name);
    const filePath = path.join(appPath, name);
    if (File.exists(filePath)) {
        return new com.carto.core.BinaryData(File.fromPath(filePath).readSync());
    }
    return null;
}

function getAssetNames() {
    return arrayToNativeVector(styleAssets);
}
function getAssetNamesWithMaterial() {
    // console.log('getAssetNamesWithMaterial');
    return arrayToNativeVector(styleAssets.concat('fonts/materialdesignicons-webfont.ttf'));
}
const basePack = new ZippedAssetPackage({
    liveReload: !PRODUCTION,
    zipPath: '~/assets/styles/base.zip',
    loadAsset,
    getAssetNames
});

export interface MapContext {
    mapModules: MapModules;
    innerDecoder: MBVectorTileDecoder;
    mapDecoder: MBVectorTileDecoder;
    showOptions();
    createMapDecoder(mapStyle, mapStyleLayer): MBVectorTileDecoder;
    mapModule<T extends keyof MapModules>(id: T): MapModules[T];
    onMapReady(callback: ContextCallback, once?: boolean);
    onMapMove(callback: ContextCallback, once?: boolean);
    onMapStable(callback: ContextCallback, once?: boolean);
    getMapViewPort(): { left: number; width: number; top: number; height: number };
    onMapIdle(callback: ContextCallback, once?: boolean);
    onMapClicked(callback: ContextCallback, once?: boolean);
    onVectorElementClicked(callback: ContextCallback<VectorElementEventData<LatLonKeys>>, once?: boolean);
    onVectorTileClicked(callback: ContextCallback<VectorTileEventData<LatLonKeys>>, once?: boolean);
    onVectorTileElementClicked(callback: ContextCallback<VectorTileEventData<LatLonKeys>>, once?: boolean);
    getMainPage: () => NativeViewElementNode<Page>;
    getMap: () => CartoMap<LatLonKeys>;
    getProjection: () => Projection;
    setBottomSheetStepIndex: (value: number) => void;
    startEditingItem: (item: IItem) => void;
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
    unFocusSearch: () => void;
    getCurrentLanguage: () => string;
    getSelectedItem: () => IItem;
    setSelectedItem: (item: IItem) => void;
    getEditingItem: () => IItem;
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
    // getCurrentLayer(): VectorTileLayer;
    runOnModulesOnMainThread(functionName: string, ...args);
    runOnModules(functionName: string, ...args);
}

export interface MapModules {
    customLayers: CustomLayersModule;
    directionsPanel: DirectionsPanel;
    userLocation: UserLocationModule;
    items: ItemsModule;
}

export function onNetworkChanged(callback: (theme) => void) {}

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
    createMapDecoder(mapStyle, mapStyleLayer) {
        const oldDecoder = mapContext.mapDecoder;
        console.log('createMapDecoder', mapStyle, mapStyleLayer);
        mapContext.mapDecoder = new MBVectorTileDecoder({
            style: mapStyleLayer,
            liveReload: !PRODUCTION,
            pack: mapStyle.endsWith('.zip')
                ? new ZippedAssetPackage({
                      liveReload: !PRODUCTION,
                      zipPath: `~/assets/styles/${mapStyle}`,
                      basePack
                  })
                : new DirAssetPackage({
                      loadUsingNS: !PRODUCTION,
                      dirPath: `~/assets/styles/${mapStyle}`
                      // loadAsset,
                      // getAssetNames: getAssetNamesWithMaterial
                  })
        });
        mapContext.runOnModules('vectorTileDecoderChanged', oldDecoder, mapContext.mapDecoder);
    },
    innerDecoder: new MBVectorTileDecoder({
        style: 'voyager',
        pack:
            PRODUCTION || TEST_ZIP_STYLES
                ? new ZippedAssetPackage({
                      liveReload: !PRODUCTION,
                      zipPath: '~/assets/styles/inner.zip',
                      loadAsset,
                      basePack,
                      getAssetNames: getAssetNamesWithMaterial
                  })
                : new DirAssetPackage({
                      loadUsingNS: !PRODUCTION,
                      dirPath: '~/assets/styles/inner'
                      // loadAsset,
                      // getAssetNames: getAssetNamesWithMaterial
                  })
    })
} as any;

export function setMapContext(ctx) {
    Object.assign(mapContext, ctx);
}

export function getMapContext() {
    return mapContext;
}

export async function handleMapAction(action: string, options?) {
    const parent = Frame.topmost() || Application.getRootView();
    switch (action) {
        case 'astronomy':
            const module = mapContext.mapModule('userLocation');
            const location = module.lastUserLocation || options;
            if (!location) {
                showSnack({ message: `${l('no_location_yet')}` });
                return;
            }
            const AstronomyView = (await import('~/components/AstronomyView.svelte')).default as any;
            await showBottomSheet({
                parent,
                view: AstronomyView,
                peekHeight: 300,
                props: {
                    location
                }
            });
            break;
        case 'compass':
            try {
                const module = mapContext.mapModule('userLocation');
                const selected = mapContext.getSelectedItem();
                const location = module.lastUserLocation || options;
                const CompassView = (await import('~/components/CompassView.svelte')).default as any;
                await showBottomSheet({
                    parent,
                    view: CompassView,
                    transparent: true,
                    props: {
                        location,
                        updateWithUserLocation: true,
                        aimingItems: selected ? [selected] : []
                    }
                });
            } catch (err) {
                console.error('showCompass', err, err['stack']);
            }
            break;
        case 'gps_status':
            try {
                await getBGServiceInstance().geoHandler.enableLocation();
                const GpsStatusView = (await import('~/components/GpsStatusView.svelte')).default as any;
                await showBottomSheet({
                    parent,
                    view: GpsStatusView
                });
            } catch (err) {
                if (err) {
                    console.error('showGpsStatus', err, err.stack);
                }
            }
            break;
        case 'altimeter':
            try {
                const AltimeterView = (await import('~/components/AltimeterView.svelte')).default as any;
                await showBottomSheet({ parent, view: AltimeterView });
            } catch (err) {
                console.error('showAltimeter', err, err['stack']);
            }
            break;
        case 'settings':
            const Settings = (await import('~/components/Settings.svelte')).default as any;
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
    onServiceLoaded?(geoHandler: GeoHandler);
    onServiceUnloaded?(geoHandler: GeoHandler);
    onMapMove?(e);
    onMapClicked?(e);
    onVectorTileClicked?(data: VectorTileEventData<LatLonKeys>);
    onVectorElementClicked?(data: VectorElementEventData<LatLonKeys>);
    onVectorTileElementClicked?(data: VectorTileEventData<LatLonKeys>);
    onSelectedItem?(item: IItem, oldItem: IItem);
}
