import { MapPos } from '@nativescript-community/ui-carto/core';
import {
    CombinedTileDataSource,
    MergedMBVTTileDataSource,
    OrderedTileDataSource,
    TileDataSource
} from '@nativescript-community/ui-carto/datasources';
import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
import { HTTPTileDataSource } from '@nativescript-community/ui-carto/datasources/http';
import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
import { TileLayer, TileSubstitutionPolicy } from '@nativescript-community/ui-carto/layers';
import {
    HillshadeRasterTileLayer,
    HillshadeRasterTileLayerOptions,
    RasterTileFilterMode,
    RasterTileLayer
} from '@nativescript-community/ui-carto/layers/raster';
import { VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { MapBoxElevationDataDecoder, TerrariumElevationDataDecoder } from '@nativescript-community/ui-carto/rastertiles';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { openFilePicker } from '@nativescript-community/ui-document-picker';
import * as appSettings from '@nativescript/core/application-settings';
import { Color } from '@nativescript/core';
import { ChangeType, ChangedData, ObservableArray } from '@nativescript/core/data/observable-array';
import { File, Folder, path } from '@nativescript/core/file-system';
import { showBottomSheet } from '~/components/bottomsheet';
import { Provider } from '~/data/tilesources';
import { l } from '~/helpers/locale';
import { packageService } from '~/services/PackageService';
import { getDataFolder, getDefaultMBTilesDir } from '~/utils/utils';
import { toDegrees, toRadians } from '~/utils/geo';
import MapModule, { getMapContext } from './MapModule';
const mapContext = getMapContext();

const DEFAULT_HILLSHADE_SHADER =
    'uniform vec4 u_shadowColor;\n \
uniform vec4 u_highlightColor;\n \
uniform vec4 u_accentColor;\n \
uniform vec3 u_lightDir;\n \
vec4 applyLighting(lowp vec4 color, mediump vec3 normal, mediump vec3 surfaceNormal, mediump float intensity) {\n \
    mediump float lighting = max(0.0, dot(normal, u_lightDir));\n \
    mediump float accent = normal.z;\n \
    lowp vec4 accent_color = (1.0 - accent) * u_accentColor * intensity;\n \
    mediump float alpha = clamp(u_shadowColor.a*(1.0-lighting)+u_highlightColor.a*lighting, 0.0, 1.0);\n \
    lowp vec4 shade_color = vec4(mix(u_shadowColor.rgb, u_highlightColor.rgb, lighting), alpha);\n \
    return (accent_color * (1.0 - shade_color.a) + shade_color) * color * intensity;\n \
}';

const SLOPE_HILLSHADE_SHADER =
    'uniform vec4 u_shadowColor; \n \
uniform vec4 u_highlightColor; \n \
uniform vec4 u_accentColor; \n \
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
    }
};
export interface SourceItem {
    opacity: number;
    legend?: string;
    name: string;
    local?: boolean;
    layer: TileLayer<any, any>;
    provider: Provider;
    index?: number;
    options?: {
        [k: string]:
            | { min: number; max: number; value?: number; transform?: Function; transformBack?: Function }
            | { type: string };
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
                    this.moveSource(this.customSources.getItem(event.index).name, event.index);
                    // this._listViewAdapter.notifyItemRangeInserted(event.index, event.addedCount);
                }
                // if (event.removed && event.removed.length > 0) {
                //     this._listViewAdapter.notifyItemRangeRemoved(event.index, event.removed.length);
                // }
                return;
            }
        }
    }
    createMergeMBTilesDataSource(sources: string[]) {
        // console.log('createMergeMBTilesDataSource', sources);
        if (sources.length === 1) {
            return new MBTilesTileDataSource({
                databasePath: sources[0]
            });
        } else {
            const dataSources = sources.map(
                (s) =>
                    new MBTilesTileDataSource({
                        databasePath: s
                    })
            );
            return new MergedMBVTTileDataSource({
                dataSources
            });
        }
    }

    createOrderedMBTilesDataSource(sources: string[]) {
        // console.log('createOrderedMBTilesDataSource', sources);
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

    createMergeMBtiles(
        { name, sources, legend }: { name: string; sources: string[]; legend?: string },
        worldMbtiles?: MBTilesTileDataSource,
        options = {}
    ) {
        let dataSource: TileDataSource<any, any> = this.createMergeMBTilesDataSource(sources);
        if (worldMbtiles) {
            dataSource = new MergedMBVTTileDataSource({
                dataSources: [worldMbtiles, dataSource]
            });
        }
        const opacity = appSettings.getNumber(`${name}_opacity`, 1);
        // const zoomLevelBias = Math.log(this.mapView.getOptions().getDPI() / 160.0) / Math.log(2);
        const layer = new VectorTileLayer({
            dataSource,
            // zoomLevelBias: zoomLevelBias * 0.75,
            opacity,
            decoder: mapContext.getVectorTileDecoder(),
            // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_NONE,
            visible: opacity !== 0
        });
        layer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
        layer.setVectorTileEventListener<LatLonKeys>(
            {
                onVectorTileClicked: (e) => mapContext.vectorTileClicked(e)
            },
            mapContext.getProjection()
        );
        return {
            name,
            opacity,
            legend,
            layer,
            options: {
                zoomLevelBias: {
                    min: 0,
                    max: 5
                }
            },
            provider: { name, sources, legend },
            ...options
        };
    }
    createHillshadeTileLayer(name, dataSource, options: HillshadeRasterTileLayerOptions = {}, terrarium = false) {
        const contrast = appSettings.getNumber(`${name}_contrast`, 1);
        const heightScale = appSettings.getNumber(`${name}_heightScale`, 0.086);
        const illuminationDirection = appSettings.getNumber(`${name}_illuminationDirection`, 335);
        const opacity = appSettings.getNumber(`${name}_opacity`, 1);
        const decoder = terrarium ? new TerrariumElevationDataDecoder() : new MapBoxElevationDataDecoder();
        const tileFilterModeStr = appSettings.getString(`${name}_tileFilterMode`, 'bilinear');

        const accentColor = new Color(appSettings.getString(`${name}_accentColor`, 'rgba(0,0,0,0.39)'));
        const shadowColor = new Color(appSettings.getString(`${name}_shadowColor`, 'rgba(0,0,0,0.39)'));
        const highlightColor = new Color(appSettings.getString(`${name}_highlightColor`, 'rgba(255, 255, 255,0)'));

        let tileFilterMode: RasterTileFilterMode;
        switch (tileFilterModeStr) {
            case 'bicubic':
                tileFilterMode = RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BICUBIC;
                break;
            case 'bilinear':
                tileFilterMode = RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BILINEAR;
                break;
            case 'nearest':
                tileFilterMode = RasterTileFilterMode.RASTER_TILE_FILTER_MODE_NEAREST;
                break;
        }
        return new HillshadeRasterTileLayer({
            decoder,
            tileFilterMode,
            visibleZoomRange: [3, 16],
            contrast,
            // exagerateHeightScaleEnabled: false,
            normalMapLightingShader: DEFAULT_HILLSHADE_SHADER,
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
        if (this.hillshadeLayer) {
            if (value) {
                this.hillshadeLayer.normalMapLightingShader = SLOPE_HILLSHADE_SHADER;
                this.hillshadeLayer.exagerateHeightScaleEnabled = false;
            } else {
                this.hillshadeLayer.normalMapLightingShader = DEFAULT_HILLSHADE_SHADER;
                this.hillshadeLayer.exagerateHeightScaleEnabled = true;
            }
        }
    }
    createRasterLayer(id: string, provider: Provider) {
        const opacity = appSettings.getNumber(`${id}_opacity`, 1);
        const rasterCachePath = Folder.fromPath(path.join(getDataFolder(), 'rastercache'));
        const databasePath = File.fromPath(path.join(rasterCachePath.path, id)).path;

        // Apply zoom level bias to the raster layer.
        // By default, bitmaps are upsampled on high-DPI screens.
        // We will correct this by applying appropriate bias
        const zoomLevelBias = appSettings.getNumber(
            `${id}_zoomLevelBias`,
            (Math.log(this.mapView.getOptions().getDPI() / 160.0) / Math.log(2)) * 0.75
        );

        const dataSource = new HTTPTileDataSource({
            url: provider.url as string,
            ...provider.sourceOptions
        });
        let layer: TileLayer<any, any>;
        const options = {
            zoomLevelBias: {
                min: 0,
                max: 5
            }
        };
        if (provider.cacheable !== false) {
            Object.assign(options, {
                cacheSize: {
                    min: 0,
                    max: 2048
                }
            });
        }
        const cacheSize = appSettings.getNumber(`${id}_cacheSize`, 300);
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
                    // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                    visible: opacity !== 0,
                    ...provider.layerOptions
                },
                provider.terrarium === true
            );
            if (!this.hillshadeLayer) {
                this.hillshadeLayer = packageService.hillshadeLayer = layer as HillshadeRasterTileLayer;
            }
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
        // console.log('createRasterLayer', id, opacity, provider.url, provider.sourceOptions, dataSource, dataSource.maxZoom, dataSource.minZoom);
        return {
            name: id,
            legend: provider.legend,
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
        if (
            !!provider.isOverlay ||
            (provider.layerOptions && provider.layerOptions.opacity && provider.layerOptions.opacity < 1)
        ) {
            return true;
        }
        return false;
        // const overlayPatterns = [
        //     '^(OpenWeatherMap|OpenSeaMap|Lonvia|OpenSkiMap)',
        //     'OpenMapSurfer.(AdminBounds|Contours)',
        //     'shading',
        //     '^openpistemap$.',
        //     'Stamen.Toner(Hybrid|Lines|Labels)',
        //     'Acetate.(foreground|labels|roads)',
        //     'Hydda.RoadsAndLabels'
        // ];

        // return providerName.toLowerCase().match('(' + overlayPatterns.join('|').toLowerCase() + ')') !== null;
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
            urlOptions: data.urlOptions,
            layerOptions: data.layerOptions
        };

        if (data.legend) {
            provider.legend = templateString(data.legend, provider.urlOptions);
        }
        if (data.cacheable !== undefined) {
            provider.cacheable = data.cacheable;
        }
        if (data.downloadable !== undefined) {
            provider.downloadable = data.downloadable;
        }
        if (data.hillshade === true) {
            provider.hillshade = true;
            provider.terrarium = data.terrarium;
        }
        if (data.downloadable !== undefined) {
            provider.downloadable = data.downloadable;
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
                return attributionReplacer(providers[attributionName].attribution);
            });
        };
        provider.attribution = attributionReplacer(provider.attribution);

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
        const module = await import('~/data/tilesources');
        // })
        const providers = module.data;
        for (const provider in module.data) {
            this.addProvider(provider, providers);
            if (providers[provider].variants) {
                for (const variant in providers[provider].variants) {
                    this.addProvider(provider + '.' + variant, providers);
                }
            }
        }
        this.sourcesLoaded = true;
    }

     onMapReady(mapView: CartoMap<LatLonKeys>) {
        super.onMapReady(mapView);
        (async ()=>{
            try {
                const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
                // console.log('onMapReady', savedSources, this.customSources);
                if (savedSources.length > 0) {
                    await this.getSourcesLibrary();
                    savedSources.forEach((s) => {
                        const provider = this.baseProviders[s] || this.overlayProviders[s];
                        try {
                            if (provider) {
                                const data = this.createRasterLayer(s, provider);
                                this.customSources.push(data);
                                mapContext.addLayer(data.layer, 'customLayers');
                            }
                        } catch (err) {
                            console.error('createRasterLayer', err);
                        }
                    });
                }
                const folderPath = getDefaultMBTilesDir();
                if (folderPath) {
                    await this.loadLocalMbtiles(folderPath);
                }
                this.listenForSourceChanges = true;
            } catch (err) {
                console.error(TAG, 'onMapReady', err);
            }
        })();
    }

    vectorTileDecoderChanged(oldVectorTileDecoder, newVectorTileDecoder) {
        this.customSources.forEach((s, index) => {
            if (s.layer instanceof VectorTileLayer && s.layer.getTileDecoder() === oldVectorTileDecoder) {
                const layer = new VectorTileLayer({
                    dataSource: s.layer.dataSource,
                    // zoomLevelBias: zoomLevelBias * 0.75,
                    opacity: s.layer.opacity,
                    decoder: newVectorTileDecoder,
                    // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                    visible: s.layer.opacity !== 0
                });
                layer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
                // layer.setBuildingRenderOrder(VectorTileRenderOrder.LAYER);
                layer.setVectorTileEventListener<LatLonKeys>(
                    {
                        onVectorTileClicked: mapContext.vectorTileClicked
                    },
                    mapContext.getProjection()
                );
                const cartoMap = mapContext.getMap();
                const index = mapContext.getLayerIndex(layer);
                cartoMap.getLayers().set(index, layer);
                s.layer = layer;
            }
        });
    }
    hillshadeLayer: HillshadeRasterTileLayer;
    addDataSource(data: SourceItem) {
        const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
        const layerIndex = savedSources.indexOf(data.name);
        if (layerIndex === -1) {
            this.customSources.push(data);
            mapContext.addLayer(data.layer, 'customLayers');
            savedSources.push(data.name);
            appSettings.setString('added_providers', JSON.stringify(savedSources));
        } else {
            this.customSources.splice(layerIndex, 0, data);
            mapContext.insertLayer(data.layer, 'customLayers', layerIndex);
        }
    }
    async loadLocalMbtiles(directory: string) {
        if (!Folder.exists(directory)) {
            return;
        }
        try {
            const folder = Folder.fromPath(directory);
            const index = this.customSources.length;
            const entities = await folder.getEntities();
            let worldMbtiles: MBTilesTileDataSource;
            const worldMbtilesIndex = entities.findIndex((e) => e.name === 'world.mbtiles');
            if (worldMbtilesIndex !== -1) {
                const entity = entities.splice(worldMbtilesIndex, 1)[0];
                // worldMbtiles = new MBTilesTileDataSource({
                //     databasePath: entity.path
                // });
                const data = this.createMergeMBtiles(
                    {
                        legend: 'https://www.openstreetmap.org/key.html',
                        name: 'world',
                        sources: [entity.path]
                    },
                    undefined,
                    {
                        local: true
                    }
                );
                this.addDataSource(data);
            }
            const folders = entities.filter((e) => Folder.exists(e.path)).sort((a, b) => b.name.localeCompare(a.name));
            for (let i = 0; i < folders.length; i++) {
                const f = folders[i];
                const subentities = await Folder.fromPath(f.path).getEntities();
                const data = this.createMergeMBtiles(
                    {
                        legend: 'https://www.openstreetmap.org/key.html',
                        name: f.name,
                        sources: subentities.map((e2) => e2.path).filter((s) => s.endsWith('.mbtiles'))
                    },
                    undefined,
                    {
                        local: true
                    }
                );
                if (!packageService.localVectorTileLayer) {
                    packageService.localVectorTileLayer = data.layer;
                }
                this.addDataSource(data);
            }
            // console.log('loading etiles', e.name);
            const dataSource = this.createOrderedMBTilesDataSource(
                entities.filter((e) => e.name.endsWith('.etiles')).map((e2) => e2.path)
            );
            const name = 'Hillshade';
            const opacity = appSettings.getNumber(`${name}_opacity`, 1);
            const layer = (this.hillshadeLayer = packageService.hillshadeLayer = this.createHillshadeTileLayer(name, dataSource));
            // layer.setRasterTileEventListener<LatLonKeys>(
            //     {
            //         onRasterTileClicked: (e) => mapContext.rasterTileClicked(e)
            //     },
            //     mapContext.getProjection()
            // );
            const data = {
                name,
                opacity,
                layer,
                local: true,
                options: HILLSHADE_OPTIONS,
                provider: { name }
            };
            this.addDataSource(data);
            // return Promise.all(
        } catch (err) {
            console.error('loadLocalMbtiles', err);
            setTimeout(() => {
                throw err;
            }, 0);
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
                    appSettings.setString('local_mbtiles_directory', localMbtilesSource);
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
        const options = {
            props: {
                title: l('pick_source'),
                options: Object.keys(this.baseProviders).map((s) => ({ name: s, provider: this.baseProviders[s] }))
            },
            fullscreen: false
        };
        const OptionSelect = (await import('~/components/OptionSelect.svelte')).default;
        const results = await showBottomSheet({
            view: OptionSelect,
            props: {
                title: l('pick_source'),
                options: Object.keys(this.baseProviders).map((s) => ({ name: s, provider: this.baseProviders[s] }))
            }
        });
        // console.log('closeCallback', results);
        const result = Array.isArray(results) ? results[0] : results;
        if (result) {
            const data = this.createRasterLayer(result.name, result.provider);
            this.addDataSource(data);
        }
    }
    deleteSource(name: string) {
        let index = -1;

        this.customSources.some((d, i) => {
            if (d.name === name) {
                index = i;
                return true;
            }
            return false;
        });
        // console.log('deleteSource', name, index);
        if (index !== -1) {
            mapContext.removeLayer(this.customSources.getItem(index).layer, 'customLayers');
            this.customSources.splice(index, 1);
        }
        const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
        index = savedSources.indexOf(name);
        appSettings.remove(name + '_opacity');
        if (index !== -1) {
            savedSources.splice(index, 1);
            appSettings.setString('added_providers', JSON.stringify(savedSources));
        }
    }
    moveSource(name: string, newIndex: number) {
        let index = -1;

        this.customSources.some((d, i) => {
            if (d.name === name) {
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
        const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
        index = savedSources.indexOf(name);
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
            savedSources.splice(newIndex, 0, name);
            appSettings.setString('added_providers', JSON.stringify(savedSources));
        }
    }
}
