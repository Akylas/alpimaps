import * as api from '@nativescript-community/ui-massifmaps/api';
import type { MassifLayer, MassifMap, MassifSource, SpecArg } from '@nativescript-community/ui-massifmaps/api';
import { openFilePicker, pickFolder } from '@nativescript-community/ui-document-picker';
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
import { fromPosition } from '~/utils/geo';
import { packageService } from '~/services/PackageService';
import { clickHandlerLayerFilter, layerProps, preloading } from '~/stores/mapStore';
import { showError } from '@shared/utils/showError';
import { toDegrees, toRadians } from '~/utils/geo';
import { getDataFolder, getDefaultMBTilesDir, getFileNameThatICanUseInNativeCode, listFolder } from '~/utils/utils';

import { SDK_VERSION } from '@akylas/nativescript/utils';
import { createView, showSnack } from '~/utils/ui';
import { data as TileSourcesData } from '~/data/tilesources';
import { openLink } from '~/utils/ui';
import { Label } from '@nativescript-community/ui-label';
import { colors } from '~/variables';
import { SilentError } from '@akylas/nativescript-app-utils/error';
const mapContext = getMapContext();

export enum RoutesType {
    All = 0,
    Bicycle = 1,
    Hiking = 2
}

/** One mbtiles file, as a source spec. Specs compose, so a merge or an order is just nesting. */
let localSourceId = 0;

/** Only a persistent cache can download an area, and only it declares the download events. */
export type DownloadableSource = MassifSource<'massif::PersistentCacheTileDataSource'>;

const mbTilesSourceSpec = (path: string, minZoom?: number) => ({ type: 'mbtiles' as const, path, ...(minZoom !== undefined ? { minZoom } : {}) });

let DEFAULT_HILLSHADE_SHADER;
function getDefaultShader() {
    if (!DEFAULT_HILLSHADE_SHADER) {
        DEFAULT_HILLSHADE_SHADER = `uniform vec4 u_shadowColor;
uniform vec4 u_highlightColor;
uniform vec4 u_accentColor;
uniform vec3 u_lightDir;
vec4 applyLighting(lowp vec4 color, mediump vec3 normal, mediump vec3 surfaceNormal, mediump float intensity) {
    mediump float lighting = max(0.0, dot(normal, u_lightDir));
    mediump float accent = normal.z;
    lowp vec4 accent_color = (1.0 - accent) * u_accentColor * intensity;
    mediump float alpha = clamp(u_shadowColor.a*(1.0-lighting)+u_highlightColor.a*lighting, 0.0, 1.0);
    lowp vec4 shade_color = vec4(mix(u_shadowColor.rgb, u_highlightColor.rgb, lighting), alpha);
    return (accent_color * (1.0 - shade_color.a) + shade_color) * color * intensity;
}`;
    }
    return DEFAULT_HILLSHADE_SHADER;
}

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
    return str.replace(
        /{(\w*)}/g, // or /{(\w*)}/g for "{this} instead of %this%"
        function (m, key) {
            return data.hasOwnProperty(key) ? data[key] : m;
        }
    );
}

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
/**
 * What the currently loaded offline data supports. Flips asynchronously while mbtiles are scanned, so
 * anything gating UI on it (the slopes and routes buttons, the contour/buildings options) must react
 * to the store rather than read a snapshot.
 */
export const mapCapabilities = writable({ hasLocalData: false, hasTerrain: false, hasRoute: false });

export interface SourceItem {
    downloading?: boolean;
    downloadProgress?: number;
    opacity: number;
    legend?: string;
    name: string;
    id?: string;
    local?: boolean;
    layer: MassifLayer;
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
    /**
     * Several mbtiles as ONE source, merged pairwise.
     *
     * Specs all the way down: a source is JSON until it is built, so composing them is nesting
     * rather than constructing objects and holding handles. `merged-mbvt` merges two vector-tile
     * sources tile by tile, which is how a region and its routes become one map.
     */
    createMergeDataSource(sources: any[], minZoom?: number) {
        const specs = sources.map((s) => (typeof s === 'string' ? mbTilesSourceSpec(s, minZoom) : s));
        if (specs.length === 1) {
            return specs[0];
        }
        let result;
        for (let index = 0; index < specs.length; index += 2) {
            const merged = index < specs.length - 1 ? { type: 'merged-mbvt' as const, source: specs[index], source2: specs[index + 1] } : specs[index];
            result = result ? { type: 'merged-mbvt' as const, source: result, source2: merged } : merged;
        }
        return result;
    }

    /** The first source that has a tile wins, so a detailed region shadows the world map. */
    createOrderedTileDataSource(sources: any[], minZoom?: number) {
        const specs = sources.filter((s) => !!s).map((s) => (typeof s === 'string' ? mbTilesSourceSpec(s, minZoom) : s));
        if (specs.length === 0) {
            return null;
        }
        if (specs.length === 1) {
            return specs[0];
        }
        return specs.reduce((first, second) => ({ type: 'ordered' as const, source: first, source2: second }));
    }

    /**
     * The hillshade layer, with every knob the settings panel exposes.
     *
     * The elevation decoder is not named here: it comes from the source's own `encoding`, which is
     * what the terrarium/mapbox choice already sets.
     */
    createHillshadeTileLayer(id: string, name: string, sourceSpec: any, options: { [key: string]: any } = {}) {
        const contrast = ApplicationSettings.getNumber(`${name}_contrast`, 0.5);
        const heightScale = ApplicationSettings.getNumber(`${name}_heightScale`, 1.0);
        const illuminationDirection = ApplicationSettings.getNumber(`${name}_illuminationDirection`, 143);
        const opacity = ApplicationSettings.getNumber(`${name}_opacity`, 1);
        const tileFilterModeStr = ApplicationSettings.getString(`${name}_tileFilterMode`, 'bilinear');

        const accentColor = new Color(ApplicationSettings.getString(`${name}_accentColor`, '#000000'));
        const shadowColor = new Color(ApplicationSettings.getString(`${name}_shadowColor`, '#00000000'));
        const highlightColor = new Color(ApplicationSettings.getString(`${name}_highlightColor`, '#000000'));
        const minVisibleZoom = ApplicationSettings.getNumber(`${name}_minVisibleZoom`, 0);
        const maxVisibleZoom = ApplicationSettings.getNumber(`${name}_maxVisibleZoom`, 18);

        const tileFilterMode =
            tileFilterModeStr === 'bicubic' ? 'RASTER_TILE_FILTER_MODE_BICUBIC' : tileFilterModeStr === 'nearest' ? 'RASTER_TILE_FILTER_MODE_NEAREST' : 'RASTER_TILE_FILTER_MODE_BILINEAR';

        return mapContext.getMap().buildLayer(id, {
            type: 'hillshade',
            source: sourceSpec,
            tileFilterMode,
            visibleZoomRange: [minVisibleZoom, maxVisibleZoom],
            contrast,
            // tileBlendingSpeed: isEInk ? 0 : 3,
            normalMapLightingShader: getDefaultShader(),
            tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_VISIBLE',
            illuminationDirection: [Math.sin(toRadians(illuminationDirection)), Math.cos(toRadians(illuminationDirection)), 0],
            highlightColor: highlightColor.argb,
            shadowColor: shadowColor.argb,
            accentColor: accentColor.argb,
            heightScale,
            opacity,
            visible: opacity !== 0,
            ...options
        } as never);
    }
    toggleHillshadeSlope(value: boolean) {
        const layer = this.hillshadeLayer;
        if (layer && layer.get('exagerateHeightScaleEnabled') !== !value) {
            layer.apply({
                exagerateHeightScaleEnabled: !value,
                normalMapLightingShader: value ? getSlopeHillshadeShader() : getDefaultShader()
            });
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
        // `httpHeaders` is spelled HTTPHeaders on the SDK's own property, which is what a spec key
        // has to be: the facade resolves against the declared name, not the plugin's old option.
        const { httpHeaders, subdomains, ...sourceOptions } = (provider.sourceOptions ?? {}) as any;
        const httpSpec = {
            type: 'http' as const,
            url,
            ...sourceOptions,
            ...(httpHeaders ? { HTTPHeaders: httpHeaders } : {}),
            // the tables spell a subdomain set as 'abcd'; the SDK's property is a list
            ...(subdomains ? { subdomains: typeof subdomains === 'string' ? subdomains.split('') : subdomains } : {})
        };
        const downloadable = provider.downloadable || !PRODUCTION || this.devMode;
        const cacheable = provider.cacheable || !PRODUCTION;
        const cacheSize = ApplicationSettings.getNumber(`${id}_cacheSize`, 300);
        return {
            sourceSpec:
                cacheable !== false || downloadable
                    ? {
                          type: 'persistent-cache' as const,
                          source: httpSpec,
                          databasePath,
                          cacheOnlyMode: ApplicationSettings.getBoolean(`${id}_cacheOnlyMode`, false),
                          capacity: cacheSize * 1024 * 1024,
                          // the cache serves the tiles, so it has to declare what they encode
                          ...(sourceOptions.encoding ? { encoding: sourceOptions.encoding } : {})
                      }
                    : httpSpec,
            vectorDataSource
        };
    }
    async createDataSourceAndMapLayer(id: string, provider: Provider) {
        const opacity = ApplicationSettings.getNumber(`${id}_opacity`, 1);

        // Apply zoom level bias to the raster layer.
        // By default, bitmaps are upsampled on high-DPI screens.
        // We will correct this by applying appropriate bias
        const zoomLevelBias = ApplicationSettings.getNumber(`${id}_zoomLevelBias`, (Math.log(mapContext.getMap().get('DPI') / 160.0) / Math.log(2)) * 0.75);
        const options = {
            zoomLevelBias: {
                min: 0,
                max: 5
            }
        };

        const { sourceSpec, vectorDataSource } = await this.createDataSource(id, provider);
        const map = mapContext.getMap();
        const layerId = `layer.custom.${id}`;

        let layer: MassifLayer;
        let spec: any;
        if (provider.hillshade) {
            Object.assign(options, HILLSHADE_OPTIONS);
            layer = this.createHillshadeTileLayer(layerId, id, sourceSpec, {
                zoomLevelBias,
                opacity,
                tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_ALL',
                visible: opacity !== 0,
                ...(provider.layerOptions as any)
            });
            if (!this.hillshadeLayer) {
                this.hillshadeLayer = packageService.hillshadeLayer = layer as never;
                this.hasTerrain = true;
            }
        } else if (vectorDataSource) {
            // Kept, not inlined: `vectorTileDecoderChanged` rebuilds the layer from this on a style
            // change, and an item without it is silently skipped - which is what made switching
            // style do nothing for every provider-backed base map.
            spec = {
                type: 'vector',
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
                clickHandlerLayerFilter: get(clickHandlerLayerFilter),
                ...provider.layerOptions
            };
            layer = map.buildLayer(layerId, spec as never);
            layer.onFeatureClick((e) => {
                e.consumed = mapContext.vectorTileClicked(mapContext.featureClickData(e as never));
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
            layer = map.buildLayer(layerId, spec as never);
        }

        // console.log('createRasterLayer', id, opacity, provider.url, provider.sourceOptions, dataSource, dataSource.maxZoom, dataSource.minZoom);
        return {
            name: id,
            id,
            legend: provider.legend,
            opacity,
            options,
            layer,
            spec,
            provider
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

        // overwrite values in provider from variant.
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
        // replace attribution placeholders with their values from toplevel provider attribution,
        // recursively
        const attributionReplacer = function (attr) {
            if (!attr || attr.indexOf('{attribution.') === -1) {
                return attr;
            }
            return attr.replace(/\{attribution.(\w*)\}/, function (match, attributionName) {
                return attributionReplacer(getProviderAttribution(providers[attributionName]));
            });
        };
        provider.attribution = attributionReplacer(getProviderAttribution(provider));
        // Compute final options combining provider options with any user overrides
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

    /** The SOURCE SPEC of a provider, for anything that wants to compose with it. */
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
        (async () => {
            try {
                if (!this.listenForSourceChanges) {
                    if (!__DISABLE_OFFLINE__ && (!__ANDROID__ || !PLAY_STORE_BUILD || SDK_VERSION < 11)) {
                        const folderPath = await getDefaultMBTilesDir();
                        if (folderPath && Folder.exists(folderPath)) {
                            await this.loadLocalMbtiles(folderPath);
                        }
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
                                    mapContext.addLayer(data.layer, 'customLayers');
                                    this.updateAttribution(data);
                                }
                            } catch (err) {
                                console.error('createRasterLayer', err);
                            }
                        }
                    }
                    this.listenForSourceChanges = true;
                }

                this.notify({ eventName: 'ready' });
            } catch (err) {
                showError(err);
            }
        })();
    }
    updateClickHandlerLayerFilter() {
        this.updateVectorTileLayerProperty('clickHandlerLayerFilter', get(clickHandlerLayerFilter));
    }
    /**
     * Writes one property on every vector tile layer.
     *
     * `trySet` rather than `set`: the stack holds raster and hillshade layers too, and a property
     * they do not have is not an error here - it is simply not theirs.
     */
    updateVectorTileLayerProperty(key: string, value) {
        mapContext.getLayers().forEach((data) => data.layer?.trySet(key as never, value as never));
    }
    /**
     * The decoder was rebuilt, so every layer holding the old one has to be rebuilt too.
     *
     * `tileDecoder` is read-only on the SDK's layer - a decoder is what a layer's tiles were
     * DECODED with, not a setting - so the layer is created again from the spec it was built from,
     * with the new decoder's id.
     */
    vectorTileDecoderChanged(oldDecoder: MapDecoder, newDecoder: MapDecoder) {
        const generation = ++this.decoderGeneration;
        this.customSources.forEach((item) => {
            if (!item.spec || item.spec.type !== 'vector') {
                return;
            }
            const oldLayer = item.layer;
            // The SOURCE is handed over, not rebuilt from its spec: a provider's spec describes a
            // persistent cache, and building it again opens a SECOND cache on the same file.
            const source = oldLayer.source();
            item.spec = { ...item.spec, ...(source ? { source: source.handle } : {}), style: newDecoder.id };
            // A fresh id per generation, from the layer's own base: appending to the previous id
            // grew a segment on every style switch and kept each one registered.
            const baseId = String(oldLayer.id).replace(/#\d+$/, '');
            const layer = mapContext.getMap().buildLayer(`${baseId}#${generation}`, item.spec);
            layer.onFeatureClick((e) => {
                e.consumed = mapContext.vectorTileClicked(mapContext.featureClickData(e as never));
            });
            mapContext.replaceLayer(oldLayer, layer);
            oldLayer.destroy();
            item.layer = layer;
        });
    }
    private decoderGeneration = 0;
    hillshadeLayer: MassifLayer<'massif::HillshadeRasterTileLayer'>;
    needsAttribution = false;
    addDataSource(item: SourceItem, save = true) {
        const name = this.getSourceItemId(item);
        const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
        const layerIndex = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);

        if (layerIndex === -1) {
            this.customSources.push(item);
            mapContext.addLayer(item.layer, 'customLayers');
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
            mapContext.insertLayer(item.layer, 'customLayers', layerIndex);
        }
        this.updateAttribution(item);
    }
    /**
     * Backed by a store so anything showing a control for these re-renders when offline data finishes
     * loading. They flip asynchronously, long after the map mounts, and as plain fields they were
     * invisible to svelte — the map had to poke its button list by hand to notice.
     */
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
    async loadLocalMbtiles(directory: string) {
        try {
            const context: android.app.Activity = __ANDROID__ && Application.android.startActivity;
            const entities = listFolder(directory);

            const terrains = [];
            const mbtiles = [];
            let worldMbtilesEntity = entities.find((e) => e.name === 'world.mbtiles');
            const worldRouteMbtilesEntity = entities.find((e) => e.name.endsWith('routes_9.mbtiles') || e.name.endsWith('routes.mbtiles'));
            let worldTerrainMbtilesEntity = entities.find((e) => e.name.endsWith('.etiles'));

            const folders = entities.filter((e) => e.isFolder).sort((a, b) => b.name.localeCompare(a.name));
            // DEV_LOG && console.log('loadLocalMbtiles', JSON.stringify(folders));
            for (let i = 0; i < folders.length; i++) {
                const f = folders[i];
                const subentities = listFolder(f.path);
                if (subentities?.length > 0) {
                    const sources = subentities.filter((s) => s.path.endsWith('.mbtiles'));
                    const routesSourceIndex = sources.findIndex((s) => s.path.endsWith('routes.mbtiles'));
                    this.hasRoute = this.hasRoute || routesSourceIndex >= 0;

                    DEV_LOG &&
                        console.log(
                            'sources',
                            sources.map((s) => s.path)
                        );
                    if (sources.length) {
                        mbtiles.push(
                            this.createMergeDataSource(
                                sources.map((s) => getFileNameThatICanUseInNativeCode(context, s.path)),
                                worldMbtilesEntity ? 5 : undefined
                            )
                        );
                    }

                    const terrain = subentities.find((e) => e.name.endsWith('.etiles'));
                    if (terrain) {
                        terrains.push(mbTilesSourceSpec(getFileNameThatICanUseInNativeCode(context, terrain.path)));
                    }
                }
            }

            if (worldMbtilesEntity && mbtiles.length === 0) {
                mbtiles.push(this.createMergeDataSource([worldMbtilesEntity, worldRouteMbtilesEntity].filter((s) => !!s).map((s) => getFileNameThatICanUseInNativeCode(context, s.path))));
                this.hasRoute = this.hasRoute || !!worldRouteMbtilesEntity;
                worldMbtilesEntity = null;
            }

            if (worldTerrainMbtilesEntity && terrains.length === 0) {
                terrains.push(mbTilesSourceSpec(getFileNameThatICanUseInNativeCode(context, worldTerrainMbtilesEntity.path)));
                worldTerrainMbtilesEntity = null;
            }

            if (mbtiles.length) {
                this.hasLocalData = true;
                const name = 'Local';
                const map = mapContext.getMap();
                // `multi` picks the right package per tile, so a region and its neighbours read as
                // one map. It is filled after construction: the packages are found by scanning.
                const multi = map.source('source.local.multi', { type: 'multi' });
                mbtiles.forEach((spec) => multi.call('add', map.source(`source.local.${++localSourceId}`, spec).handle, ''));
                let sourceSpec: any = multi.handle;
                if (worldMbtilesEntity) {
                    const worldSpec = this.createMergeDataSource([worldMbtilesEntity, worldRouteMbtilesEntity].filter((s) => !!s).map((s) => getFileNameThatICanUseInNativeCode(context, s.path)));
                    // the detailed packages first, the world map behind them
                    sourceSpec = this.createOrderedTileDataSource([worldSpec, multi.handle]);
                }
                const opacity = ApplicationSettings.getNumber(name + '_opacity', 1);
                // SpecArg<'layer', 'vector'> is what gives the literal its typings: every key is
                // checked, enums complete to their constant names, and an unknown one is an error.
                const spec: SpecArg<'layer', 'vector'> = {
                    type: 'vector',
                    source: sourceSpec,
                    style: mapContext.mapDecoder.id,

                    layerBlendingSpeed: isEInk ? 0 : 3,
                    labelBlendingSpeed: isEInk ? 0 : 3,
                    labelRenderOrder: 1, // VECTOR_TILE_RENDER_ORDER_LAST
                    opacity,
                    preloading: get(preloading),
                    clickRadius: layerProps['clickRadius'],
                    tileCacheCapacity: 30 * 1024 * 1024,
                    clickHandlerLayerFilter: get(clickHandlerLayerFilter),
                    tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_VISIBLE',
                    visible: opacity !== 0
                };
                const layer = map.buildLayer('layer.local', spec);
                layer.onFeatureClick((e) => {
                    e.consumed = mapContext.vectorTileClicked(mapContext.featureClickData(e as never));
                });
                if (!packageService.localVectorTileLayer) {
                    packageService.localVectorTileLayer = layer as never;
                }
                this.customSources.push({
                    layer,
                    spec,
                    name,
                    opacity,
                    options: {
                        zoomLevelBias: {
                            min: 0,
                            max: 5
                        }
                    },
                    legend: 'https://www.openstreetmap.org/key.html',
                    local: true,
                    provider: { name }
                });
                mapContext.addLayer(layer, 'map');
            }
            if (terrains.length) {
                const name = 'Hillshade';
                const opacity = ApplicationSettings.getNumber(`${name}_opacity`, 1);
                const map = mapContext.getMap();
                const multi = map.source('source.terrain.multi', { type: 'multi' });
                terrains.forEach((spec) => multi.call('add', map.source(`source.terrain.${++localSourceId}`, spec).handle, ''));
                let sourceSpec: any = multi.handle;
                if (worldTerrainMbtilesEntity) {
                    sourceSpec = this.createOrderedTileDataSource([multi.handle, mbTilesSourceSpec(getFileNameThatICanUseInNativeCode(context, worldTerrainMbtilesEntity.path))]);
                }

                const layer = (this.hillshadeLayer = packageService.hillshadeLayer = this.createHillshadeTileLayer('layer.hillshade.local', name, sourceSpec) as never);
                const data = {
                    name,
                    opacity,
                    layer,
                    local: true,
                    options: HILLSHADE_OPTIONS,
                    provider: { name }
                };
                this.customSources.push(data);
                mapContext.addLayer(layer, 'map');
            }
        } catch (err) {
            console.error('loadLocalMbtiles', err);
            showError(err);
            // throw err;
        }
    }
    currentlyDownloadind: { source: DownloadableSource; provider: Provider };

    /** Marks a provider's row as no longer downloading, wherever it is in the list. */
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

    /**
     * Downloads what is on screen into a provider's persistent cache.
     *
     * The SDK reports progress through events on the source now (`download.started`,
     * `download.progress`, `download.completed`), so there is no listener object to build - which
     * is what made an offline download unreachable from a string API at all.
     */
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
                    source.call('startDownloadArea', bounds as never, Math.round(minZoom ?? camera.zoom()), zoom, 0);
                } catch (error) {
                    reject(error);
                }
            });
        } catch (err) {
            showError(err);
        }
    }

    selectLocalMbtilesFolder() {
        return pickFolder({
            multipleSelection: false
        })
            .then((result) => {
                if (Folder.exists(result.folders[0])) {
                    const localMbtilesSource = result.folders[0];
                    ApplicationSettings.setString('local_mbtiles_directory', localMbtilesSource);
                    this.loadLocalMbtiles(localMbtilesSource);
                } else {
                    return Promise.reject(new Error(l('no_folder_selected')));
                }
            })
            .catch((err) => {
                console.error('selectLocalMbtilesFolder', err);
                setTimeout(() => {
                    throw err;
                }, 0);
            });
    }

    onMapDestroyed() {
        super.onMapDestroyed();
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
                height: 400,
                title: l('pick_source'),
                showFilter: true,
                rowHeight: 56,
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
            mapContext.removeLayer(this.customSources.getItem(index).layer, 'customLayers');
            this.customSources.splice(index, 1);
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
            const item = this.customSources.getItem(index);
            const layer = item.layer;
            // DEV_LOG && console.log('moveLayer', name, index, layerIndex, newIndex, newIndex + layerIndex);
            mapContext.moveLayer(layer, newIndex + (layerIndex >= 0 ? layerIndex : 0));
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
