import * as api from '@nativescript-community/ui-massifmaps/api';
import type { MassifLayer, MassifMap, MassifObject, MassifSource, SpecArg } from '@nativescript-community/ui-massifmaps/api';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { alert, confirm, login, prompt } from '@nativescript-community/ui-material-dialogs';
import { Application, ApplicationSettings, Color, profile } from '@nativescript/core';
import { ChangeType, ChangedData, ObservableArray } from '@nativescript/core/data/observable-array';
import { File, Folder, path } from '@nativescript/core/file-system';
import { get, writable } from 'svelte/store';
import type { Provider } from '~/data/tilesources';
import { l, lc } from '~/helpers/locale';
import { isEInk } from '~/helpers/theme';
import MapModule, { type MapDecoder, getMapContext } from '~/mapModules/MapModule';
import { getMapModule } from '~/mapModules/registry';
import { fromPosition } from '~/utils/geo';
import { packageService } from '~/services/PackageService';
import { type NutiParamKey, type PropsChangeEvent, clickHandlerLayerFilter, layerProps, nutiProps, preloading } from '~/stores/mapStore';
import { showError } from '@shared/utils/showError';
import { toDegrees, toRadians } from '~/utils/geo';
import { getDataFolder, getDefaultMBTilesDir } from '~/utils/utils';

import { SDK_VERSION } from '@akylas/nativescript/utils';
import { createView, showSnack } from '~/utils/ui';
import { data as TileSourcesData } from '~/data/tilesources';
import { openLink } from '~/utils/ui';
import { clickFilterFor } from '~/utils/massif';
import { Label } from '@nativescript-community/ui-label';
import { colors } from '~/variables';
import { SilentError } from '@akylas/nativescript-app-utils/error';
import { CLog } from '@nativescript-community/sentry';
import { debounce } from '@nativescript/core/utils';
import {
    type LocalArchive,
    type LocalInventory,
    type SourceInput,
    archiveSpec,
    archivesWithRole,
    enabledLocalData,
    fallbackChain,
    mergedSpec,
    orderedSpec,
    vectorArchives,
    vectorChain
} from '~/mapModules/localData/archives';
import { disabledLocalData, localMapOnlineFallback, localTerrainOnlineFallback, scanLocalData } from '~/mapModules/localData/scan';
const mapContext = getMapContext();

export enum RoutesType {
    All = 0,
    Bicycle = 1,
    Hiking = 2
}

/** Only a persistent cache can download an area, and only it declares the download events. */
export type DownloadableSource = MassifSource<'massif::PersistentCacheTileDataSource'>;

export const SLOPE_STEPS = [30, 35, 40, 45];
export const SLOPE_COLORS = ['#f0e64e', '#e87639', '#ff0000', '#c18bb7'];

let SLOPE_HILLSHADE_SHADER;
function getSlopeHillshadeShader() {
    if (!SLOPE_HILLSHADE_SHADER) {
        SLOPE_HILLSHADE_SHADER = `uniform vec4 u_shadowColor;
        uniform vec3 u_lightDir;
        vec4 applyLighting(lowp vec4 color, mediump vec3 normal, mediump vec3 surfaceNormal, mediump float intensity) {
           mediump float slope = acos(dot(normal, surfaceNormal)) *180.0 / 3.14159 * 1.2;
           ${SLOPE_STEPS.slice()
               .reverse()
               .map((step, index) => {
                   const color = new Color(SLOPE_COLORS[SLOPE_STEPS.length - 1 - index]);
                   return `if (slope >= ${step.toFixed(1)}) {return vec4(${color.r / 255}, ${color.g / 255}, ${color.b / 255}, 1.0) * 0.5; }\n`;
               })
               .join('')}
           return vec4(0, 0, 0, 0.0);
        }`;
    }
    return SLOPE_HILLSHADE_SHADER;
}
// export const RELIEF_STEPS = [-850, 50, 150, 250, 450, 925, 1850, 2775, 3700, 8700];
// export const RELIEF_COLORS = ['#22e9df', '#97e697', '#83e183', '#6edc6e', '#59d759', '#45d245', '#F0FAA0', '#E6DCAA', '#DCDCDC', '#FAFAFA', 'white'];

// let RELIEF_HILLSHADE_SHADER;
// function getReliefeHillshadeShader() {
//     if (!RELIEF_HILLSHADE_SHADER) {
//         RELIEF_HILLSHADE_SHADER = `uniform vec4 u_shadowColor;
//         uniform vec3 u_lightDir;
//         vec4 applyLighting(lowp vec4 color, mediump vec3 normal, mediump vec3 surfaceNormal, mediump float intensity) {
//            ${RELIEF_STEPS.slice()
//                .reverse()
//                .map((step, index) => {
//                    const color = new Color(RELIEF_COLORS[RELIEF_STEPS.length - 1 - index]);
//                    return `if (normal.z >= ${step.toFixed(1)}) {return vec4(${color.r / 255}, ${color.g / 255}, ${color.b / 255}, 1.0) * 0.5; }\n`;
//                })
//                .join('')}
//            return vec4(0, 0, 0, 0.0);
//         }`;
//     }
//     return RELIEF_HILLSHADE_SHADER;
// }

function getProviderAttribution(pr) {
    return pr.attribution || (pr.urlOptions && pr.urlOptions.attribution);
}

function templateString(str: string, data) {
    return str.replace(/{(\w*)}/g, function (m, key) {
        return data.hasOwnProperty(key) ? data[key] : m;
    });
}

// slot names are LAYER NAMES in the style (`#hillshade`, `#contour`): an undeclared one is never drawn.
// The number is `massif::CompositeSourceType`, passed as an int (the facade has no enum argument kind).
const HILLSHADE_SLOT = 'hillshade';
const CONTOUR_SLOT = 'contour';
const COMPOSITE_SOURCE_TYPE_HILLSHADE = 1;
// ContourTileDataSource leaves `maxOverzoomLevel` unset, so without this contours stop at the DEM's
// max zoom (16 online, lower for a local .etiles)
const CONTOUR_MAX_OVERZOOM = 8;

// LAYER properties, not style ones: `#hillshade` declares only the slot so a symbolizer does not overwrite them
const HILLSHADE_OPTIONS = {
    contrast: {
        min: 0,
        max: 1
    },
    heightScale: {
        min: 0,
        max: 2
    },
    zoomLevelBias: {
        min: 0,
        max: 5
    },
    highlightColor: {
        type: 'color'
    },
    accentColor: {
        type: 'color'
    },
    shadowColor: {
        type: 'color'
    },
    illuminationDirection: {
        min: 0,
        max: 359,
        transform: (value) => [Math.sin(toRadians(value)), Math.cos(toRadians(value)), 0],
        transformBack: (value) => toDegrees(((value.x || value[0]) > 0 ? 1 : -1) * Math.acos(value.y || value[1]))
    },
    minVisibleZoom: {
        min: 0,
        max: 24
    },
    maxVisibleZoom: {
        min: 0,
        max: 24
    }
};

// flips asynchronously while mbtiles are scanned: UI must react to the store, not read a snapshot
export const mapCapabilities = writable({ hasLocalData: false, hasTerrain: false, hasRoute: false });

/** What the last scan of the data folder found, enabled or not; null before one ran. */
export const localInventory = writable<LocalInventory>(null);

export const LOCAL_DATA_SUPPORTED = !__DISABLE_OFFLINE__ && (!__ANDROID__ || !PLAY_STORE_BUILD || SDK_VERSION < 11);

// item names double as the settings key prefix (`Local_opacity`), so they stay as they were
export const LOCAL_MAP_NAME = 'Local';
export const LOCAL_TERRAIN_NAME = 'Hillshade';

// the style draws the bathymap's `global_landcover` and `depth` below z8
const BATHYMAP_LAST_ZOOM = 7;

export interface SourceItem {
    downloading?: boolean;
    downloadProgress?: number;
    opacity: number;
    legend?: string;
    name: string;
    id?: string;
    local?: boolean;
    /** A DEM. Only the top-most one is woven into the base map's `#hillshade` slot. */
    terrain?: boolean;
    // A DEM's own hillshade layer, kept even when woven: it answers elevation queries.
    // `layer` is what is DRAWN: this one when stacked, the composite's child when in the slot.
    terrainLayer?: MassifLayer<'massif::HillshadeRasterTileLayer'>;
    layer: MassifLayer;
    /** the persistent tile cache's sqlite file, when the source has one */
    databasePath?: string;
    /** the spec it was built from, so a style change can rebuild it with the new decoder */
    spec?: any;
    provider: Provider;
    index?: number;
    options?: {
        [k: string]: {
            min?: number;
            max?: number;
            value?: number;
            transform?: Function;
            transformBack?: Function;
            type?: string;
        };
    };
}
const TAG = 'CustomLayersModule';
export default class CustomLayersModule extends MapModule {
    public customSources: ObservableArray<SourceItem>;

    constructor() {
        super();

        this.customSources = new ObservableArray([]);
        this.customSources.addEventListener(ObservableArray.changeEvent, this.onCustomSourcesChanged, this);
    }
    onCustomSourcesChanged(event: ChangedData<SourceItem>) {
        if (!this.listenForSourceChanges) {
            return;
        }
        switch (event.action) {
            // case ChangeType.Delete: {
            //     this._listViewAdapter.notifyItemRangeRemoved(event.index, event.removed.length);
            //     return;
            // }
            // case ChangeType.Add: {
            //     if (event.addedCount > 0) {
            //         this._listViewAdapter.notifyItemRangeInserted(event.index, event.addedCount);
            //     }
            //     // Reload the items to avoid duplicate Load on Demand indicators:
            //     return;
            // }
            // case ChangeType.Update: {
            //     if (event.addedCount > 0) {
            //         this._listViewAdapter.notifyItemRangeChanged(event.index, event.addedCount);
            //     }
            //     // if (event.removed && event.removed.length > 0) {
            //     //     this._listViewAdapter.notifyItemRangeRemoved(event.index, event.removed.length);
            //     // }
            //     return;
            // }
            case ChangeType.Splice: {
                if (event.addedCount > 0) {
                    this.moveSource(this.customSources.getItem(event.index), event.index);
                    // this._listViewAdapter.notifyItemRangeInserted(event.index, event.addedCount);
                }
                // if (event.removed && event.removed.length > 0) {
                //     this._listViewAdapter.notifyItemRangeRemoved(event.index, event.removed.length);
                // }
                return;
            }
        }
    }
    // Built for every DEM, even the woven one kept off the map: ElevationManager is reached through a
    // hillshade layer, so it answers elevation queries while on no map. The elevation decoder comes
    // from the source's `metaData.dem_encoding`.
    createHillshadeLayer(id: string, name: string, sourceSpec: any) {
        const layer = mapContext.getMap().buildLayer(id, { type: 'hillshade', source: sourceSpec });
        this.applyHillshadeSettings(layer, name);
        return layer;
    }
    // read from the store: the proxy answers null for a value at its default.
    // Held so the mode survives a re-attach, where the composite builds a new child
    private slopeMode = !!get(layerProps.getStore('showSlopePercentages'));
    toggleHillshadeSlope(value: boolean) {
        this.slopeMode = value;
        this.applySlopeMode(this.terrainAttachedTo);
    }
    // Takes the composite: a second map has its own child. An EMPTY shader restores the built-in one.
    // Slopes need a TRUE-scale normal map (heightScale 1, no exaggeration): the shader reads the slope
    // angle in degrees off the normal, and the artistic heightScale 0.2 would damp every slope.
    private applySlopeMode(composite: MassifObject<'massif::CompositeVectorTileLayer'>) {
        this.withExternalChild(composite, HILLSHADE_SLOT, (result) => {
            const child = api.wrap(result.handle, 'massif::HillshadeRasterTileLayer');
            // slopes off: back to what the sheet persisted (same key as applyHillshadeSettings)
            const heightScale = this.slopeMode ? 1 : ApplicationSettings.getNumber(`${this.slotItem?.name}_heightScale`, 0.2);
            // guarded: both rebuild every normal map (`updateTiles`) and this runs on every attach
            if (child.get('exagerateHeightScaleEnabled') !== !this.slopeMode || child.get('heightScale') !== heightScale) {
                child.apply({
                    exagerateHeightScaleEnabled: !this.slopeMode,
                    heightScale,
                    normalMapLightingShader: this.slopeMode ? getSlopeHillshadeShader() : ''
                });
            }
        });
    }
    // Toggles visibility without touching the source list, which would reload the whole base map.
    // A hidden child fetches nothing, so hidden contours are never traced.
    private setSlotVisible(slot: string, visible: boolean) {
        this.withExternalChild(this.terrainAttachedTo, slot, (child) => child.set('visible', visible));
    }

    // The child is what is DRAWN, so the menu and options sheet must write to it. It is rebuilt on
    // every attach, so the item's layer is re-pointed here and persisted settings reapplied.
    private hillshadeChildResult: MassifObject<'massif::Layer'>;
    private setHillshadeChild(composite: MassifObject<'massif::CompositeVectorTileLayer'>) {
        // the previous child is gone with the composite that owned it
        this.hillshadeChildResult?.destroy();
        this.hillshadeChildResult = null;
        const item = this.slotItem;
        if (!composite?.valid || !item) {
            return;
        }
        try {
            this.hillshadeChildResult = composite.call('getExternalChildLayer', HILLSHADE_SLOT);
        } catch (error) {
            DEV_LOG && console.log('setHillshadeChild', error);
            return;
        }
        // a LAYER over the same handle for MassifLayer's `opacity()`/`visible()`; the result stays
        // alive, destroying it would unregister the handle
        const child = api.wrapLayer(this.hillshadeChildResult.handle, 'massif::HillshadeRasterTileLayer');
        this.applyHillshadeSettings(child, item.name);
        item.layer = child;
        item.options = HILLSHADE_OPTIONS;
        const index = this.customSources.indexOf(item);
        if (index !== -1) {
            this.customSources.setItem(index, item);
        }
    }

    // same `${name}_<option>` keys the options sheet writes
    private applyHillshadeSettings(layer: MassifLayer<'massif::HillshadeRasterTileLayer'>, name: string) {
        const illuminationDirection = ApplicationSettings.getNumber(`${name}_illuminationDirection`, 143);
        const opacity = ApplicationSettings.getNumber(`${name}_opacity`, 1);
        const tileFilterModeStr = ApplicationSettings.getString(`${name}_tileFilterMode`, 'bilinear');
        const accentColor = new Color(ApplicationSettings.getString(`${name}_accentColor`, '#000000'));
        const shadowColor = new Color(ApplicationSettings.getString(`${name}_shadowColor`, '#000000'));
        const highlightColor = new Color(ApplicationSettings.getString(`${name}_highlightColor`, '#000000'));
        layer.apply({
            tileFilterMode:
                tileFilterModeStr === 'bicubic' ? 'RASTER_TILE_FILTER_MODE_BICUBIC' : tileFilterModeStr === 'nearest' ? 'RASTER_TILE_FILTER_MODE_NEAREST' : 'RASTER_TILE_FILTER_MODE_BILINEAR',
            visibleZoomRange: [ApplicationSettings.getNumber(`${name}_minVisibleZoom`, 0), ApplicationSettings.getNumber(`${name}_maxVisibleZoom`, 24)],
            contrast: ApplicationSettings.getNumber(`${name}_contrast`, 0.5),
            heightScale: ApplicationSettings.getNumber(`${name}_heightScale`, 0.2),
            tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_ALL',
            illuminationDirection: [Math.sin(toRadians(illuminationDirection)), Math.cos(toRadians(illuminationDirection)), 0],
            highlightColor: highlightColor.argb,
            hillshadeMethod: 'IGOR',
            shadowColor: shadowColor.argb,
            accentColor: accentColor.argb,
            opacity,
            visible: opacity !== 0
        });
    }
    // a call RESULT is owned by the caller: released so handles do not accumulate per toggle
    private withExternalChild(composite: MassifObject<'massif::CompositeVectorTileLayer'>, slot: string, work: (child: MassifObject<'massif::Layer'>) => void) {
        if (!composite?.valid) {
            return;
        }
        let result: MassifObject<'massif::Layer'>;
        try {
            result = composite.call('getExternalChildLayer', slot);
        } catch (error) {
            // nothing in that slot - not an error, there may be no terrain loaded
            DEV_LOG && console.log('withExternalChild', slot, error);
            return;
        }
        try {
            work(result);
        } finally {
            result.destroy();
        }
    }
    mDevMode = ApplicationSettings.getBoolean('devMode', false);

    getTokenKeys() {
        return {
            americanaosm: ApplicationSettings.getString('americanaosmToken', this.devMode ? AMERICANA_OSM_URL : undefined),
            here_appid: ApplicationSettings.getString('here_appidToken', this.devMode ? HER_APP_ID : undefined),
            here_appcode: ApplicationSettings.getString('here_appcodeToken', this.devMode ? HER_APP_CODE : undefined),
            mapbox: ApplicationSettings.getString('mapboxToken', this.devMode ? MAPBOX_TOKEN : undefined),
            mapquest: ApplicationSettings.getString('mapquestToken', this.devMode ? MAPQUEST_TOKEN : undefined),
            maptiler: ApplicationSettings.getString('maptilerToken', this.devMode ? MAPTILER_TOKEN : undefined),
            google: ApplicationSettings.getString('googleToken', this.devMode ? GOOGLE_TOKEN : undefined),
            thunderforest: ApplicationSettings.getString('thunderforestToken', this.devMode ? THUNDERFOREST_TOKEN : undefined),
            ign: ApplicationSettings.getString('ignToken', this.devMode ? IGN_TOKEN : undefined)
        };
    }
    set devMode(value: boolean) {
        this.mDevMode = value;
        ApplicationSettings.setBoolean('devMode', value);
        this.tokenKeys = this.getTokenKeys();
    }
    get devMode() {
        return this.mDevMode;
    }
    tokenKeys = this.getTokenKeys();
    saveToken(key, value) {
        ApplicationSettings.setString(key + 'Token', value);
        this.tokenKeys[key] = value;
    }

    getTestImageAndHeaders(provider: Provider) {
        let url = provider.url;
        if (provider.tokenKey) {
            const tokens = Array.isArray(provider.tokenKey) ? provider.tokenKey : [provider.tokenKey];
            const needsToSet = tokens.map((s) => this.tokenKeys[s]).some((s) => s === undefined);
            if (needsToSet) {
                return null;
            }
            tokens.forEach((tok) => {
                let toReplace = this.tokenKeys[tok];
                if (tok === 'americanaosm' && toReplace.indexOf('{x}') === -1) {
                    toReplace = toReplace + '/planet/{z}/{x}/{y}.mvt';
                }
                url = url.replace(`{${tok}}`, toReplace);
            });
        }
        return { url: templateString(url, { s: 'a', x: '528', y: '367', z: '10', ...provider.urlOptions }), headers: provider.sourceOptions?.httpHeaders };
    }

    async createDataSource(id: string, provider: Provider) {
        const rasterCachePath = Folder.fromPath(path.join(getDataFolder(), 'rastercache'));
        const idForPath = id.replaceAll(/[\\\?\*<":>\+\[\]\s\t\n\.]+/g, '_');
        const databasePath = File.fromPath(path.join(rasterCachePath.path, idForPath)).path;
        let url = provider.url;
        if (provider.tokenKey) {
            const tokens = Array.isArray(provider.tokenKey) ? provider.tokenKey : [provider.tokenKey];
            const needsToSet = tokens.map((s) => this.tokenKeys[s]).some((s) => s === undefined);
            if (needsToSet) {
                if (tokens.length === 2) {
                    const result = await login({
                        title: lc('api_key'),
                        message: lc('api_key_needed', tokens.join(',')),
                        autoFocus: true,
                        userNameHint: tokens[0],
                        passwordHint: tokens[1]
                    });
                    if (result?.result) {
                        this.saveToken(tokens[0], result.userName);
                        this.saveToken(tokens[1], result.password);
                    }
                } else {
                    const result = await prompt({
                        title: lc('api_key'),
                        message: lc('api_key_needed', tokens[0]),
                        autoFocus: true,
                        hintText: tokens[0]
                    });
                    if (result?.result) {
                        this.saveToken(tokens[0], result.text);
                    }
                }
            }
            for (let index = 0; index < tokens.length; index++) {
                const tok = tokens[index];
                if (!this.tokenKeys[tok]) {
                    showSnack({ message: lc('missing_api_token') });
                    return;
                }
                let toReplace = this.tokenKeys[tok];
                if (tok === 'americanaosm' && toReplace.indexOf('{x}') === -1) {
                    toReplace = toReplace + '/planet/{z}/{x}/{y}.mvt';
                }
                // if (Array.isArray(url)) {
                //     url = url.map((u) => u.replace(`{${tok}}`, toReplace));
                // } else {
                url = url.replace(`{${tok}}`, toReplace);
                // }
            }
        }
        const vectorDataSource = url.indexOf('.mvt') >= 0 || url.indexOf('.pbf') >= 0;
        // spec keys must use the SDK's declared name: `HTTPHeaders`
        const { encoding, httpHeaders, subdomains, ...sourceOptions } = (provider.sourceOptions ?? {}) as any;
        const httpSpec = {
            type: 'http' as const,
            url,
            ...sourceOptions,
            ...(httpHeaders ? { HTTPHeaders: httpHeaders } : {}),
            // the tables spell a subdomain set as 'abcd'; the SDK's property is a list
            ...(subdomains ? { subdomains: typeof subdomains === 'string' ? subdomains.split('') : subdomains } : {}),
            // DEM encoding is META DATA (`ElevationDecoder::Resolve` reads `dem_encoding`),
            // TileDataSource has no `encoding` property
            ...(encoding ? { metaData: { dem_encoding: encoding } } : {})
        };
        const downloadable = provider.downloadable || !PRODUCTION || this.devMode;
        const cacheable = provider.cacheable || !PRODUCTION;
        const cacheSize = ApplicationSettings.getNumber(`${id}_cacheSize`, 300);
        const cached = cacheable !== false || downloadable;
        return {
            sourceSpec: cached
                ? {
                      type: 'persistent-cache' as const,
                      source: httpSpec,
                      databasePath,
                      cacheOnlyMode: ApplicationSettings.getBoolean(`${id}_cacheOnlyMode`, false),
                      capacity: cacheSize * 1024 * 1024
                      // no `dem_encoding`: CacheTileDataSource falls back to the wrapped source's metadata
                  }
                : httpSpec,
            // a constructor argument of PersistentCacheTileDataSource, not a readable property
            databasePath: cached ? databasePath : undefined,
            vectorDataSource
        };
    }
    async createDataSourceAndMapLayer(id: string, provider: Provider) {
        const opacity = ApplicationSettings.getNumber(`${id}_opacity`, 1);

        // bitmaps are upsampled on high-DPI screens by default: compensate with a zoom bias
        const zoomLevelBias = ApplicationSettings.getNumber(`${id}_zoomLevelBias`, (Math.log(mapContext.getMap().get('DPI') / 160.0) / Math.log(2)) * 0.75);
        const options = {
            zoomLevelBias: {
                min: 0,
                max: 5
            }
        };

        const { databasePath, sourceSpec, vectorDataSource } = await this.createDataSource(id, provider);
        const map = mapContext.getMap();
        const layerId = `layer.custom.${id}`;

        let layer: MassifLayer;
        let terrainLayer: MassifLayer<'massif::HillshadeRasterTileLayer'>;
        let spec: any;
        let terrain = false;
        if (provider.hillshade) {
            // stacked or woven into `#hillshade` is decided by updateTerrain
            terrain = true;
            terrainLayer = this.createHillshadeLayer(layerId, id, sourceSpec);
            layer = terrainLayer;
        } else if (vectorDataSource) {
            // kept: vectorTileDecoderChanged rebuilds the layer from it, and skips items without one
            spec = {
                type: 'composite-vector',
                source: sourceSpec,
                style: mapContext.mapDecoder.id,
                zoomLevelBias: ApplicationSettings.getNumber(`${id}_zoomLevelBias`, 0),
                labelRenderOrder: 1, // VECTOR_TILE_RENDER_ORDER_LAST
                visible: opacity !== 0,
                layerBlendingSpeed: isEInk ? 0 : 3,
                labelBlendingSpeed: isEInk ? 0 : 3,
                opacity,
                clickRadius: layerProps['clickRadius'],
                preloading: get(preloading),
                clickHandlerLayerFilter: clickFilterFor(get(clickHandlerLayerFilter)),
                ...provider.layerOptions
            };
            layer = map.buildLayer(layerId, spec);
            layer.onFeatureClick((e) => {
                e.consumed = mapContext.vectorTileClicked(mapContext.featureClickData(e));
            });
        } else {
            spec = {
                type: 'raster',
                source: sourceSpec,
                preloading: get(preloading),
                tileBlendingSpeed: isEInk ? 0 : 3,
                zoomLevelBias,
                opacity,
                visible: opacity !== 0,
                ...provider.layerOptions
            };
            layer = map.buildLayer(layerId, spec);
        }

        // console.log('createRasterLayer', id, opacity, provider.url, provider.sourceOptions, dataSource, dataSource.maxZoom, dataSource.minZoom);
        return {
            name: id,
            id,
            legend: provider.legend,
            opacity,
            options: terrain ? HILLSHADE_OPTIONS : options,
            layer,
            terrainLayer,
            databasePath,
            spec,
            provider,
            terrain
        };
    }

    sourcesLoaded = false;
    listenForSourceChanges = false;
    baseProviders: { [k: string]: Provider } = {};
    overlayProviders: { [k: string]: Provider } = {};
    isOverlay(providerName, provider: Provider) {
        if (!!provider.isOverlay || (provider.layerOptions && provider.layerOptions.opacity && provider.layerOptions.opacity < 1)) {
            return true;
        }
        return false;
    }
    addProvider(arg, providers: { [k: string]: Provider }) {
        const parts = arg.split('.');
        const id = arg.toLowerCase();

        const providerName = parts[0];
        const variantName = parts[1];
        let name = providerName;
        if (variantName) {
            name += ' ' + variantName;
        }

        const data = providers[providerName];
        if (!data) {
            throw new Error('No such provider (' + providerName + ')');
        }
        const provider: Provider = {
            name,
            id,
            category: data.category,
            url: data.url,
            sourceOptions: {
                minZoom: 0,
                maxZoom: 22,
                ...data.sourceOptions
            },
            attribution: data.attribution,
            tokenKey: data.tokenKey,
            urlOptions: data.urlOptions,
            layerOptions: data.layerOptions,
            downloadable: data.downloadable,
            devHidden: data.devHidden,
            cacheable: data.cacheable
        };

        if (data.legend) {
            provider.legend = templateString(data.legend, provider.urlOptions);
        }
        // if (data.cacheable !== undefined) {
        // provider.cacheable = data.cacheable || !PRODUCTION;
        // } else {
        //     provider.cacheable = !PRODUCTION;
        // }
        if (data.hillshade === true) {
            provider.hillshade = true;
            provider.terrarium = data.terrarium;
        }
        // if (data.downloadable !== undefined) {
        //     provider.downloadable = data.downloadable || !PRODUCTION || this.devMode;
        // } else {
        //     provider.downloadable = !PRODUCTION;
        // }
        // if (data.devHidden !== undefined) {
        //     provider.devHidden = data.devHidden;
        // }

        if (variantName && 'variants' in data) {
            const variant = data.variants[variantName];
            if (!variant) {
                throw new Error('No such variant of ' + providerName + ' (' + variantName + ')');
            }
            if (typeof variant === 'string') {
                provider.urlOptions = {
                    variant,
                    ...provider.urlOptions
                };
            } else {
                provider.url = variant.url || provider.url;
                provider.attribution = variant.attribution || provider.attribution;
                provider.sourceOptions = { ...provider.sourceOptions, ...variant.sourceOptions };
                provider.layerOptions = { ...provider.layerOptions, ...variant.layerOptions };
                provider.urlOptions = { variant: variantName, ...provider.urlOptions, ...variant.urlOptions };
            }
            // } else if (typeof provider.url === 'function') {
            // provider.url = provider.url(parts.splice(1, parts.length - 1).join('.'));
        }
        if (!provider.url) {
            return;
        }
        // const forceHTTP = provider.options.forceHTTP;
        // if ((provider.url as string).indexOf('//') === 0) {
        //     provider.url = (forceHTTP ? 'http:' : 'https:') + provider.url;
        //     // provider.url = forceHTTP ? 'http:' : 'https:' + provider.url;
        // }
        if (provider.urlOptions) {
            provider.url = templateString(provider.url, provider.urlOptions);
            if (provider.url.indexOf('{variant}') >= 0) {
                return;
            }
        } else if (provider.url.indexOf('{variant}') >= 0) {
            return;
        }
        const attributionReplacer = function (attr) {
            if (!attr || attr.indexOf('{attribution.') === -1) {
                return attr;
            }
            return attr.replace(/\{attribution.(\w*)\}/, function (match, attributionName) {
                return attributionReplacer(getProviderAttribution(providers[attributionName]));
            });
        };
        provider.attribution = attributionReplacer(getProviderAttribution(provider));
        if (this.isOverlay(arg, provider)) {
            this.overlayProviders[id] = provider;
        } else {
            this.baseProviders[id] = provider;
        }
    }
    async getSourcesLibrary() {
        if (this.sourcesLoaded) {
            return;
        }
        // const module = import('~/data/tilesources');
        // })
        // const providers = module.data;
        for (const provider in TileSourcesData) {
            this.addProvider(provider, TileSourcesData);
            if (TileSourcesData[provider].variants) {
                for (const variant in TileSourcesData[provider].variants) {
                    this.addProvider(provider + '.' + variant, TileSourcesData);
                }
            }
        }
        this.sourcesLoaded = true;
    }

    /** Returns the provider's source SPEC, not a built source. */
    async createDataSourceFromId(s: string) {
        await this.getSourcesLibrary();
        const provider = this.baseProviders[s] || this.overlayProviders[s];
        if (provider) {
            const { sourceSpec } = await this.createDataSource(s, provider);
            return sourceSpec;
        }
    }

    get defaultOnlineSources() {
        // if (this.tokenKeys.americanaosm) {
        //     return 'americanaosm';
        // } else {
        return ['openfreemap', 'mapterhorn'];
        // }
    }
    // get americanaOSMHTML() {
    //     return lc(
    //         'americanaosm_presentation_detailed',
    //         ...['<a href="https://tile.ourmap.us">AmericanaOSM</a>', `<a href="https://github.com/Akylas/alpimaps/?tab=readme-ov-file#default-vector-americanosm-map">${lc('tutorial')}</a>`]
    //     );
    // }

    onMapReady(map: MassifMap) {
        super.onMapReady(map);
        // `param::contours` only stops drawing; the child keeps tracing, so hide it too.
        // Not detached: that would reload the whole base map.
        nutiProps.on('change', (event: PropsChangeEvent) => {
            if (event.key === 'contours') {
                this.setSlotVisible(CONTOUR_SLOT, !!event.value);
            }
        });
        (async () => {
            try {
                if (!this.listenForSourceChanges) {
                    if (LOCAL_DATA_SUPPORTED) {
                        const folderPath = await getDefaultMBTilesDir();
                        if (folderPath && Folder.exists(folderPath)) {
                            await this.loadLocalData(folderPath);
                        }
                        this.watchLocalDataSettings();
                        if (this.customSources.length === 0) {
                            const showFirstPresentation = ApplicationSettings.getBoolean('showFirstPresentation', true);
                            if (showFirstPresentation) {
                                const result = await confirm({
                                    title: lc('app.name'),
                                    message: lc('app_generate_date_presentation'),
                                    okButtonText: lc('open_github'),
                                    cancelButtonText: lc('cancel')
                                });
                                if (result) {
                                    openLink(GIT_URL);
                                }
                                ApplicationSettings.setBoolean('showFirstPresentation', false);
                            }
                        }
                    }

                    const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
                    const showOpenFreeMapPresentation = ApplicationSettings.getBoolean('showOpenFreeMapPresentation', true);
                    if (showOpenFreeMapPresentation) {
                        if ((savedSources.indexOf('openstreetmap') !== -1 || savedSources.indexOf('americanaosm') !== -1) && savedSources.indexOf('openfreemap') !== -1) {
                            ApplicationSettings.setBoolean('showOpenFreeMapPresentation', false);
                            await alert({
                                title: lc('app.name'),
                                message: lc('openfreemap_presentation'),
                                okButtonText: lc('ok')
                            });
                        }
                        // const currentIndex = savedSources.indexOf('openfreemap');
                        // DEV_LOG && console.log('savedSources', currentIndex, savedSources);
                        // if (currentIndex !== -1) {
                        //     savedSources.splice(currentIndex, 1);
                        //     ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
                        // }
                        // const { colorOnSurfaceVariant } = get(colors);
                        // const promptResult = await prompt({
                        //     title: lc('app.name'),
                        //     // message: lc('americanaosm_presentation'),
                        //     okButtonText: lc('save'),
                        //     cancelButtonText: lc('cancel'),
                        //     defaultText: this.tokenKeys['americanaosm'],
                        //     textFieldProperties: {
                        //         variant: 'outline',
                        //         hint: lc('americanaosm_url'),
                        //         margin: 10,
                        //         width: { unit: '%', value: 100 }
                        //     },
                        //     view: createView(
                        //         Label,
                        //         {
                        //             padding: '10 20 0 20',
                        //             textWrap: true,
                        //             color: colorOnSurfaceVariant as any,
                        //             html: this.americanaOSMHTML
                        //         },
                        //         {
                        //             linkTap: (e) => openLink(e.link)
                        //         }
                        //     )
                        // });
                        // if (promptResult.result && promptResult?.text.length > 0) {
                        //     this.saveToken('americanaosm', promptResult.text);
                        // }
                    }
                    if (this.customSources.length === 0 && savedSources.length === 0) {
                        const sources = this.defaultOnlineSources;
                        savedSources.push(...sources);
                        ApplicationSettings.setString('added_providers', JSON.stringify(sources));
                    }
                    if (savedSources.length > 0) {
                        await this.getSourcesLibrary();
                        for (let index = 0; index < savedSources.length; index++) {
                            const s = savedSources[index];
                            let provider;
                            if (typeof s === 'string') {
                                provider = this.baseProviders[s] || this.overlayProviders[s];
                            } else {
                                provider = s;
                            }
                            try {
                                if (provider) {
                                    const data = await this.createDataSourceAndMapLayer(provider.id || provider.name, provider);
                                    this.customSources.push(data);
                                    if (!data.terrain) {
                                        mapContext.addLayer(data.layer, 'customLayers');
                                    }
                                    this.updateAttribution(data);
                                }
                            } catch (err) {
                                console.error('createRasterLayer', err);
                            }
                        }
                    }
                    this.listenForSourceChanges = true;
                }
                // last: the slots go on the top-most composite, only known once every source is in
                this.updateTerrain();

                this.notify({ eventName: 'ready' });
            } catch (err) {
                showError(err);
            }
        })();
    }
    updateClickHandlerLayerFilter() {
        this.updateVectorTileLayerProperty('clickHandlerLayerFilter', clickFilterFor(get(clickHandlerLayerFilter)));
    }
    // `trySet`: the stack also holds raster and hillshade layers without that property
    updateVectorTileLayerProperty(key: string, value) {
        mapContext.getLayers().forEach((data) => data.layer?.trySet(key, value));
    }
    // `tileDecoder` is read-only on the SDK layer, so layers are rebuilt from their spec
    vectorTileDecoderChanged(oldDecoder: MapDecoder, newDecoder: MapDecoder) {
        const generation = ++this.decoderGeneration;
        this.customSources.forEach((item) => {
            if (!item.spec || (item.spec.type !== 'vector' && item.spec.type !== 'composite-vector')) {
                return;
            }
            // only the layers on the decoder that changed: the inner decoder changing rebuilt the map on it
            if (oldDecoder && item.spec.style !== oldDecoder.id) {
                return;
            }
            const oldLayer = item.layer;
            // reuse the source: rebuilding a persistent-cache spec opens a SECOND cache on the same file
            const source = oldLayer.source();
            item.spec = { ...item.spec, ...(source ? { source: source.handle } : {}), style: newDecoder.id };
            // fresh id per generation from the base id, so ids do not grow on every style switch
            const baseId = String(oldLayer.id).replace(/#\d+$/, '');
            const layer = mapContext.getMap().buildLayer(`${baseId}#${generation}`, item.spec);
            layer.onFeatureClick((e) => {
                e.consumed = mapContext.vectorTileClicked(mapContext.featureClickData(e));
            });
            mapContext.replaceLayer(oldLayer, layer);
            if (oldLayer === packageService.localVectorTileLayer) {
                packageService.setLocalVectorData(layer, packageService.localBaseArchives);
            }
            oldLayer.destroy();
            item.layer = layer;
        });
        // Every rebuilt layer is a fresh object with no external sources on it.
        this.updateTerrain();
    }
    private decoderGeneration = 0;
    hillshadeLayer: MassifLayer<'massif::HillshadeRasterTileLayer'>;
    /** The DEM, once one is loaded. Feeds the `#hillshade` slot and the generated contours. */
    private terrainSource: MassifSource;
    /** `terrainSource` traced into contour lines, built on first use because it is not always wanted. */
    private contourSource: MassifSource;
    /** The composite the slots are currently wired to, so they can be moved or taken off again. */
    private terrainAttachedTo: MassifObject<'massif::CompositeVectorTileLayer'>;

    /** The DEM item currently holding the slot, so a reorder can tell whether it changed. */
    private slotItem: SourceItem;

    // The style has ONE `#hillshade` slot: one DEM is woven in, every other is a stacked hillshade layer.
    updateTerrain() {
        // a PLAIN array: ObservableArray.filter returns an ObservableArray, which has no index access
        const terrainItems: SourceItem[] = [];
        this.customSources.forEach((item) => {
            if (item.terrain && item.terrainLayer) {
                terrainItems.push(item);
            }
        });
        // an OFFLINE DEM always wins (no network needed), else the top-most; `customSources` runs
        // bottom-to-top, so that is the last
        const slotItem = terrainItems.find((item) => item.local) ?? terrainItems[terrainItems.length - 1];
        this.hasTerrain = terrainItems.length > 0;

        // same DEM for elevation: a profile over an online source is thousands of tile fetches
        this.hillshadeLayer = packageService.hillshadeLayer = slotItem?.terrainLayer;

        // keyed on the ITEM: `layer.source()` registers a NEW handle per call, and rebuilding the
        // slots every time discards contours before they finish tracing
        if (slotItem !== this.slotItem) {
            this.terrainSource?.destroy();
            this.terrainSource = slotItem ? slotItem.terrainLayer.source() : null;
            // rebuilt: the id is registered against its spec, the same id with a new source is refused
            this.contourSource?.destroy();
            this.contourSource = null;
        }

        // the woven DEM's own layer comes OFF the map: the composite draws its child, both would shade twice
        terrainItems.forEach((item) => {
            const stacked = item !== slotItem;
            const inStack = mapContext.getLayerIndex(item.terrainLayer) !== -1;
            if (stacked && !inStack) {
                mapContext.addLayer(item.terrainLayer, 'customLayers');
            } else if (!stacked && inStack) {
                mapContext.removeLayer(item.terrainLayer, 'customLayers');
            }
            // what the menu and the sheet act on: this layer, until setHillshadeChild re-points the
            // woven one at the child the composite builds
            item.layer = item.terrainLayer;
        });
        this.slotItem = slotItem;
        DEV_LOG &&
            console.log(
                'updateTerrain',
                JSON.stringify({
                    terrainItems: terrainItems.map((item) => ({
                        name: item.name,
                        local: !!item.local,
                        layerValid: !!item.terrainLayer?.valid,
                        stacked: mapContext.getLayerIndex(item.terrainLayer) !== -1
                    })),
                    slot: slotItem?.name,
                    sourceValid: !!this.terrainSource?.valid
                })
            );
        this.updateTerrainAttachment();
        // the 3D mesh reads the same DEM; terrain3d may not be registered
        getMapModule('terrain3d')?.onTerrainSourceChanged();
    }

    // only the TOP-MOST composite: each attachment builds its own child layer over the DEM
    updateTerrainAttachment() {
        const composites = mapContext
            .getLayers()
            .map((added) => added.layer)
            .filter((layer) => layer?.is('massif::CompositeVectorTileLayer'));
        // getLayers is bottom-to-top, so the last one is the one drawn over the others
        const target = this.terrainSource ? composites[composites.length - 1] : null;
        // adding/removing an external source reloads the composite's tiles: only when target or DEM changed
        if (target?.handle === this.terrainAttachedTo?.handle && this.terrainSource === this.attachedSource) {
            // still re-point the item's layer at the child: updateTerrain reset it to the detached
            // elevation layer, which nothing draws
            this.setHillshadeChild(this.terrainAttachedTo);
            return;
        }
        if (this.terrainAttachedTo) {
            this.detachTerrain(this.terrainAttachedTo);
            this.terrainAttachedTo = null;
        }
        this.attachedSource = target ? this.terrainSource : null;
        if (target) {
            this.terrainAttachedTo = this.attachTerrain(target);
        }
    }
    // compared by IDENTITY: `layer.source()` registers a new handle every call
    private attachedSource: MassifSource;

    // not `nutiProps[key]`: the proxy answers null for a value at its default
    private mapOption(key: NutiParamKey): boolean {
        return !!get(nutiProps.getStore(key));
    }

    // Public: a cloned composite on a second map needs its own slots. The contour source wraps the DEM
    // (traced, shared across maps). Both slots always attach; toggled-off ones are hidden, not detached.
    attachTerrain(layer: MassifLayer): MassifObject<'massif::CompositeVectorTileLayer'> | null {
        if (!this.terrainSource || !layer?.is('massif::CompositeVectorTileLayer')) {
            return null;
        }
        // `is` is not a type guard, so re-type via `wrap`, which registers nothing to release
        const composite = api.wrap(layer.handle, 'massif::CompositeVectorTileLayer');
        try {
            if (!this.contourSource) {
                this.contourSource = mapContext.getMap().source('source.contour', {
                    type: 'contour',
                    source: this.terrainSource.handle,
                    maxOverzoomLevel: CONTOUR_MAX_OVERZOOM
                });
            }
            composite.call('addExternalDataSource', HILLSHADE_SLOT, this.terrainSource.handle, COMPOSITE_SOURCE_TYPE_HILLSHADE);
            composite.call('addVectorDataSource', CONTOUR_SLOT, this.contourSource.handle);
        } catch (error) {
            showError(error);
            return null;
        }
        // the children are brand new: reapply the user's choices
        this.setHillshadeChild(composite);
        this.withExternalChild(composite, CONTOUR_SLOT, (child) => child.set('visible', this.mapOption('contours')));
        this.applySlopeMode(composite);
        DEV_LOG && this.logSlotStatus(composite);
        return composite;
    }

    // tells "not attached" from "attached but the style has no such layer" (SDK only warns about it)
    private logSlotStatus(composite: MassifObject<'massif::CompositeVectorTileLayer'>) {
        try {
            const declared = mapContext.mapDecoder?.get('styleLayerNames') ?? [];
            const registered = (composite.call('getExternalDataSourceNames') ?? []) as string[];
            console.log(
                'attachTerrain slots',
                JSON.stringify({
                    slots: registered.map((name) => `${name}: ${declared.includes(name) ? 'OK' : 'MISSING in style'}`),
                    contours: this.mapOption('contours')
                })
            );
        } catch (error) {
            console.log('logSlotStatus', error);
        }
    }

    /** A name the composite never held is simply false, not an error. */
    private detachTerrain(composite: MassifObject<'massif::CompositeVectorTileLayer'>) {
        // the child goes with the slot; the next attach re-points the item
        this.hillshadeChildResult?.destroy();
        this.hillshadeChildResult = null;
        if (!composite?.valid) {
            return;
        }
        try {
            composite.call('removeExternalDataSource', HILLSHADE_SLOT);
            composite.call('removeExternalDataSource', CONTOUR_SLOT);
        } catch (error) {
            DEV_LOG && console.log('detachTerrain', error);
        }
    }
    needsAttribution = false;
    addDataSource(item: SourceItem, save = true) {
        const name = this.getSourceItemId(item);
        const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
        const layerIndex = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);

        if (layerIndex === -1) {
            this.customSources.push(item);
            if (!item.terrain) {
                mapContext.addLayer(item.layer, 'customLayers');
            }
            if (save) {
                if (item.provider.type) {
                    savedSources.push(item.provider);
                } else {
                    savedSources.push(name);
                }
                ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
            }
        } else {
            this.customSources.splice(layerIndex, 0, item);
            if (!item.terrain) {
                mapContext.insertLayer(item.layer, 'customLayers', layerIndex);
            }
        }
        this.updateTerrain();
        this.updateAttribution(item);
    }
    // store-backed: these flip asynchronously long after mount, and UI must re-render
    get hasLocalData() {
        return get(mapCapabilities).hasLocalData;
    }
    set hasLocalData(value: boolean) {
        mapCapabilities.update((capabilities) => ({ ...capabilities, hasLocalData: value }));
    }
    get hasTerrain() {
        return get(mapCapabilities).hasTerrain;
    }
    set hasTerrain(value: boolean) {
        mapCapabilities.update((capabilities) => ({ ...capabilities, hasTerrain: value }));
    }
    get hasRoute() {
        return get(mapCapabilities).hasRoute;
    }
    set hasRoute(value: boolean) {
        mapCapabilities.update((capabilities) => ({ ...capabilities, hasRoute: value }));
    }
    /** The SDK objects the current local load built, released once the next one replaced them. */
    private localObjects: MassifObject[] = [];
    private localGeneration = 0;
    private localFolder: string;
    // one load at a time: a toggle while one builds would interleave their items
    private localLoad = Promise.resolve();
    private localDataUnsubscribers: (() => void)[] = [];

    /** Rescans the folder and rebuilds the Local map and terrain items in place. */
    loadLocalData(folder = this.localFolder) {
        this.localLoad = this.localLoad.then(() => this.buildLocalData(folder)).catch(showError);
        return this.localLoad;
    }

    private watchLocalDataSettings() {
        const reload = debounce(() => this.loadLocalData(), 300);
        let ready = false;
        this.localDataUnsubscribers = [localMapOnlineFallback, localTerrainOnlineFallback, disabledLocalData].map((store) => store.subscribe(() => ready && reload()));
        ready = true;
    }

    private async buildLocalData(folder: string) {
        if (!folder) {
            return;
        }
        this.localFolder = folder;
        const inventory = scanLocalData(folder);
        localInventory.set(inventory);
        const enabled = enabledLocalData(inventory, get(disabledLocalData));
        const previousObjects = this.localObjects;
        this.localObjects = [];
        this.localGeneration++;
        const local = await this.buildLocalMapItem(enabled);
        const terrainItem = await this.buildLocalTerrainItem(enabled);
        const replacedLayers = [this.setLocalItem(LOCAL_MAP_NAME, local?.item), this.setLocalItem(LOCAL_TERRAIN_NAME, terrainItem)];

        const archives = [...enabled.regions.flatMap((region) => region.archives), ...enabled.world];
        this.hasLocalData = !!local;
        this.hasRoute = archives.some((archive) => archive.role === 'routes');
        packageService.setLocalVectorData(local?.layer, archivesWithRole(archives, 'map'));
        // before the replaced layers go: it moves the terrain slots off them
        this.updateTerrain();
        replacedLayers.forEach((layer) => layer?.destroy());
        previousObjects.forEach((object) => object.destroy());
    }

    /** Swaps a Local item in place, keeping its rank. Returns the layer it took off, for the caller to release. */
    private setLocalItem(name: string, item: SourceItem | null) {
        const index = this.customSources.findIndex((source) => source.local && source.name === name);
        const previous = index === -1 ? null : this.customSources.getItem(index);
        // by stack membership: the woven DEM's `layer` is the composite's child, never in the stack
        const previousLayer = previous ? (previous.terrainLayer ?? previous.layer) : null;
        const stacked = !!previousLayer && mapContext.getLayerIndex(previousLayer) !== -1;
        if (item && !item.terrain && stacked) {
            mapContext.replaceLayer(previousLayer, item.layer);
        } else {
            if (stacked) {
                mapContext.removeLayer(previousLayer);
            }
            if (item && !item.terrain) {
                mapContext.addLayer(item.layer, 'map');
            }
        }
        // the list's splice handler would move the layer into the custom layers' range
        const listening = this.listenForSourceChanges;
        this.listenForSourceChanges = false;
        if (item && previous) {
            this.customSources.setItem(index, item);
        } else if (item) {
            this.customSources.push(item);
        } else if (previous) {
            this.customSources.splice(index, 1);
        }
        this.listenForSourceChanges = listening;
        return previousLayer;
    }

    /** `multi` picks the archive per tile from each one's tile mask; a lone region needs none. */
    private localMulti(name: string, sources: SourceInput[]) {
        if (sources.length <= 1) {
            return sources[0];
        }
        const prefix = `source.local.${this.localGeneration}.${name}`;
        const multi = mapContext.getMap().source(`${prefix}.multi`, { type: 'multi' });
        this.localObjects.push(multi);
        sources.forEach((source, index) => multi.call('add', this.localSourceHandle(`${prefix}.${index}`, source), ''));
        return multi.handle;
    }

    private localSourceHandle(id: string, input: SourceInput) {
        if (typeof input === 'number') {
            return input;
        }
        const source = mapContext.getMap().source(id, input);
        this.localObjects.push(source);
        return source.handle;
    }

    private localBathymap(archives: LocalArchive[]) {
        const handles = archives.map((archive, index) => {
            const source = mapContext.getMap().source(`source.local.${this.localGeneration}.bathymap.${index}`, archiveSpec(archive));
            this.localObjects.push(source);
            // merged over whichever source answers: past this it would replace their parent tiles
            source.set('maxOverzoomLevel', Math.max(0, BATHYMAP_LAST_ZOOM - source.get('maxZoom')));
            return source.handle;
        });
        return mergedSpec(handles);
    }

    /** Its own cache file: the same provider added as a layer already has one under its id. */
    private async onlineFallback(providerId: string) {
        await this.getSourcesLibrary();
        const provider = this.baseProviders[providerId] ?? this.overlayProviders[providerId];
        const data = provider && (await this.createDataSource(`${providerId}_local_fallback`, provider));
        return data ? { provider, sourceSpec: data.sourceSpec } : null;
    }

    private async buildLocalMapItem({ regions, world }: LocalInventory) {
        const regionSources = regions.map((region) => mergedSpec(vectorArchives(region.archives).map(archiveSpec))).filter(Boolean);
        const worldSource = mergedSpec(vectorArchives(world).map(archiveSpec));
        const bathymap = this.localBathymap(archivesWithRole(world, 'bathymap'));
        if (!regionSources.length && !worldSource && !bathymap) {
            return null;
        }
        const online = get(localMapOnlineFallback) ? await this.onlineFallback('openfreemap') : null;
        const opacity = ApplicationSettings.getNumber(`${LOCAL_MAP_NAME}_opacity`, 1);
        // composite so the DEM can be woven into the style's layer order rather than stacked
        const spec: SpecArg<'layer', 'composite-vector'> = {
            type: 'composite-vector',
            source: vectorChain({ regions: this.localMulti('map', regionSources), online: online?.sourceSpec, world: worldSource, bathymap }),
            style: mapContext.mapDecoder.id,
            layerBlendingSpeed: isEInk ? 0 : 3,
            labelBlendingSpeed: isEInk ? 0 : 3,
            labelRenderOrder: 1, // VECTOR_TILE_RENDER_ORDER_LAST
            opacity,
            preloading: get(preloading),
            clickRadius: layerProps['clickRadius'],
            tileCacheCapacity: 30 * 1024 * 1024,
            clickHandlerLayerFilter: clickFilterFor(get(clickHandlerLayerFilter)),
            tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_VISIBLE',
            visible: opacity !== 0
        };
        const layer = mapContext.getMap().buildLayer(`layer.local.${this.localGeneration}`, spec);
        layer.onFeatureClick((e) => {
            e.consumed = mapContext.vectorTileClicked(mapContext.featureClickData(e));
        });
        const item: SourceItem = {
            layer,
            spec,
            name: LOCAL_MAP_NAME,
            opacity,
            options: {
                zoomLevelBias: {
                    min: 0,
                    max: 5
                }
            },
            legend: 'https://www.openstreetmap.org/key.html',
            local: true,
            provider: { name: LOCAL_MAP_NAME, attribution: online && getProviderAttribution(online.provider) }
        };
        return { item, layer };
    }

    private async buildLocalTerrainItem({ regions, world }: LocalInventory): Promise<SourceItem> {
        const regionSources = regions.flatMap((region) => archivesWithRole(region.archives, 'terrain').map(archiveSpec));
        const worldSource = orderedSpec(archivesWithRole(world, 'terrain').map(archiveSpec));
        if (!regionSources.length && !worldSource) {
            return null;
        }
        const online = get(localTerrainOnlineFallback) ? await this.onlineFallback('mapterhorn') : null;
        const source = fallbackChain({ regions: this.localMulti('terrain', regionSources), online: online?.sourceSpec, world: worldSource });
        // no addLayer: updateTerrain stacks it or weaves it into `#hillshade`
        const layer = this.createHillshadeLayer(`layer.hillshade.local.${this.localGeneration}`, LOCAL_TERRAIN_NAME, source);
        return {
            name: LOCAL_TERRAIN_NAME,
            opacity: ApplicationSettings.getNumber(`${LOCAL_TERRAIN_NAME}_opacity`, 1),
            layer,
            terrainLayer: layer,
            options: HILLSHADE_OPTIONS,
            local: true,
            terrain: true,
            provider: { name: LOCAL_TERRAIN_NAME, attribution: online && getProviderAttribution(online.provider) }
        };
    }

    currentlyDownloadind: { source: DownloadableSource; provider: Provider };

    private clearDownloadingRow(provider: Provider) {
        const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
        if (itemIndex >= 0) {
            const item = this.customSources.getItem(itemIndex);
            delete item.downloading;
            delete item.downloadProgress;
            this.customSources.setItem(itemIndex, item);
        }
    }

    async stopDownloads() {
        if (this.currentlyDownloadind) {
            const { provider, source } = this.currentlyDownloadind;
            source.call('stopAllDownloads');
            source.off('download.started');
            source.off('download.progress');
            source.off('download.completed');
            this.notify({ eventName: 'datasource_download_progress', object: this, data: 0 });
            this.clearDownloadingRow(provider);
            this.currentlyDownloadind = null;
        }
    }

    async downloadDataSource({ maxZoom, minZoom, provider, source }: { source: DownloadableSource; provider: Provider; minZoom?: number; maxZoom?: number }) {
        try {
            if (this.currentlyDownloadind || !source) {
                return;
            }
            await new Promise<void>((resolve, reject) => {
                try {
                    this.currentlyDownloadind = { source, provider };
                    const zoom = maxZoom ?? provider.sourceOptions.maxZoom - 1;
                    const camera = mapContext.getMap().camera();
                    const bounds = camera.bounds();

                    source.on('download.started', (e) => {
                        DEV_LOG && console.log('onDownloadStarting', e.tileCount);
                        const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
                        if (itemIndex >= 0) {
                            const item = this.customSources.getItem(itemIndex);
                            item.downloading = true;
                            item.downloadProgress = 0;
                            this.customSources.setItem(itemIndex, item);
                        }
                        this.notify({ eventName: 'datasource_dowload_started', object: this, data: { provider, source } });
                    });
                    // throttled: the SDK reports per tile, and the list only has to keep up with the eye
                    source.subscribe(
                        'download.progress',
                        (e) => {
                            const progress = e.progress;
                            this.notify({ eventName: 'datasource_download_progress', object: this, data: progress });
                            const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
                            if (itemIndex >= 0) {
                                const item = this.customSources.getItem(itemIndex);
                                item.downloadProgress = progress;
                                this.customSources.setItem(itemIndex, item);
                            }
                        },
                        { throttle: 100 }
                    );
                    source.on('download.completed', () => {
                        DEV_LOG && console.log('onDownloadCompleted');
                        this.currentlyDownloadind = null;
                        this.clearDownloadingRow(provider);
                        this.notify({ eventName: 'datasource_download_progress', object: this, data: 0 });
                        this.notify({ eventName: 'datasource_dowload_finished', object: this, data: { provider, source } });
                        resolve();
                    });

                    DEV_LOG && console.log('startDownloadArea', provider, bounds, minZoom, maxZoom, camera.zoom(), zoom);
                    source.call('startDownloadArea', bounds, Math.round(minZoom ?? camera.zoom()), zoom, 0);
                } catch (error) {
                    reject(error);
                }
            });
        } catch (err) {
            showError(err);
        }
    }

    onMapDestroyed() {
        super.onMapDestroyed();
        this.localDataUnsubscribers.forEach((unsubscribe) => unsubscribe());
        this.localDataUnsubscribers = [];
        // released with the map
        this.localObjects = [];
        this.customSources.splice(0, this.customSources.length);
    }

    async addSource() {
        await this.getSourcesLibrary();
        const OptionSelect = (await import('~/components/common/OptionSelect.svelte')).default;
        const results = await showBottomSheet({
            parent: null,
            view: OptionSelect,
            skipCollapsedState: true,
            props: {
                height: 460,
                title: lc('pick_source'),
                titleIcon: 'mdi-layers-plus',
                showFilter: true,
                rowHeight: 64,
                options: Object.keys(this.baseProviders)
                    .sort()
                    .map((s) => {
                        const p = this.baseProviders[s];
                        const data = this.getTestImageAndHeaders(p);
                        return { type: 'image', title: s, isPick: false, data: this.baseProviders[s], image: data?.url, imageHeaders: data?.headers };
                    })
            }
        });
        const result = Array.isArray(results) ? results[0] : results;
        if (result) {
            const provider = result.data as Provider;
            const name = provider.id || result.name;

            const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
            const layerIndex = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);
            if (layerIndex !== -1) {
                throw new SilentError({ message: lc('data_source_already_added', name), showAsSnack: true });
            }
            // if (result.isPick) {
            //     provider.name = File.fromPath(provider.url).name;
            //     provider.id = provider.url;
            //     provider.type = 'orux';
            // }
            const data = await this.createDataSourceAndMapLayer(provider.id || result.name, provider);
            if (data) {
                this.addDataSource(data);
            }
        }
    }

    getSourceItemId(item: SourceItem) {
        return item.id || item.name;
    }

    getAllAtributions() {
        return this.customSources.map((d) => getProviderAttribution(d.provider)).filter((a) => !!a);
    }
    updateAttribution(item: SourceItem, removed: boolean = false) {
        if (getProviderAttribution(item.provider)) {
            if (removed && this.needsAttribution) {
                this.needsAttribution = this.customSources.some((d, i) => !!getProviderAttribution(d.provider));
                this.notify({
                    eventName: 'attribution',
                    needsAttribution: this.needsAttribution
                });
            } else if (!removed && !this.needsAttribution) {
                this.needsAttribution = true;
                this.notify({
                    eventName: 'attribution',
                    needsAttribution: this.needsAttribution
                });
            }
        }
    }
    async deleteSource(item: SourceItem) {
        const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
        if (this.customSources.length === 0 && savedSources.length === 1) {
            showSnack({ message: lc('cant_delete_last_layer') });
            return;
        }
        let index = -1;
        const name = this.getSourceItemId(item);
        this.customSources.some((d, i) => {
            if (d.id === name || d.name === name) {
                index = i;
                return true;
            }
            return false;
        });
        DEV_LOG && console.log('deleteSource', name, index);
        if (index !== -1) {
            const removed = this.customSources.getItem(index);
            // by stack membership: the woven DEM's `layer` is the composite's child, never in the stack
            const layer = removed.terrainLayer ?? removed.layer;
            if (mapContext.getLayerIndex(layer) !== -1) {
                mapContext.removeLayer(layer, 'customLayers');
            }
            this.customSources.splice(index, 1);
            this.updateTerrain();
            this.updateAttribution(item, true);
        }
        index = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);
        ApplicationSettings.remove(name + '_opacity');
        if (index !== -1) {
            savedSources.splice(index, 1);
            ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
            if (this.customSources.length === 0 && savedSources.length === 0) {
                const sources = this.defaultOnlineSources;
                for (let i = 0; i < sources.length; i++) {
                    const provider = this.baseProviders[sources[i]];
                    const data = await this.createDataSourceAndMapLayer(provider.id, provider);
                    this.addDataSource(data);
                }
            }
        }
    }
    moveSource(item: SourceItem, newIndex: number) {
        let index = -1;
        const name = this.getSourceItemId(item);

        this.customSources.some((d, i) => {
            if (d.id === name || d.name === name) {
                index = i;
                return true;
            }
            return false;
        });
        const layerIndex = mapContext.getLayerTypeFirstIndex('customLayers');
        DEV_LOG && console.log('moveSource', name, index, layerIndex, newIndex);
        if (index !== -1) {
            const moved = this.customSources.getItem(index);
            // the woven DEM is not in the stack: updateTerrain turns its new rank into a slot change
            const layer = moved.terrainLayer ?? moved.layer;
            if (mapContext.getLayerIndex(layer) !== -1) {
                // DEV_LOG && console.log('moveLayer', name, index, layerIndex, newIndex, newIndex + layerIndex);
                mapContext.moveLayer(layer, newIndex + (layerIndex >= 0 ? layerIndex : 0));
            }
            // reordering can change which base map is on top, and which DEM is - the slots follow
            this.updateTerrain();
        }
        const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
        index = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);
        if (index !== -1) {
            savedSources.splice(index, 1);
            if (item.provider.type) {
                savedSources.splice(newIndex, 0, item.provider);
            } else {
                savedSources.splice(newIndex, 0, name);
            }
            ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
        }
    }
}
