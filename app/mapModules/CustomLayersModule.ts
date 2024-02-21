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
import { openFilePicker } from '@nativescript-community/ui-document-picker';
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
import { showError } from '~/utils/error';
import { toDegrees, toRadians } from '~/utils/geo';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { getDataFolder, getDefaultMBTilesDir, getFileNameThatICanUseInNativeCode, listFolder } from '~/utils/utils';
// eslint-disable-next-line no-duplicate-imports
import { data as TileSourcesData } from '~/data/tilesources';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { openLink } from '~/utils/ui';
import { SDK_VERSION } from '@akylas/nativescript/utils';
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

const DEFAULT_HILLSHADE_SHADER =
    'uniform vec4 u_shadowColor;\n \
uniform vec4 u_highlightColor;\n \
uniform vec4 u_colorPrimary;\n \
uniform vec3 u_lightDir;\n \
vec4 applyLighting(lowp vec4 color, mediump vec3 normal, mediump vec3 surfaceNormal, mediump float intensity) {\n \
    mediump float lighting = max(0.0, dot(normal, u_lightDir));\n \
    mediump float accent = normal.z;\n \
    lowp vec4 accent_color = (1.0 - accent) * u_colorPrimary * intensity;\n \
    mediump float alpha = clamp(u_shadowColor.a*(1.0-lighting)+u_highlightColor.a*lighting, 0.0, 1.0);\n \
    lowp vec4 shade_color = vec4(mix(u_shadowColor.rgb, u_highlightColor.rgb, lighting), alpha);\n \
    return (accent_color * (1.0 - shade_color.a) + shade_color) * color * intensity;\n \
}';

const SLOPE_HILLSHADE_SHADER =
    'uniform vec4 u_shadowColor; \n \
uniform vec4 u_highlightColor; \n \
uniform vec4 u_colorPrimary; \n \
uniform vec3 u_lightDir;  \n\
vec4 applyLighting(lowp vec4 color, mediump vec3 normal, mediump vec3 surfaceNormal, mediump float intensity) { \n \
   mediump float lighting = max(0.0, dot(normal, u_lightDir)); \n \
   mediump float slope = acos(dot(normal, surfaceNormal)) *180.0 / 3.14159 * 1.2; \n \
   if (slope >= 45.0) {return vec4(0.7568627450980392* 0.5, 0.5450980392156863* 0.5, 0.7176470588235294* 0.5, 0.5); } \n \
   if (slope >= 40.0) {return vec4( 0.5, 0, 0, 0.5); } \n \
   if (slope >= 35.0) {return vec4(0.9098039215686275* 0.5, 0.4627450980392157* 0.5, 0.2235294117647059* 0.5, 0.5); } \n \
   if (slope >= 30.0) {return vec4(0.9411764705882353* 0.5, 0.9019607843137255* 0.5, 0.3058823529411765* 0.5, 0.5); } \n \
   return vec4(0, 0, 0, 0.0); \n \
} \n';

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
    colorPrimary: {
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

    createRouteLayer(dataSource: TileDataSource<any, any>) {
        const routeLayer = new VectorTileLayer({
            dataSource,
            // maxUnderzoomLevel: 0,
            // maxOverzoomLevel: 0,
            visibleZoomRange: [4, 24],
            layerBlendingSpeed: 0,
            preloading: get(preloading),
            visible: get(showRoutes),
            tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
            labelRenderOrder: VectorTileRenderOrder.LAST,
            decoder: mapContext.innerDecoder
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
            normalMapLightingShader: DEFAULT_HILLSHADE_SHADER,
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
                this.hillshadeLayer.normalMapLightingShader = SLOPE_HILLSHADE_SHADER;
            } else {
                this.hillshadeLayer.normalMapLightingShader = DEFAULT_HILLSHADE_SHADER;
            }
        }
    }
    mDevMode = ApplicationSettings.getBoolean('devMode', !PRODUCTION);

    getTokenKeys() {
        return {
            carto: ApplicationSettings.getString('cartoToken', this.devMode ? gVars.CARTO_TOKEN : undefined),
            here_appid: ApplicationSettings.getString('here_appidToken', this.devMode ? gVars.HER_APP_ID : undefined),
            here_appcode: ApplicationSettings.getString('here_appcodeToken', this.devMode ? gVars.HER_APP_CODE : undefined),
            mapbox: ApplicationSettings.getString('mapboxToken', this.devMode ? gVars.MAPBOX_TOKEN : undefined),
            mapquest: ApplicationSettings.getString('mapquestToken', this.devMode ? gVars.MAPQUEST_TOKEN : undefined),
            maptiler: ApplicationSettings.getString('maptilerToken', this.devMode ? gVars.MAPTILER_TOKEN : undefined),
            google: ApplicationSettings.getString('googleToken', this.devMode ? gVars.GOOGLE_TOKEN : undefined),
            thunderforest: ApplicationSettings.getString('thunderforestToken', this.devMode ? gVars.THUNDERFOREST_TOKEN : undefined),
            ign: ApplicationSettings.getString('ignToken', this.devMode ? gVars.IGN_TOKEN : undefined)
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
            console.log('tokens', tokens);
            const needsToSet = tokens.map((s) => this.tokenKeys[s]).some((s) => s === undefined);
            if (needsToSet) {
                if (tokens.length === 2) {
                    const result = await login({
                        title: lc('api_key'),
                        message: lc('api_keys_needed', tokens.join(',')),
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
                if (Array.isArray(url)) {
                    url = url.map((u) => u.replace(`{${tok}}`, this.tokenKeys[tok]));
                } else {
                    url = url.replace(`{${tok}}`, this.tokenKeys[tok]);
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
                    //@ts-ignore
                    cacheSize,
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
                              capacity: cacheSize * 1024 * 1024,
                              databasePath
                          })
                        : dataSource,
                zoomLevelBias,
                labelRenderOrder: VectorTileRenderOrder.LAST,
                decoder: mapContext.innerDecoder,
                // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                visible: opacity !== 0,
                ...provider.layerOptions
            });
        } else {
            layer = new RasterTileLayer({
                dataSource:
                    provider.cacheable !== false
                        ? new PersistentCacheTileDataSource({
                              dataSource,
                              capacity: cacheSize * 1024 * 1024,
                              databasePath
                          })
                        : dataSource,
                zoomLevelBias,
                //@ts-ignore
                cacheSize,
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
            layerOptions: data.layerOptions
        };

        if (data.legend) {
            provider.legend = templateString(data.legend, provider.urlOptions);
        }
        if (data.cacheable !== undefined) {
            provider.cacheable = data.cacheable || !PRODUCTION;
        } else {
            provider.cacheable = !PRODUCTION;
        }
        if (data.hillshade === true) {
            provider.hillshade = true;
            provider.terrarium = data.terrarium;
        }
        if (data.downloadable !== undefined) {
            provider.downloadable = data.downloadable || !PRODUCTION || this.devMode;
        } else {
            provider.downloadable = !PRODUCTION;
        }
        if (data.devHidden !== undefined) {
            provider.devHidden = data.devHidden;
        }

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

    onMapReady(mapView: CartoMap<LatLonKeys>) {
        super.onMapReady(mapView);
        (async () => {
            try {
                if (!__DISABLE_OFFLINE__ && (!__ANDROID__ || !PLAY_STORE_BUILD || SDK_VERSION < 11)) {
                    const folderPath = await getDefaultMBTilesDir();
                    if (folderPath && Folder.exists(folderPath)) {
                        await this.loadLocalMbtiles(folderPath);
                    }
                    if (this.customSources.length === 0) {
                        const showFirstPresentation = ApplicationSettings.getBoolean('showFirstPresentation', true);
                        const result = await confirm({
                            title: lc('app.name'),
                            message: lc('app_generate_date_presentation'),
                            okButtonText: lc('ok'),
                            cancelButtonText: lc('cancel')
                        });
                        if (result) {
                            openLink(GIT_URL);
                        }
                        ApplicationSettings.getBoolean('showFirstPresentation', false);
                    }
                }
                const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));

                if (this.customSources.length === 0 && savedSources.length === 0) {
                    savedSources.push('openstreetmap');
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
            const worldRouteMbtilesEntity = entities.find((e) => e.name.endsWith('routes_9.mbtiles') || e.name.endsWith('routes.mbtiles'));
            const worldTerrainMbtilesEntity = entities.find((e) => e.name.endsWith('.etiles'));

            const folders = entities.filter((e) => e.isFolder).sort((a, b) => b.name.localeCompare(a.name));
            DEV_LOG && console.log('loadLocalMbtiles', folders);
            for (let i = 0; i < folders.length; i++) {
                const f = folders[i];
                const subentities = listFolder(f.path);
                if (subentities?.length > 0) {
                    const sources = subentities.filter((s) => s.path.endsWith('.mbtiles'));
                    const routesSourceIndex = sources.findIndex((s) => s.path.endsWith('routes.mbtiles'));
                    if (routesSourceIndex >= 0) {
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

            if (worldRouteMbtilesEntity) {
                routes.push(
                    new MBTilesTileDataSource({
                        minZoom: 5,
                        databasePath: getFileNameThatICanUseInNativeCode(context, worldRouteMbtilesEntity.path)
                    })
                );
            }
            if (worldMbtilesEntity) {
                const datasource = new MBTilesTileDataSource({
                    databasePath: getFileNameThatICanUseInNativeCode(context, worldMbtilesEntity.path)
                });
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
                DEV_LOG &&
                    console.log(
                        'mbtiles',
                        mbtiles,
                        mbtiles.map((s) => s?.options.databasePath),
                        get(preloading)
                    );
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
                    decoder: mapContext.mapDecoder,
                    // clickHandlerLayerFilter: PRODUCTION ? undefined : '.*',
                    clickHandlerLayerFilter: PRODUCTION ? '(.*::(icon|label)|waterway|transportation)' : '.*',
                    tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                    visible: opacity !== 0
                });
                layer.setVectorTileEventListener<LatLonKeys>(
                    {
                        onVectorTileClicked: (e) => mapContext.vectorTileClicked(e)
                    },
                    mapContext.getProjection(),
                    akylas.alpi.maps.VectorTileEventListener
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
        }
    }

    async downloadDataSource(dataSource: TileDataSource<any, any>, provider: Provider) {
        try {
            if (this.currentlyDownloadind) {
                return;
            }
            if (dataSource instanceof PersistentCacheTileDataSource) {
                await new Promise<void>((resolve, reject) => {
                    this.currentlyDownloadind = { dataSource, provider };
                    const zoom = provider.sourceOptions.maxZoom - 1;
                    const cartoMap = mapContext.getMap();
                    const projection = dataSource.getProjection();
                    const screenBounds = toNativeScreenBounds({
                        min: { x: cartoMap.getMeasuredWidth(), y: 0 },
                        max: { x: 0, y: cartoMap.getMeasuredHeight() }
                    });
                    const bounds = new MapBounds(projection.fromWgs84(cartoMap.screenToMap(screenBounds.getMin()) as any), projection.fromWgs84(cartoMap.screenToMap(screenBounds.getMax()) as any));

                    TEST_LOG && console.log('startDownloadArea1', provider, bounds, cartoMap.getZoom(), zoom);
                    dataSource.startDownloadArea(bounds, cartoMap.getZoom(), zoom, {
                        onDownloadCompleted: () => {
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
                                eventName: 'onProgress',
                                object: this,
                                data: 0
                            });
                            this.notify({
                                eventName: 'dowload_finished',
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
                        },
                        onDownloadProgress: (progress: number) => {
                            this.notify({
                                eventName: 'onProgress',
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
                            const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
                            if (itemIndex) {
                                const item = this.customSources.getItem(itemIndex);
                                item.downloading = true;
                                item.downloadProgress = 0;
                                this.customSources.setItem(itemIndex, item);
                            }
                            this.notify({
                                eventName: 'dowloading',
                                object: this,
                                data: { provider, dataSource }
                            });
                        }
                    });
                });
            }
        } catch (err) {
            showError(err);
        }
    }

    selectLocalMbtilesFolder() {
        return openFilePicker({
            extensions: ['file/*'],
            multipleSelection: false,
            pickerMode: 0
        })
            .then((result) => {
                if (Folder.exists(result.files[0])) {
                    const localMbtilesSource = result.files[0];
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
            props: {
                height: 400,
                title: l('pick_source'),
                showFilter: true,
                options:
                    //  [{ name: l('pick'), isPick: true }].concat
                    Object.keys(this.baseProviders)
                        .sort()
                        .map((s) => ({ name: s, isPick: false, data: this.baseProviders[s] }))
            }
        });
        const result = Array.isArray(results) ? results[0] : results;
        if (result) {
            const provider = result.data;
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
        let index = -1;
        const name = this.getSourceItemId(item);
        this.customSources.some((d, i) => {
            if (d.id === name || d.name === name) {
                index = i;
                return true;
            }
            return false;
        });
        // console.log('deleteSource', name, index);
        if (index !== -1) {
            mapContext.removeLayer(this.customSources.getItem(index).layer, 'customLayers');
            this.customSources.splice(index, 1);
            this.updateAttribution(item, true);
        }
        const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
        index = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);
        ApplicationSettings.remove(name + '_opacity');
        if (index !== -1) {
            savedSources.splice(index, 1);

            ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
            if (savedSources.length === 0) {
                const provider = this.baseProviders['openstreetmap'];
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
        if (index !== -1) {
            const item = this.customSources.getItem(index);
            const layer = item.layer;
            mapContext.moveLayer(layer, newIndex + layerIndex);
            if (index !== newIndex) {
                this.customSources.splice(index, 1);
                this.customSources.splice(newIndex, 0, item);
            }
        }
        const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
        index = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);
        if (index !== -1) {
            // let firstNonLocalIndex = -1;
            // this.customSources.some((d, i) => {
            //     if (d.local !== true) {
            //         firstNonLocalIndex = i;
            //         return true;
            //     }
            //     return false;
            // });
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
