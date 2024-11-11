import { l } from '@nativescript-community/l';
import Observable from '@nativescript-community/observable';
import { MapPos, arrayToNativeVector } from '@nativescript-community/ui-carto/core';
import { Layer } from '@nativescript-community/ui-carto/layers';
import type { RasterTileClickInfo } from '@nativescript-community/ui-carto/layers/raster';
import { VectorElementEventData, VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import { Projection } from '@nativescript-community/ui-carto/projections';
import { CartoMap, MapClickInfo, MapInteractionInfo, PanningMode } from '@nativescript-community/ui-carto/ui';
import { DirAssetPackage, ZippedAssetPackage } from '@nativescript-community/ui-carto/utils';
import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { Application, ApplicationSettings, File, Frame, Page, knownFolders, path } from '@nativescript/core';
import { executeOnMainThread } from '@nativescript/core/utils';
import { NativeViewElementNode } from 'svelte-native/dom';
import { get } from 'svelte/store';
import type DirectionsPanel from '~/components/directions/DirectionsPanel.svelte';
import { GeoHandler } from '~/handlers/GeoHandler';
import type CustomLayersModule from '~/mapModules/CustomLayersModule';
import type ItemsModule from '~/mapModules/ItemsModule';
import type UserLocationModule from '~/mapModules/UserLocationModule';
import type { IItem } from '~/models/Item';
import { getBGServiceInstance } from '~/services/BgService';
import { routesType } from '~/stores/mapStore';
import { packageService } from '~/services/PackageService';
import { createGlobalEventListener, globalObservable, navigate } from '@shared/utils/svelte/ui';
import { getCartoBitmap } from '@nativescript-community/ui-carto';
import { colorTheme, theme } from '~/helpers/theme';
// export interface IMapModule {
//     onMapReady(mapView: CartoMap<LatLonKeys>);
//     onMapDestroyed();
//     onServiceLoaded?(geoHandler: GeoHandler);
//     onServiceUnloaded?(geoHandler: GeoHandler);
//     onMapMove?(e: { data: { userAction: boolean } });
//     onMapInteraction?(e: { data: { interaction: MapInteractionInfo } });
//     onMapClicked?(e: { data: MapClickInfo });
//     onVectorTileClicked?(data: VectorTileEventData<LatLonKeys>);
//     onVectorElementClicked?(data: VectorElementEventData<LatLonKeys>);
//     onSelectedItem?(item: IItem, oldItem: IItem);
// }
export type LayerType = 'map' | 'routes' | 'customLayers' | 'hillshade' | 'selection' | 'items' | 'directions' | 'userLocation' | 'search' | 'transit' | 'admin';

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
    showMapMenu(event);
    showMapOptions(event);
    setMapDefaultOptions(options);
    createMapDecoder(mapStyle, mapStyleLayer): MBVectorTileDecoder;
    mapModule<T extends keyof MapModules>(id: T): MapModules[T];
    onOtherAppTextSelected(callback: ContextCallback, once?: boolean);
    onMapReady(callback: ContextCallback, once?: boolean);
    onMapMove(callback: ContextCallback<{ userAction: boolean }>, once?: boolean);
    onMapInteraction(callback: ContextCallback<{ interaction: MapInteractionInfo }>, once?: boolean);
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
        isFeatureInteresting?: boolean;
        peek?: boolean;
        setSelected?: boolean;
        minZoom?: number;
        zoom?: number;
        zoomDuration?: number;
        preventZoom?: boolean;
        forceZoomOut?: boolean;
    }) => void;
    zoomToItem: (args: { item: IItem; zoom?: number; minZoom?: number; forceZoomOut?: boolean }) => void;
    unselectItem: () => void;
    selectStyle: () => Promise<void>;
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

export function createTileDecoder(name: string, style: string = 'voyager') {
    return new MBVectorTileDecoder({
        style,
        pack:
            PRODUCTION || TEST_ZIP_STYLES
                ? new ZippedAssetPackage({
                      liveReload: !PRODUCTION,
                      zipPath: `~/assets/styles/${name}.zip`,
                      basePack,
                      getAssetNames: getAssetNamesWithMaterial
                  })
                : new DirAssetPackage({
                      loadUsingNS: !PRODUCTION,
                      dirPath: `~/assets/styles/${name}`
                      // loadAsset,
                      // getAssetNames: getAssetNamesWithMaterial
                  })
    });
}

export function onNetworkChanged(callback: (theme) => void) {}

const mapContext: MapContext = {
    mapModules: {},
    setMapDefaultOptions(options) {
        options.setLayersLabelsProcessedInReverseOrder(true);
        options.setSeamlessPanning(false);
        options.setRestrictedPanning(true);
        options.setPanningMode(PanningMode.PANNING_MODE_STICKY_FINAL);
        if (colorTheme === 'eink') {
            options.setBackgroundBitmap(getCartoBitmap('~/assets/images/eink-map-background.png'));
        }

        options.setZoomGestures(true);
        options.setDoubleClickMaxDuration(0.3);
        options.setLongClickDuration(0.5);
        options.setKineticRotation(false);
    },
    onOtherAppTextSelected: createGlobalEventListener('onOtherAppTextSelected'),
    onMapReady: createGlobalEventListener<never>('onMapReady'),
    onMapMove: createGlobalEventListener<{ userInteraction: boolean }>('onMapMove'),
    onMapInteraction: createGlobalEventListener<{ interaction: MapInteractionInfo }>('onMapInteraction'),
    onMapStable: createGlobalEventListener<never>('onMapStable'),
    onMapIdle: createGlobalEventListener<never>('onMapIdle'),
    onMapClicked: createGlobalEventListener<MapClickInfo<MapPos<LatLonKeys>>>('onMapClicked'),
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
        mapContext.setInnerStyle(mapStyleLayer.indexOf('eink') !== -1 ? 'eink' : 'voyager');
        oldDecoder?.dispose();
        mapContext.runOnModules('vectorTileDecoderChanged', oldDecoder, mapContext.mapDecoder);
        return mapContext.mapDecoder;
    },
    setInnerStyle(style: string) {
        const currentValue = ApplicationSettings.getString('innerStyle', 'voyager');
        DEV_LOG && console.log('setInnerStyle', currentValue, style);
        if (style !== currentValue) {
            ApplicationSettings.setString('innerStyle', style);
            const oldDecoder = mapContext.innerDecoder;
            const decoder = (mapContext.innerDecoder = createTileDecoder('inner', style));
            decoder.setStyleParameter('routes_type', get(routesType) + '');
            oldDecoder.notify({ eventName: 'change' });
            oldDecoder?.dispose();
        }
    },
    innerDecoder: createTileDecoder('inner', ApplicationSettings.getString('innerStyle', 'voyager'))
} as any;

export function setMapContext(ctx) {
    Object.assign(mapContext, ctx);
}

export function getMapContext() {
    return mapContext;
}

export async function handleMapAction(action: string, options?) {
    const parent = Frame.topmost() || Application.getRootView();
    DEV_LOG && console.log('handleMapAction', action, options);
    switch (action) {
        case 'astronomy':
            const module = mapContext.mapModule('userLocation');
            const location = module.lastUserLocation || options?.location;
            if (!location) {
                showSnack({ message: `${l('no_location_yet')}`, view: Application.getRootView() });
                return;
            }
            const AstronomyView = (await import('~/components/astronomy/AstronomyView.svelte')).default;
            await showBottomSheet({
                parent,
                view: AstronomyView,
                peekHeight: options.name ? 350 : 300,
                props: {
                    ...options,
                    location
                }
            });
            break;
        case 'compass':
            try {
                const module = mapContext.mapModule('userLocation');
                const selected = mapContext.getSelectedItem();
                const location = module.lastUserLocation || options;
                const CompassView = (await import('~/components/compass/CompassView.svelte')).default;
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
                const GpsStatusView = (await import('~/components/gps/GpsStatusView.svelte')).default;
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
                const AltimeterView = (await import('~/components/compass/AltimeterView.svelte')).default;
                await showBottomSheet({ parent, view: AltimeterView });
            } catch (err) {
                console.error('showAltimeter', err, err['stack']);
            }
            break;
        case 'settings':
            const Settings = (await import('~/components/settings/Settings.svelte')).default;
            navigate({ page: Settings });

            break;
    }
}

export default abstract class MapModule extends Observable /*  implements IMapModule */ {
    mapView: CartoMap<LatLonKeys>;
    onMapReady(mapView: CartoMap<LatLonKeys>) {
        this.mapView = mapView;
    }
    onMapDestroyed() {
        this.mapView = null;
    }
    onServiceLoaded?(geoHandler: GeoHandler);
    onServiceUnloaded?(geoHandler: GeoHandler);
    onMapMove?(e: { data: { userAction: boolean } });
    onMapInteraction?(e: { data: { interaction: MapInteractionInfo } });
    onMapClicked?(e: { data: MapClickInfo });
    onVectorTileClicked?(data: VectorTileEventData<LatLonKeys>);
    onVectorElementClicked?(data: VectorElementEventData<LatLonKeys>);
    onVectorTileElementClicked?(data: VectorTileEventData<LatLonKeys>);
    onSelectedItem?(item: IItem, oldItem: IItem);
}
