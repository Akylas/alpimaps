import { l } from '@nativescript-community/l';
import Observable from '@nativescript-community/observable';
import * as api from '@nativescript-community/ui-massifmaps/api';
import type { MassifEventData, MassifLayer, MassifMap, MassifObject, SpecArg } from '@nativescript-community/ui-massifmaps/api';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { Application, ApplicationSettings, File, Folder, Frame, Page, knownFolders, path } from '@nativescript/core';
import { executeOnMainThread } from '@nativescript/core/utils';
import { createGlobalEventListener, globalObservable, navigate } from '@shared/utils/svelte/ui';
import type { Point as GeoJSONPoint } from 'geojson';
import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
import { get } from 'svelte/store';
import type DirectionsPanel from '~/components/directions/DirectionsPanel.svelte';
import type MapScrollingWidgets from '~/components/map/MapScrollingWidgets.svelte';
import type MapResultPager from '~/components/search/MapResultPager.svelte';
import { GeoHandler } from '~/handlers/GeoHandler';
import { colorTheme, isEInk } from '~/helpers/theme';
import type CustomLayersModule from '~/mapModules/CustomLayersModule';
import type ItemsModule from '~/mapModules/ItemsModule';
import type UserLocationModule from '~/mapModules/UserLocationModule';
import type { MapModuleHook, MapModuleHooks, MapModules } from '~/mapModules/registry';
import { getMapModule, getMapModules, registerMapModule, runOnModules, runOnModulesOnMainThread } from '~/mapModules/registry';
import type { IItem } from '~/models/Item';
import { getBGServiceInstance } from '~/services/BgService';
//import { routesType } from '~/stores/mapStore';
import { showError } from '@shared/utils/showError';
import { innerNutiProps } from '~/stores/mapStore';
import { showSnack, showToast } from '~/utils/ui';
import type { AddedLayer, LayerType } from '~/mapModules/layerStack';
import { type MapPos, type Position, fromPosition } from '~/utils/geo';
import type { Geometry as GeoJSONGeometry } from 'geojson';

/** What the user is doing to the map right now, as `map.interaction` reports it. */
export interface MapInteraction {
    panAction: boolean;
    zoomAction: boolean;
    rotateAction: boolean;
    tiltAction: boolean;
    animationStarted: boolean;
}

export type { AddedLayer, LayerType };

export type ContextCallback<T = MassifMap> = (data: T) => void;

/** A vector tile decoder, which is the object every style knob is written through. */
export type MapDecoder = MassifObject<'massif::MBVectorTileDecoder'>;

const appPath = knownFolders.currentApp().path;

/**
 * A URL the SDK's own loader reads: the real file system when we can, the bundle otherwise.
 *
 * In a debug build the styles sit on disk and are live-reloaded; in a release build they are inside
 * the APK, where no file path reaches them. `assets://` is the SDK's scheme for that.
 */
function assetUrl(relativePath: string) {
    const filePath = path.join(appPath, relativePath);
    return File.exists(filePath) ? `file://${filePath}` : `assets://app/${relativePath}`;
}

/**
 * The shared base style assets - the fonts every style needs.
 *
 * A spec, not an object: the app used to subclass ZippedAssetPackage to supply `loadAsset` and
 * `getAssetNames`, and neither was ever a real option on it (they typechecked as errors), so the
 * subclass was doing nothing the plain archive does not.
 */
const BASE_ASSETS: SpecArg<'assets', 'zip'> = { type: 'zip', data: { type: 'url', url: assetUrl('assets/styles/base.zip') } };

/** A click, whatever it landed on. The facade reports the enum by its constant name. */
export const ClickType = {
    SINGLE: 'CLICK_TYPE_SINGLE',
    LONG: 'CLICK_TYPE_LONG',
    DOUBLE: 'CLICK_TYPE_DOUBLE',
    DUAL: 'CLICK_TYPE_DUAL'
} as const;
export type ClickType = (typeof ClickType)[keyof typeof ClickType];

/** Why the camera moved, as `map.moved` and `map.stable` report it. */
export const MapMoveReason = {
    GESTURE: 'MAP_MOVE_REASON_GESTURE',
    ANIMATION: 'MAP_MOVE_REASON_ANIMATION',
    API: 'MAP_MOVE_REASON_API'
} as const;
export type MapMoveReason = (typeof MapMoveReason)[keyof typeof MapMoveReason];

/**
 * A click on a vector tile feature, flattened out of the facade payload.
 *
 * Read once here rather than in each of the eight modules the click is offered to: the payload only
 * lives for the length of the handler, and every field is a crossing.
 */
export interface FeatureClickData {
    clickType: ClickType;
    position: MapPos;
    featurePosition: MapPos;
    featureData: { [k: string]: any };
    featureGeometry?: GeoJSONGeometry;
    featureId: number;
    featureLayerName: string;
    layer?: MassifLayer;
}

/** A click on an element the app added - a marker, a route line. */
export interface ElementClickData {
    clickType: ClickType;
    position: MapPos;
    elementPosition: MapPos;
    /** what the element was registered with, so a module can tell its own from another's */
    metaData: { [k: string]: any };
    layer?: MassifLayer;
}

export interface MapClickData {
    clickType: ClickType;
    position: MapPos;
}

/**
 * Flattens a facade click payload into the shape the modules read.
 *
 * Read ONCE, here: the payload only lives for the length of the handler and every field is a
 * crossing, so eight modules each destructuring it would each pay for it. `feature.properties` and
 * `feature.geometryGeoJSON` are one read each - the SDK serialises them - which is what replaced the
 * old native feature walk.
 */
export function featureClickData(e: MassifEventData<'massif::VectorTileLayer', 'vectortile.clicked'>): FeatureClickData {
    return {
        clickType: e.clickType as ClickType,
        position: fromPosition(e.getPos('clickPos') as Position),
        featurePosition: fromPosition(e.getPos('featurePos') as Position),
        featureData: (e.get('feature.properties') ?? {}) as { [k: string]: any },
        featureGeometry: e.get('feature.geometryGeoJSON') as never,
        featureId: e.featureId as number,
        featureLayerName: e.featureLayerName as string,
        layer: undefined
    };
}

/** The same for a click on an element the app added. */
export function elementClickData(e: MassifEventData<'massif::VectorLayer', 'vectorelement.clicked'>): ElementClickData {
    return {
        clickType: e.clickType as ClickType,
        position: fromPosition(e.getPos('clickPos') as Position),
        elementPosition: fromPosition(e.getPos('elementClickPos') as Position),
        metaData: (e.get('vectorElement.metaData') ?? {}) as { [k: string]: any },
        layer: undefined
    };
}

/**
 * A spec that draws the same tiles as `layer`, for a SECOND map view.
 *
 * The detail pages (a transit line, the peak finder) show the main map's data on their own map.
 * They share its source rather than opening the same files again - `child('dataSource')` hands it
 * over and a spec takes the handle - and its decoder by id.
 */
export function cloneLayerSpec(layer: MassifLayer): { [key: string]: any } | null {
    const source = layer?.child('dataSource' as never);
    if (!source) {
        return null;
    }
    if (layer.is('massif::VectorTileLayer')) {
        return { type: 'vector', source: source.handle, style: mapContext.mapDecoder.id };
    }
    if (layer.is('massif::HillshadeRasterTileLayer')) {
        return { type: 'hillshade', source: source.handle };
    }
    if (layer.is('massif::RasterTileLayer')) {
        return { type: 'raster', source: source.handle };
    }
    return null;
}

export interface MapContext {
    /** Read-only: register via `registerMapModule`, not by assigning here. */
    readonly mapModules: MapModules;
    innerDecoder: MapDecoder;
    mapDecoder: MapDecoder;
    showMapMenu(event);
    showMapOptions(event);
    setMapDefaultOptions(map: MassifMap);
    createMapDecoder(mapStyle, mapStyleLayer): MapDecoder;
    setInnerStyle(style: string, mapStyle: string);
    mapModule<T extends keyof MapModules>(id: T): MapModules[T];
    onOtherAppTextSelected(callback: ContextCallback, once?: boolean);
    onMapReady(callback: ContextCallback, once?: boolean);
    onMapMove(callback: ContextCallback<{ reason: MapMoveReason }>, once?: boolean);
    onMapInteraction(callback: ContextCallback<{ data: MapInteraction }>, once?: boolean);
    onMapStable(callback: ContextCallback<{ reason: MapMoveReason }>, once?: boolean);
    getMapViewPort(): { left: number; width: number; top: number; height: number };
    onMapIdle(callback: ContextCallback, once?: boolean);
    onMapClicked(callback: ContextCallback<MapClickData>, once?: boolean);
    onVectorElementClicked(callback: ContextCallback<ElementClickData>, once?: boolean);
    onVectorTileClicked(callback: ContextCallback<FeatureClickData>, once?: boolean);
    onVectorTileElementClicked(callback: ContextCallback<FeatureClickData>, once?: boolean);
    getMainPage: () => NativeViewElementNode<Page>;
    getMap: () => MassifMap;
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
    }) => Promise<void>;
    zoomToItem: (args: { item: IItem; zoom?: number; minZoom?: number; duration?: number; forceZoomOut?: boolean }) => void;
    unselectItem: (updateBottomSheet?: boolean, forceUnlock?: boolean) => void;
    selectStyle: () => Promise<void>;
    unFocusSearch: () => void;
    showMapResultsPager: (items: IItem<GeoJSONPoint>[]) => void;
    clearSearch: () => void;
    getCurrentLanguage: () => string;
    getSelectedItem: () => IItem;
    setSelectedItem: (item: IItem) => void;
    saveItem: (item?: IItem, peek?: boolean) => Promise<void>;
    getEditingItem: () => IItem;
    getLayers: (layerId?: LayerType) => AddedLayer[];
    addLayer: (layer: MassifLayer, layerId: LayerType, force?: boolean) => void;
    insertLayer: (layer: MassifLayer, layerId: LayerType, index: number) => void;
    removeLayer: (layer: MassifLayer, layerId?: LayerType) => void;
    moveLayer: (layer: MassifLayer, newIndex: number) => void;
    getLayerIndex: (layer: MassifLayer) => number;
    replaceLayer: (oldLayer: MassifLayer, layer: MassifLayer) => void;
    getLayerTypeFirstIndex: (layerId: LayerType) => number;
    vectorElementClicked: (data: ElementClickData) => boolean;
    vectorTileClicked: (data: FeatureClickData) => boolean;
    vectorTileElementClicked: (data: FeatureClickData) => boolean;
    runOnModulesOnMainThread<K extends MapModuleHook>(hook: K, ...args: MapModuleHooks[K]): void;
    runOnModules<K extends MapModuleHook>(hook: K, ...args: MapModuleHooks[K]): unknown;
    featureClickData: typeof featureClickData;
    elementClickData: typeof elementClickData;
    focusOffset: { x: number; y: number };
}

/**
 * The built-in modules. `MapModules` itself lives in the registry and is open for augmentation, so a
 * feature declares its own key from its own file instead of editing this one.
 */
declare module '~/mapModules/registry' {
    interface MapModules {
        customLayers: CustomLayersModule;
        directionsPanel: DirectionsPanel;
        /** Registers only its hooks, not the component: nothing reads it back out of the registry. */
        mapResultsPager: Pick<MapResultPager, 'onVectorTileClicked' | 'onVectorElementClicked'>;
        mapScrollingWidgets: MapScrollingWidgets;
        userLocation: UserLocationModule;
        items: ItemsModule;
    }
}

/**
 * A style, as a spec.
 *
 * A style is an asset package plus the name of one style inside it, and both forms the app ships -
 * a folder on disk while developing, a zip in a release build - are the same two lines of JSON.
 * `base` chains the shared fonts underneath.
 */
function styleSpec(name: string, style: string): SpecArg<'style', 'mbvt'> {
    const stylePath = name.startsWith('/') ? name : `${appPath}/assets/styles/${name}`;
    const isZip = name.endsWith('.zip');
    const useZip = isZip || PRODUCTION || TEST_ZIP_STYLES || !Folder.exists(stylePath);
    DEV_LOG && console.log('styleSpec', name, style, useZip, stylePath);
    return {
        type: 'mbvt',
        project: {
            type: 'project',
            name: style,
            assets: useZip
                ? { type: 'zip', data: { type: 'url', url: isZip ? `file://${stylePath}` : assetUrl(`assets/styles/${name}.zip`) }, base: BASE_ASSETS }
                : { type: 'dir', path: stylePath, base: BASE_ASSETS }
        }
    };
}

/**
 * A decoder, registered under an id so it can be reached again and released.
 *
 * Building the same id with the same spec returns the same object, which is how two layers share
 * one decoder without coordinating; a different spec under that id is refused, so the caller
 * destroys the old one first.
 */
export function createTileDecoder(name: string, style: string = 'voyager', id = `decoder.${name}.${style}`): MapDecoder {
    try {
        const existing = api.find('style', id, 'massif::MBVectorTileDecoder');
        existing?.destroy();
        return api.create('style', id, styleSpec(name, style)) as MapDecoder;
    } catch (error) {
        showError(error);
    }
}

export function onNetworkChanged(callback: (theme) => void) {}

const mapContext: MapContext = {
    /** Live view of the registry — never a snapshot, so lazily mounted modules appear once they register. */
    get mapModules() {
        return getMapModules() as unknown as MapModules;
    },
    setMapDefaultOptions(map: MassifMap) {
        map.apply({
            layersLabelsProcessedInReverseOrder: true,
            seamlessPanning: false,
            restrictedPanning: true,
            panningMode: 'PANNING_MODE_STICKY_FINAL',
            zoomGestures: true,
            doubleClickMaxDuration: 0.3,
            longClickDuration: 0.5,
            kineticRotation: false
        });
        if (isEInk) {
            // An inline bitmap spec: the SDK decodes the bytes the url gives, so nothing here
            // builds an image.
            map.set('backgroundBitmap', { type: 'url', url: assetUrl('assets/images/eink-map-background.png') } as never);
        }
    },
    onOtherAppTextSelected: createGlobalEventListener('onOtherAppTextSelected'),
    onMapReady: createGlobalEventListener<never>('onMapReady'),
    onMapMove: createGlobalEventListener<{ reason: MapMoveReason }>('onMapMove'),
    onMapInteraction: createGlobalEventListener<{ data: MapInteraction }>('onMapInteraction'),
    onMapStable: createGlobalEventListener<{ reason: MapMoveReason }>('onMapStable'),
    onMapIdle: createGlobalEventListener<never>('onMapIdle'),
    onMapClicked: createGlobalEventListener<MapClickData>('onMapClicked'),
    onVectorElementClicked: createGlobalEventListener<ElementClickData>('onVectorElementClicked'),
    onVectorTileClicked: createGlobalEventListener<FeatureClickData>('onVectorTileClicked'),
    onVectorTileElementClicked: createGlobalEventListener<FeatureClickData>('onVectorTileElementClicked'),
    mapModule: getMapModule,
    runOnModulesOnMainThread,
    runOnModules,
    featureClickData,
    elementClickData,
    createMapDecoder(mapStyle, mapStyleLayer) {
        // createTileDecoder releases the id first, so the old object is already unregistered here;
        // the layers still holding it keep it alive until they are rebuilt below.
        const oldDecoder = mapContext.mapDecoder;
        mapContext.mapDecoder = createTileDecoder(mapStyle, mapStyleLayer, 'decoder.map');
        mapContext.setInnerStyle(mapStyleLayer.indexOf('eink') !== -1 ? 'eink' : 'voyager', mapStyle);
        mapContext.runOnModules('vectorTileDecoderChanged', oldDecoder, mapContext.mapDecoder);
        return mapContext.mapDecoder;
    },
    setInnerStyle(style: string, mapStyle: string) {
        ApplicationSettings.setString('innerStyle', style);
        const stylePath = mapStyle.startsWith('/') ? mapStyle.split('/').slice(0, -1).concat('inner').join('/') : 'inner';
        DEV_LOG && console.log('setInnerStyle', style, mapStyle, stylePath);
        const previous = mapContext.innerDecoder;
        const decoder = (mapContext.innerDecoder = createTileDecoder(stylePath, style, 'decoder.inner'));
        const nutiPropsToApply = innerNutiProps.getKeys().reduce((acc, key) => {
            const value = innerNutiProps.getNutiValue(key);
            if (value != null) {
                acc[key] = value;
            }
            return acc;
        }, {});
        if (Object.keys(nutiPropsToApply).length > 0) {
            // One crossing for the whole set: each parameter re-runs the style's repaintability
            // check, so writing them one at a time did that work per key.
            decoder.call('setStyleParameters', nutiPropsToApply);
        }
        // every layer holding the old inner decoder rebuilds itself on this hook
        if (previous && previous !== decoder) {
            mapContext.runOnModules('vectorTileDecoderChanged', previous, decoder);
        }
    },
    focusOffset: { x: 0, y: 0 }
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
                skipCollapsedState: true,
                peekHeight: options?.name ? 350 : 300,
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
                    skipCollapsedState: true,
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
                    skipCollapsedState: true,
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
                await showBottomSheet({ parent, skipCollapsedState: true, view: AltimeterView });
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
    /** The map, as the surface API sees it: options, layers, camera and events on one handle. */
    map: MassifMap;
    onMapReady(map: MassifMap) {
        this.map = map;
    }
    onMapDestroyed() {
        this.map = null;
    }
    onServiceLoaded?(geoHandler: GeoHandler);
    onServiceUnloaded?(geoHandler: GeoHandler);
    onMapMove?(e: { data: { reason: MapMoveReason } });
    onMapInteraction?(e: { data: MapInteraction });
    onMapClicked?(e: { data: MapClickData });
    onVectorTileClicked?(data: FeatureClickData);
    onVectorElementClicked?(data: ElementClickData);
    onVectorTileElementClicked?(data: FeatureClickData);
    onSelectedItem?(item: IItem, oldItem: IItem);
    // dispatched by the map but historically absent from this list, because the dispatcher took a
    // plain string and so nothing ever checked the two against each other
    onMapIdle?(e: unknown);
    onMapStable?(e: { data: { reason: MapMoveReason } });
    reloadMapStyle?();
    vectorTileDecoderChanged?(oldDecoder: MapDecoder, newDecoder: MapDecoder);
}
