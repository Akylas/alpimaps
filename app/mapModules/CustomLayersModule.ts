import { MapPos } from '@nativescript-community/ui-carto/core';
import { MergedMBVTTileDataSource, CombinedTileDataSource, OrderedTileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
import { HTTPTileDataSource } from '@nativescript-community/ui-carto/datasources/http';
import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
import { TileLayer, TileSubstitutionPolicy } from '@nativescript-community/ui-carto/layers';
import { HillshadeRasterTileLayer, HillshadeRasterTileLayerOptions, RasterTileFilterMode, RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
import { VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { MapBoxElevationDataDecoder, TerrariumElevationDataDecoder } from '@nativescript-community/ui-carto/rastertiles';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { openFilePicker } from '@nativescript-community/ui-document-picker';
import * as appSettings from '@nativescript/core/application-settings';
import { Color } from '@nativescript/core/color';
import { ObservableArray } from '@nativescript/core/data/observable-array';
import { File, Folder, path } from '@nativescript/core/file-system';
import { showBottomSheet } from '~/components/bottomsheet';
import { Provider } from '~/data/tilesources';
import { $t } from '~/helpers/locale';
import { packageService } from '~/services/PackageService';
import { getDataFolder, getDefaultMBTilesDir } from '~/utils/utils';
import MapModule, { getMapContext } from './MapModule';
const mapContext = getMapContext();

function templateString(str: string, data) {
    return str.replace(
        /{(\w*)}/g, // or /{(\w*)}/g for "{this} instead of %this%"
        function (m, key) {
            return data.hasOwnProperty(key) ? data[key] : m;
        }
    );
}

export interface SourceItem {
    opacity: number;
    legend?: string;
    name: string;
    layer: TileLayer<any, any>;
    provider: Provider;
    index?: number;
    options?: { [k: string]: { min: number; max: number; value?: number } };
}
const TAG = 'CustomLayersModule';
export default class CustomLayersModule extends MapModule {
    public customSources: ObservableArray<SourceItem> = new ObservableArray([]);

    constructor() {
        super();
        // this.customSources = new ObservableArray([]) as any;
    }
    createMergeMBTilesDataSource(sources: string[]) {
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
            )
            return new MergedMBVTTileDataSource({
                dataSources
            });
        }
    }
    
    createOrderedMBTilesDataSource(sources: string[]) {
            console.log('createOrderedMBTilesDataSource', sources);
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
            ).reverse()

            return new OrderedTileDataSource({
                dataSources,
            });
        }
    }
    
    createMergeMBtiles({ name, sources, legend }: { name: string; sources: string[]; legend?: string }) {
        const dataSource = this.createMergeMBTilesDataSource(sources);
        
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
                onVectorTileClicked: (e) => mapContext.onVectorTileClicked(e)
            },
            mapContext.getProjection()
        );
        return {
            name,
            opacity,
            legend,
            index: undefined,
            layer,
            options: {
                zoomLevelBias: {
                    min: 0,
                    max: 5
                }
            },
            provider: { name, sources, legend }
        };
    }
    createHillshadeTileLayer(name, dataSource, options: HillshadeRasterTileLayerOptions = {}, terrarium = false) {
        const contrast = appSettings.getNumber(`${name}_contrast`, 0.78);
                const heightScale = appSettings.getNumber(`${name}_heightScale`, 0.16);
                const illuminationDirection = appSettings.getNumber(`${name}_illuminationDirection`, 144);
                const opacity = appSettings.getNumber(`${name}_opacity`, 1);
                const decoder = terrarium? new TerrariumElevationDataDecoder(): new MapBoxElevationDataDecoder();
                const tileFilterModeStr = appSettings.getString(`${name}_tileFilterMode`, 'bilinear');
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
                    illuminationDirection,
                    highlightColor: new Color(40, 0, 0, 0),
                    shadowColor: new Color(100, 0, 0, 0),
                    // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_ALL,
                    heightScale,
                    dataSource,
                    opacity,
                    visible: opacity !== 0,
                    ...options
                });
    }
    createRasterLayer(id: string, provider: Provider) {
        const opacity = appSettings.getNumber(`${id}_opacity`, 1);
        const rasterCachePath = path.join(getDataFolder(), 'rastercache');
        const databasePath = File.fromPath(path.join(rasterCachePath, id)).path;

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
        let options = {
            zoomLevelBias: {
                min: 0,
                max: 5
            }
        }
        console.log('createRasterLayer', provider);
        if (provider.hillshade) {
            Object.assign(options, {
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
                    illuminationDirection: {
                        min: 0,
                        max: 359
                    }
            })
            layer = this.createHillshadeTileLayer(id, provider.cacheable !== false
                ? new PersistentCacheTileDataSource({
                      dataSource,
                      capacity: 300 * 1024 * 1024,
                      databasePath
                  })
                : dataSource, {
                zoomLevelBias,
                opacity,
                // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                visible: opacity !== 0,
                ...provider.layerOptions
            }, provider.terrarium === true);
        } else  {
            layer = new RasterTileLayer({
                dataSource:
                    provider.cacheable !== false
                        ? new PersistentCacheTileDataSource({
                              dataSource,
                              capacity: 300 * 1024 * 1024,
                              databasePath
                          })
                        : dataSource,
                zoomLevelBias,
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
            layer ,
            provider
        };
    }

    sourcesLoaded = false;
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
        try {
            const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
            // console.log('onMapReady', savedSources, this.customSources);
            if (savedSources.length > 0) {
                this.getSourcesLibrary().then(() => {
                    savedSources.forEach((s) => {
                        const provider = this.baseProviders[s] || this.overlayProviders[s];
                        const data = this.createRasterLayer(s, provider);
                        this.customSources.push(data);
                    });
                    this.customSources.forEach((data, index) => {
                        mapContext.addLayer(data.layer, 'customLayers', index);
                    });
                });
            }

            const folderPath = getDefaultMBTilesDir();
            console.log('localMbtilesSource', folderPath);
            if (folderPath) {
                this.loadLocalMbtiles(folderPath);
            }
        } catch (err) {
            console.error(TAG, 'onMapReady', err);
        }
    }

    vectorTileDecoderChanged(oldVectorTileDecoder, newVectorTileDecoder) {
        for (let index = this.customSources.length-1; index >=0; index--) {
            const s = this.customSources.getItem(index);
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
                        onVectorTileClicked: mapContext.onVectorTileClicked
                    },
                    mapContext.getProjection()
                );
                mapContext.removeLayer(s.layer, 'customLayers', s.index);
                mapContext.addLayer(layer, 'customLayers', s.index);
                s.layer = layer;
            }
        }
    }
    hillshadeLayer: HillshadeRasterTileLayer;

    async getElevation(pos: MapPos<LatLonKeys>) {
        if (this.hillshadeLayer) {
            return new Promise((resolve, reject) => {
                this.hillshadeLayer.getElevationAsync(pos, (err, result) => {
                    // console.log('searchInGeocodingService done', err, result && result.size());
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(result);
                });
            });
        }
        return null;
    }
    async loadLocalMbtiles(directory: string) {
        if (!Folder.exists(directory)) {
            return;
        }
        try {
            const folder = Folder.fromPath(directory);
            let index = this.customSources.length;
            const entities = await folder.getEntities();
            const folders = entities.filter((e) => Folder.exists(e.path)).sort((a,b)=>b.name.localeCompare(a.name));
            console.log('test folders', folders);
            for (let i = 0; i < folders.length; i++) {
                const f = folders[i];
                const subentities = await Folder.fromPath(f.path).getEntities();
                const data = this.createMergeMBtiles({
                    legend: 'https://www.openstreetmap.org/key.html',
                    name: f.name,
                    sources: subentities.map((e2) => e2.path).filter((s) => s.endsWith('.mbtiles'))
                });
                data.index = index++;
                this.customSources.push(data);
                packageService.localVectorTileLayer = data.layer;
                mapContext.addLayer(data.layer, 'customLayers', data.index);
            }
            // console.log('loading etiles', e.name);
            const dataSource = this.createOrderedMBTilesDataSource(entities.filter((e) => e.name.endsWith('.etiles')).map((e2) => e2.path));
            const name = 'Hillshade';
            const opacity = appSettings.getNumber(`${name}_opacity`, 1);
            const layer = (this.hillshadeLayer = packageService.hillshadeLayer = this.createHillshadeTileLayer(name, dataSource, {
                // maxOverzoomLevel:0,
                // maxUnderzoomLevel:0
            }));

            const data = {
                index: index++,
                name,
                opacity,
                layer,
                options: {
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
                    illuminationDirection: {
                        min: 0,
                        max: 359
                    }
                },
                provider: { name }
            };
            this.customSources.push(data);
            mapContext.addLayer(data.layer, 'hillshade', data.index);
            // return Promise.all(
        } catch (err) {
            console.error(err);
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
                    return Promise.reject(new Error($t('no_folder_selected')));
                }
            })
            .catch((err) => {
                console.error(err);
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
                title: $t('pick_source'),
                options: Object.keys(this.baseProviders).map((s) => ({ name: s, provider: this.baseProviders[s] }))
            },
            fullscreen: false
        };
        const OptionSelect = (await import('~/components/OptionSelect.svelte')).default;
        const results = await showBottomSheet({
            view: OptionSelect,
            props: {
                title: $t('pick_source'),
                options: Object.keys(this.baseProviders).map((s) => ({ name: s, provider: this.baseProviders[s] }))
            }
        });
        // console.log('closeCallback', results);
        const result = Array.isArray(results) ? results[0] : results;
        if (result) {
            const data = this.createRasterLayer(result.name, result.provider);
            mapContext.addLayer(data.layer, 'customLayers', this.customSources.length);
            this.customSources.push(data);
            // console.log('layer added', data.provider);
            const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
            savedSources.push(result.name);
            appSettings.setString('added_providers', JSON.stringify(savedSources));
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
            mapContext.removeLayer(this.customSources.getItem(index).layer, 'customLayers', index);
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
}
