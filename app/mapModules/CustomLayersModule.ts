import { MapBounds, toNativeScreenBounds } from '@nativescript-community/ui-carto/core';
import { MergedMBVTTileDataSource, MultiTileDataSource, OrderedTileDataSource, TileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
import { HTTPTileDataSource } from '@nativescript-community/ui-carto/datasources/http';
import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
import { TileLayer, TileSubstitutionPolicy } from '@nativescript-community/ui-carto/layers';
import { HillshadeRasterTileLayer, HillshadeRasterTileLayerOptions, RasterTileFilterMode, RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
import { VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { MapBoxElevationDataDecoder, TerrariumElevationDataDecoder } from '@nativescript-community/ui-carto/rastertiles';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { openFilePicker, pickFolder } from '@nativescript-community/ui-document-picker';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { confirm, login, prompt } from '@nativescript-community/ui-material-dialogs';
import { Application, ApplicationSettings, Color, profile } from '@nativescript/core';
import { ChangeType, ChangedData, ObservableArray } from '@nativescript/core/data/observable-array';
import { File, Folder, path } from '@nativescript/core/file-system';
import { get } from 'svelte/store';
import type { Provider } from '~/data/tilesources';
import { l, lc } from '~/helpers/locale';
import MapModule, { getMapContext } from '~/mapModules/MapModule';
import { packageService } from '~/services/PackageService';
import { preloading, showRoutes } from '~/stores/mapStore';
import { showError } from '@shared/utils/showError';
import { toDegrees, toRadians } from '~/utils/geo';
import { getDataFolder, getDefaultMBTilesDir, getFileNameThatICanUseInNativeCode, listFolder } from '~/utils/utils';

import { SDK_VERSION } from '@akylas/nativescript/utils';
import { createView, showSnack } from '~/utils/ui';
import { data as TileSourcesData } from '~/data/tilesources';
import { openLink } from '~/utils/ui';
import { Label } from '@nativescript-community/ui-label';
import { colors } from '~/variables';
const mapContext = getMapContext();

export enum RoutesType {
    All = 0,
    Bicycle = 1,
    Hiking = 2
}

const mbTilesSourceGenerator = (s, minZoom) =>
    new MBTilesTileDataSource({
        minZoom,
        databasePath: s
    });

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
export interface SourceItem {
    downloading?: boolean;
    downloadProgress?: number;
    opacity: number;
    legend?: string;
    name: string;
    id?: string;
    local?: boolean;
    layer: TileLayer<any, any>;
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
    createMergeDataSource(sources: (string | TileDataSource<any, any>)[], dataSourceGenerator: (s: string, minZoom?: number) => TileDataSource<any, any>, minZoom?: number) {
        if (sources.length === 1) {
            if (sources[0] instanceof TileDataSource) {
                return sources[0];
            }
            return dataSourceGenerator(sources[0], minZoom);
        } else {
            const dataSources = sources.map((s) => (s instanceof TileDataSource ? s : dataSourceGenerator(s, minZoom)));
            let result, merged;
            for (let index = 0; index < dataSources.length; index += 2) {
                if (index < dataSources.length - 1) {
                    merged = new MergedMBVTTileDataSource({
                        dataSources: [dataSources[index], dataSources[index + 1]]
                    });
                } else {
                    merged = dataSources[index];
                }
                if (result) {
                    result = new MergedMBVTTileDataSource({
                        dataSources: [result, merged]
                    });
                } else {
                    result = merged;
                }
            }
            return result;
        }
    }

    createOrderedMBTilesDataSource(sources: string[]) {
        if (sources.length === 0) {
            return null;
        }
        if (sources.length === 1) {
            return new MBTilesTileDataSource({
                databasePath: sources[0]
            });
        } else {
            const dataSources = sources
                .map(
                    (s) =>
                        new MBTilesTileDataSource({
                            databasePath: s
                        })
                )
                .reverse();

            return new OrderedTileDataSource({
                dataSources
            });
        }
    }
    updateRouteLayer(oldRouteLayer) {
        const newRouteLayer = this.createRouteLayer(oldRouteLayer.dataSource);
        mapContext.replaceLayer(oldRouteLayer, newRouteLayer);
    }
    createRouteLayer(dataSource: TileDataSource<any, any>) {
        const routeLayer = new VectorTileLayer({
            dataSource,
            // maxUnderzoomLevel: 0,
            // maxOverzoomLevel: 0,
            visibleZoomRange: [4, 24],
            layerBlendingSpeed: 0,
            // preloading: get(preloading),
            visible: get(showRoutes),
            clickRadius: ApplicationSettings.getNumber('route_click_radius', 16),
            tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
            labelRenderOrder: VectorTileRenderOrder.LAST,
            decoder: mapContext.innerDecoder
        });
        mapContext.innerDecoder.once('change', () => {
            this.updateRouteLayer(routeLayer);
        });
        routeLayer.setVectorTileEventListener<LatLonKeys>(
            {
                onVectorTileClicked: (e) => mapContext.vectorTileClicked(e)
            },
            mapContext.getProjection()
        );
        return routeLayer;
    }

    createHillshadeTileLayer(name, dataSource, options: HillshadeRasterTileLayerOptions = {}, terrarium = false) {
        const contrast = ApplicationSettings.getNumber(`${name}_contrast`, 0.42);
        const heightScale = ApplicationSettings.getNumber(`${name}_heightScale`, 0.22);
        const illuminationDirection = ApplicationSettings.getNumber(`${name}_illuminationDirection`, 143);
        const opacity = ApplicationSettings.getNumber(`${name}_opacity`, 1);
        const decoder = terrarium ? new TerrariumElevationDataDecoder() : new MapBoxElevationDataDecoder();
        const tileFilterModeStr = ApplicationSettings.getString(`${name}_tileFilterMode`, 'bilinear');

        const accentColor = new Color(ApplicationSettings.getString(`${name}_accentColor`, '#000000aa'));
        const shadowColor = new Color(ApplicationSettings.getString(`${name}_shadowColor`, '#00000000'));
        const highlightColor = new Color(ApplicationSettings.getString(`${name}_highlightColor`, '#000000aa'));
        const minVisibleZoom = ApplicationSettings.getNumber(`${name}_minVisibleZoom`, 0);
        const maxVisibleZoom = ApplicationSettings.getNumber(`${name}_maxVisibleZoom`, 16);

        let tileFilterMode: RasterTileFilterMode;
        switch (tileFilterModeStr) {
            case 'bicubic':
                tileFilterMode = RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BICUBIC;
                break;
            case 'nearest':
                tileFilterMode = RasterTileFilterMode.RASTER_TILE_FILTER_MODE_NEAREST;
                break;
            default:
                tileFilterMode = RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BILINEAR;
                break;
        }
        return new HillshadeRasterTileLayer({
            decoder,
            tileFilterMode,
            visibleZoomRange: [minVisibleZoom, maxVisibleZoom],
            contrast,
            // maxSourceOverzoomLevel: 1,
            // exagerateHeightScaleEnabled: false,
            normalMapLightingShader: getDefaultShader(),
            tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
            illuminationDirection: [Math.sin(toRadians(illuminationDirection)), Math.cos(toRadians(illuminationDirection)), 0],
            highlightColor,
            shadowColor,
            accentColor,
            heightScale,
            dataSource,
            opacity,
            visible: opacity !== 0,
            ...options
        });
    }
    toggleHillshadeSlope(value: boolean) {
        if (this.hillshadeLayer && this.hillshadeLayer.exagerateHeightScaleEnabled !== !value) {
            this.hillshadeLayer.exagerateHeightScaleEnabled = !value;
            if (value) {
                this.hillshadeLayer.normalMapLightingShader = getSlopeHillshadeShader();
            } else {
                this.hillshadeLayer.normalMapLightingShader = getDefaultShader();
            }
        }
    }
    mDevMode = ApplicationSettings.getBoolean('devMode', false);

    getTokenKeys() {
        return {
            americanaosm: ApplicationSettings.getString('americanaosmToken', this.devMode ? AMERICANA_OSM_URL : undefined),
            carto: ApplicationSettings.getString('cartoToken', this.devMode ? CARTO_TOKEN : undefined),
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
    async createDataSourceAndMapLayer(id: string, provider: Provider) {
        const opacity = ApplicationSettings.getNumber(`${id}_opacity`, 1);

        // Apply zoom level bias to the raster layer.
        // By default, bitmaps are upsampled on high-DPI screens.
        // We will correct this by applying appropriate bias
        const zoomLevelBias = ApplicationSettings.getNumber(`${id}_zoomLevelBias`, (Math.log(this.mapView.getOptions().getDPI() / 160.0) / Math.log(2)) * 0.75);
        const options = {
            zoomLevelBias: {
                min: 0,
                max: 5
            }
        };

        // if (provider.type === 'orux') {
        //     dataSource = new OruxDBTileDataSource({
        //         databasePath: provider.url as string
        //     });
        //     layer = new RasterTileLayer({
        //         dataSource,
        //         zoomLevelBias,
        //         opacity,
        //         visible: opacity !== 0
        //     });
        // } else {
        const rasterCachePath = Folder.fromPath(path.join(getDataFolder(), 'rastercache'));
        const idForPath = id.replaceAll(/[\\\?\*<":>\+\[\]\s\t\n\.]+/g, '_');
        const databasePath = File.fromPath(path.join(rasterCachePath.path, idForPath)).path;
        const legend = provider.legend;
        let url = provider.url as string | string[];
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
            tokens.forEach((tok) => {
                if (!this.tokenKeys[tok]) {
                    showSnack({ message: lc('missing_api_token') });
                    return;
                }
                let toReplace = this.tokenKeys[tok];
                if (tok === 'americanaosm' && toReplace.indexOf('{x}') === -1) {
                    toReplace = toReplace + '/planet/{z}/{x}/{y}.mvt';
                }
                if (Array.isArray(url)) {
                    url = url.map((u) => u.replace(`{${tok}}`, toReplace));
                } else {
                    url = url.replace(`{${tok}}`, toReplace);
                }
            });
        }
        let dataSource: TileDataSource<any, any>;
        let vectorDataSource = false;
        if (Array.isArray(url)) {
            vectorDataSource = url[0].indexOf('.mvt') >= 0 || url[0].indexOf('.pbf') >= 0;
            const generator = (s, minZoom) =>
                new HTTPTileDataSource({
                    url: s,
                    ...provider.sourceOptions
                });
            dataSource = this.createMergeDataSource(url, generator);
        } else {
            vectorDataSource = url.indexOf('.mvt') >= 0 || url.indexOf('.pbf') >= 0;
            dataSource = new HTTPTileDataSource({
                url,
                ...provider.sourceOptions
            });
        }
        // if (provider.cacheable !== false) {
        //     Object.assign(options, {
        //         cacheSize: {
        //             min: 0,
        //             max: 2048
        //         }
        //     });
        // }
        const cacheSize = ApplicationSettings.getNumber(`${id}_cacheSize`, 300);
        let layer: TileLayer<any, any>;
        if (provider.hillshade) {
            Object.assign(options, HILLSHADE_OPTIONS);
            layer = this.createHillshadeTileLayer(
                id,
                provider.cacheable !== false
                    ? new PersistentCacheTileDataSource({
                          dataSource,
                          capacity: cacheSize * 1024 * 1024,
                          databasePath
                      })
                    : dataSource,
                {
                    zoomLevelBias,
                    // cacheSize,
                    opacity,
                    tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_ALL,
                    visible: opacity !== 0,
                    ...provider.layerOptions
                },
                provider.terrarium === true
            );
            if (!this.hillshadeLayer) {
                this.hillshadeLayer = packageService.hillshadeLayer = layer as HillshadeRasterTileLayer;
            }
        } else if (vectorDataSource) {
            layer = new VectorTileLayer({
                dataSource:
                    provider.cacheable !== false
                        ? new PersistentCacheTileDataSource({
                              dataSource,
                              cacheOnlyMode: ApplicationSettings.getBoolean(`${id}_cacheOnlyMode`, false),
                              capacity: cacheSize * 1024 * 1024,
                              databasePath
                          })
                        : dataSource,
                zoomLevelBias: ApplicationSettings.getNumber(`${id}_zoomLevelBias`, 0),
                labelRenderOrder: VectorTileRenderOrder.LAST,
                decoder: mapContext.mapDecoder,
                visible: opacity !== 0,
                layerBlendingSpeed: 3,
                labelBlendingSpeed: 3,
                opacity,
                preloading: ApplicationSettings.getBoolean(`${id}_preloading`, false),
                // tileCacheCapacity: 30 * 1024 * 1024,
                // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                ...provider.layerOptions
            });
            (layer as VectorTileLayer).setVectorTileEventListener<LatLonKeys>(
                {
                    onVectorTileClicked: mapContext.vectorTileClicked
                },
                mapContext.getProjection()
                // TODO: fix this to be optimized too on iOS
                // __ANDROID__ ? akylas.alpi.maps.VectorTileEventListener : undefined
            );
        } else {
            const downloadable = provider.downloadable || !PRODUCTION || this.devMode;
            const cacheable = provider.cacheable || !PRODUCTION;
            DEV_LOG && console.log('createDataSourceAndMapLayer', cacheable, downloadable);
            layer = new RasterTileLayer({
                dataSource:
                    cacheable !== false || downloadable
                        ? new PersistentCacheTileDataSource({
                              dataSource,
                              cacheOnlyMode: ApplicationSettings.getBoolean(`${id}_cacheOnlyMode`, false),
                              capacity: cacheSize * 1024 * 1024,
                              databasePath
                          })
                        : dataSource,
                preloading: ApplicationSettings.getBoolean(`${id}_preloading`, false),
                zoomLevelBias,
                // cacheSize,
                opacity,
                // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                visible: opacity !== 0,
                ...provider.layerOptions
            });
        }
        // }

        // console.log('createRasterLayer', id, opacity, provider.url, provider.sourceOptions, dataSource, dataSource.maxZoom, dataSource.minZoom);
        return {
            name: id,
            id,
            legend,
            opacity,
            options,
            layer,
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
                    variant
                };
            } else {
                provider.url = variant.url || provider.url;
                provider.attribution = variant.attribution || provider.attribution;
                provider.sourceOptions = { ...provider.sourceOptions, ...variant.sourceOptions };
                provider.layerOptions = { ...provider.layerOptions, ...variant.layerOptions };
                provider.urlOptions = { variant: variantName, ...provider.urlOptions, ...variant.urlOptions };
            }
        } else if (typeof provider.url === 'function') {
            provider.url = provider.url(parts.splice(1, parts.length - 1).join('.'));
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
            if (typeof provider.url === 'string') {
                provider.url = templateString(provider.url, provider.urlOptions);
                if (provider.url.indexOf('{variant}') >= 0) {
                    return;
                }
            } else if (Array.isArray(provider.url)) {
                provider.url.map((url) => templateString(url, provider.urlOptions));
            }
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

    async getDataSource(s: string) {
        await this.getSourcesLibrary();
        const provider = this.baseProviders[s] || this.overlayProviders[s];
        if (provider) {
            const data = await this.createDataSourceAndMapLayer(s, provider);
            return data.layer.dataSource;
        }
    }

    get defaultOnlineSource() {
        if (this.tokenKeys.americanaosm) {
            return 'americanaosm';
        } else {
            return 'openstreetmap';
        }
    }

    get americanaOSMHTML() {
        return lc(
            'americanaosm_presentation_detailed',
            ...['<a href="https://tile.ourmap.us">AmericanaOSM</a>', `<a href="https://github.com/Akylas/alpimaps/?tab=readme-ov-file#default-vector-americanosm-map">${lc('tutorial')}</a>`]
        );
    }

    onMapReady(mapView: CartoMap<LatLonKeys>) {
        super.onMapReady(mapView);
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
                    const showAmericanaOSMPresentation = ApplicationSettings.getBoolean('showAmericanaOSMPresentation', true);
                    if (showAmericanaOSMPresentation) {
                        const currentIndex = savedSources.indexOf('americanaosm');
                        DEV_LOG && console.log('savedSources', currentIndex, savedSources);
                        if (currentIndex !== -1) {
                            savedSources.splice(currentIndex, 1);
                            ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
                        }
                        const { colorOnSurfaceVariant } = get(colors);
                        const promptResult = await prompt({
                            title: lc('app.name'),
                            // message: lc('americanaosm_presentation'),
                            okButtonText: lc('save'),
                            cancelButtonText: lc('cancel'),
                            defaultText: this.tokenKeys['americanaosm'],
                            textFieldProperties: {
                                variant: 'outline',
                                hint: lc('americanaosm_url'),
                                margin: 10,
                                width: { unit: '%', value: 100 }
                            },
                            view: createView(
                                Label,
                                {
                                    padding: '10 20 0 20',
                                    textWrap: true,
                                    color: colorOnSurfaceVariant as any,
                                    html: this.americanaOSMHTML
                                },
                                {
                                    linkTap: (e) => openLink(e.link)
                                }
                            )
                        });
                        if (promptResult.result && promptResult?.text.length > 0) {
                            this.saveToken('americanaosm', promptResult.text);
                        }
                        ApplicationSettings.setBoolean('showAmericanaOSMPresentation', false);
                    }
                    if (this.customSources.length === 0 && savedSources.length === 0) {
                        savedSources.push(this.defaultOnlineSource);
                        ApplicationSettings.setString('added_providers', `["${this.defaultOnlineSource}"]`);
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

    reloadMapStyle() {
        mapContext.getLayers().forEach((data) => {
            if (data.layer instanceof VectorTileLayer) {
                const decoder = data.layer.getTileDecoder();
                try {
                    decoder.reloadStyle();
                } catch (error) {
                    console.error(error, error.stack);
                }
            }
        });
    }
    @profile
    vectorTileDecoderChanged(oldVectorTileDecoder, newVectorTileDecoder) {
        this.customSources.forEach((s, i) => {
            if (s.layer instanceof VectorTileLayer && s.layer.getTileDecoder() === oldVectorTileDecoder) {
                s.layer.options.decoder = newVectorTileDecoder;
                const layer = new VectorTileLayer(s.layer.options);
                layer.setVectorTileEventListener<LatLonKeys>(
                    {
                        onVectorTileClicked: mapContext.vectorTileClicked
                    },
                    mapContext.getProjection()
                );
                mapContext.replaceLayer(s.layer, layer);
                s.layer = layer;
            }
        });
    }
    hillshadeLayer: HillshadeRasterTileLayer;
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
    hasLocalData = false;
    hasTerrain = false;
    hasRoute = false;
    async loadLocalMbtiles(directory: string) {
        try {
            const context: android.app.Activity = __ANDROID__ && Application.android.startActivity;
            const entities = listFolder(directory);
            let worldMbtiles: MBTilesTileDataSource;

            const routes = [];
            const terrains = [];
            const mbtiles = [];
            const worldMbtilesEntity = entities.find((e) => e.name === 'world.mbtiles');
            // const worldMbtilesEntity = undefined;
            const worldRouteMbtilesEntity = entities.find((e) => e.name.endsWith('routes_9.mbtiles') || e.name.endsWith('routes.mbtiles'));
            this.hasRoute |= !!worldRouteMbtilesEntity;
            const worldTerrainMbtilesEntity = entities.find((e) => e.name.endsWith('.etiles'));

            const folders = entities.filter((e) => e.isFolder).sort((a, b) => b.name.localeCompare(a.name));
            DEV_LOG && console.log('loadLocalMbtiles', JSON.stringify(folders));
            for (let i = 0; i < folders.length; i++) {
                const f = folders[i];
                const subentities = listFolder(f.path);
                if (subentities?.length > 0) {
                    const sources = subentities.filter((s) => s.path.endsWith('.mbtiles'));
                    const routesSourceIndex = sources.findIndex((s) => s.path.endsWith('routes.mbtiles'));
                    this.hasRoute |= routesSourceIndex >= 0;
                    if (false) {
                        const routesSource = sources.splice(routesSourceIndex, 1)[0];
                        routes.push(
                            new MBTilesTileDataSource({
                                minZoom: 5,
                                databasePath: getFileNameThatICanUseInNativeCode(context, routesSource.path)
                            })
                        );
                    }

                    DEV_LOG &&
                        console.log(
                            'sources',
                            sources.map((s) => s.path)
                        );
                    if (sources.length) {
                        const dataSource: TileDataSource<any, any> = this.createMergeDataSource(
                            sources.map((s) => getFileNameThatICanUseInNativeCode(context, s.path)),
                            mbTilesSourceGenerator,
                            worldMbtilesEntity ? 5 : undefined
                        );
                        mbtiles.push(dataSource);
                    }

                    const terrain = subentities.find((e) => e.name.endsWith('.etiles'));
                    if (terrain) {
                        terrains.push(
                            new MBTilesTileDataSource({
                                databasePath: getFileNameThatICanUseInNativeCode(context, terrain.path)
                            })
                        );
                    }
                }
            }

           // if (worldRouteMbtilesEntity) {
             //   routes.push(
               //     new MBTilesTileDataSource({
                 //       minZoom: 5,
                   //     databasePath: getFileNameThatICanUseInNativeCode(context, worldRouteMbtilesEntity.path)
             //       })
               // );
      //      }
            if (worldMbtilesEntity) {
                const datasource: TileDataSource<any, any> = this.createMergeDataSource(
                            [worldMbtilesEntity, worldRouteMbtilesEntity].filter(s=>!!s).map((s) => getFileNameThatICanUseInNativeCode(context, s.path)),
                            mbTilesSourceGenerator,
                            undefined);
  //              const datasource = new MBTilesTileDataSource({
//                    databasePath: getFileNameThatICanUseInNativeCode(context, worldMbtilesEntity.path)
//                });
                mbtiles.push(datasource);
                // if (!worldRouteMbtilesEntity) {
                //     routes.push(datasource);
                // }
            }

            if (worldTerrainMbtilesEntity) {
                terrains.push(
                    new MBTilesTileDataSource({
                        databasePath: getFileNameThatICanUseInNativeCode(context, worldTerrainMbtilesEntity.path)
                    })
                );
            }
            if (mbtiles.length) {
                this.hasLocalData = true;
                const name = 'Local';
                const dataSource = new MultiTileDataSource();
                DEV_LOG && console.log('mbtiles', JSON.stringify(mbtiles.map((s) => s?.options.databasePath)), get(preloading));
                mbtiles.forEach((s) => dataSource.add(s));
                const opacity = ApplicationSettings.getNumber(name + '_opacity', 1);
                // const zoomLevelBias = Math.log(this.mapView.getOptions().getDPI() / 160.0) / Math.log(2);
                const layer = new VectorTileLayer({
                    dataSource,
                    layerBlendingSpeed: 3,
                    labelBlendingSpeed: 3,
                    labelRenderOrder: VectorTileRenderOrder.LAST,
                    opacity,
                    preloading: get(preloading),
                    tileCacheCapacity: 30 * 1024 * 1024,
                    decoder: mapContext.mapDecoder,
                    // clickHandlerLayerFilter: PRODUCTION ? undefined : '.*',
                    // clickHandlerLayerFilter: PRODUCTION ? '(.*::(icon|label)|waterway|transportation)' : '.*',
                    // clickHandlerLayerFilter: PRODUCTION ? '.*::(icon|label)' : '.*',
                    clickHandlerLayerFilter: '(transportation_name|.*::(icon|label))',
                    tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                    visible: opacity !== 0
                });
                layer.setVectorTileEventListener<LatLonKeys>(
                    {
                        onVectorTileClicked: (e) => mapContext.vectorTileClicked(e)
                    },
                    mapContext.getProjection()
                    // TODO: fix this to be optimized too on iOS
                    // __ANDROID__ ? akylas.alpi.maps.VectorTileEventListener : undefined
                );
                if (!packageService.localVectorTileLayer) {
                    packageService.localVectorTileLayer = layer;
                }
                this.customSources.push({
                    layer,
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
            if (routes.length) {
                this.hasRoute = true;
                DEV_LOG &&
                    console.log(
                        'routes',
                        routes.map((s) => s.options.databasePath)
                    );
                if (routes.length > 1) {
                    const dataSource = new MultiTileDataSource({
                        // maxOpenedPackages: 1,
                        // reorderingCache: false
                    });
                    routes.forEach((s) => dataSource.add(s));
                    const layer = this.createRouteLayer(dataSource);
                    mapContext.addLayer(layer, 'routes');
                } else {
                    const layer = this.createRouteLayer(routes[0]);
                    mapContext.addLayer(layer, 'routes');
                }
            }
            if (terrains.length) {
                this.hasTerrain = true;
                const name = 'Hillshade';
                const opacity = ApplicationSettings.getNumber(`${name}_opacity`, 1);
                const dataSource = new MultiTileDataSource();
                terrains.forEach((s) => dataSource.add(s));
                const layer = (this.hillshadeLayer = packageService.hillshadeLayer = this.createHillshadeTileLayer(name, dataSource));
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
    currentlyDownloadind: { dataSource: PersistentCacheTileDataSource; provider: Provider };
    async stopDownloads() {
        if (this.currentlyDownloadind) {
            this.currentlyDownloadind.dataSource.stopAllDownloads();
            this.notify({
                eventName: 'datasource_download_progress',
                object: this,
                data: 0
            });
            const itemIndex = this.customSources.findIndex((s) => s.provider === this.currentlyDownloadind.provider);
            DEV_LOG && console.log('stopDownloads', this.currentlyDownloadind.provider, itemIndex);
            if (itemIndex) {
                const item = this.customSources.getItem(itemIndex);
                delete item.downloading;
                delete item.downloadProgress;
                this.customSources.setItem(itemIndex, item);
            }
            this.currentlyDownloadind = null;
        }
    }

    async downloadDataSource({ dataSource, maxZoom, minZoom, provider }: { dataSource: TileDataSource<any, any>; provider: Provider; minZoom?; maxZoom? }) {
        TEST_LOG && console.log('downloadDataSource', dataSource.constructor.name, provider, minZoom, maxZoom);
        try {
            if (this.currentlyDownloadind) {
                return;
            }
            if (dataSource instanceof PersistentCacheTileDataSource) {
                await new Promise<void>((resolve, reject) => {
                    try {
                        this.currentlyDownloadind = { dataSource, provider };
                        const zoom = maxZoom ?? provider.sourceOptions.maxZoom - 1;
                        const cartoMap = mapContext.getMap();
                        const projection = dataSource.getProjection();
                        const screenBounds = toNativeScreenBounds({
                            min: { x: cartoMap.getMeasuredWidth(), y: 0 },
                            max: { x: 0, y: cartoMap.getMeasuredHeight() }
                        });
                        const bounds = new MapBounds(
                            projection.fromWgs84(cartoMap.screenToMap(screenBounds.getMin()) as any),
                            projection.fromWgs84(cartoMap.screenToMap(screenBounds.getMax()) as any)
                        );

                        TEST_LOG && console.log('startDownloadArea', provider, bounds, minZoom, maxZoom, cartoMap.getZoom(), zoom);
                        dataSource.startDownloadArea(bounds, minZoom ?? cartoMap.getZoom(), zoom, {
                            onDownloadCompleted: () => {
                                DEV_LOG && console.log('onDownloadCompleted');
                                this.currentlyDownloadind = null;
                                const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
                                if (itemIndex) {
                                    const item = this.customSources.getItem(itemIndex);
                                    delete item.downloading;
                                    delete item.downloadProgress;
                                    this.customSources.setItem(itemIndex, item);
                                }
                                // ensure we hide the progress
                                this.notify({
                                    eventName: 'datasource_download_progress',
                                    object: this,
                                    data: 0
                                });
                                this.notify({
                                    eventName: 'datasource_dowload_finished',
                                    object: this,
                                    data: { provider, dataSource }
                                });
                                resolve();
                            },
                            onDownloadFailed(tile: { x: number; y: number; tileId: number }) {
                                // this.notify({
                                //     eventName: 'dowload_finished',
                                //     object: this,
                                //     data: {provider, dataSource}
                                // });
                                // const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
                                // if (itemIndex) {
                                //     const item = this.customSources.getItem(itemIndex);
                                //     delete item.downloading;
                                //     delete item.downloadProgress;
                                //     this.customSources.setItem(itemIndex, item);
                                // }
                            },
                            onDownloadProgress: (progress: number) => {
                                // DEV_LOG && console.log('onDownloadProgress', progress);
                                this.notify({
                                    eventName: 'datasource_download_progress',
                                    object: this,
                                    data: progress
                                });
                                const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
                                if (itemIndex) {
                                    const item = this.customSources.getItem(itemIndex);
                                    item.downloadProgress = progress;
                                    this.customSources.setItem(itemIndex, item);
                                }
                            },
                            onDownloadStarting: (tileCount: number) => {
                                DEV_LOG && console.log('onDownloadStarting', tileCount);
                                const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
                                if (itemIndex) {
                                    const item = this.customSources.getItem(itemIndex);
                                    item.downloading = true;
                                    item.downloadProgress = 0;
                                    this.customSources.setItem(itemIndex, item);
                                }
                                this.notify({
                                    eventName: 'datasource_dowload_started',
                                    object: this,
                                    data: { provider, dataSource }
                                });
                            }
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            }
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
                    .map((s) => ({ name: s, isPick: false, data: this.baseProviders[s] }))
            }
        });
        const result = Array.isArray(results) ? results[0] : results;
        if (result) {
            const provider = result.data as Provider;
            const name = provider.id || result.name;

            const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
            const layerIndex = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);
            if (layerIndex !== -1) {
                throw new Error(lc('data_source_already_added', name));
            }
            // if (result.isPick) {
            //     provider.name = File.fromPath(provider.url).name;
            //     provider.id = provider.url;
            //     provider.type = 'orux';
            // }
            const data = await this.createDataSourceAndMapLayer(provider.id || result.name, provider);
            this.addDataSource(data);
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
                const provider = this.baseProviders[this.defaultOnlineSource];
                const data = await this.createDataSourceAndMapLayer(provider.id, provider);
                this.addDataSource(data);
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
