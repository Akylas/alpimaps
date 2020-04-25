import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { HTTPTileDataSource } from 'nativescript-carto/datasources/http';
import { TileLayer } from 'nativescript-carto/layers';
import { RasterTileLayer } from 'nativescript-carto/layers/raster';
import { CartoMap } from 'nativescript-carto/ui';
import { $t } from '~/helpers/locale';
import { alert } from 'nativescript-material-dialogs';
import Vue from 'nativescript-vue';
import * as appSettings from '@nativescript/core/application-settings/application-settings';
import { ObservableArray } from '@nativescript/core/data/observable-array/observable-array';
import { File, Folder, path } from '@nativescript/core/file-system';
import Map from '~/components/Map';
import OptionSelect from '~/components/OptionSelect';
import { DataProvider, Provider } from '~/data/tilesources';
import { getDataFolder } from '~/utils';
import { cerror } from '~/utils/logging';
import MapModule from './MapModule';
import { MergedMBVTTileDataSource } from 'nativescript-carto/datasources';
import { MBTilesTileDataSource } from 'nativescript-carto/datasources/mbtiles';
import { VectorTileLayer, VectorTileRenderOrder } from 'nativescript-carto/layers/vector';
import { openFilePicker } from 'nativescript-document-picker';

function templateString(str: string, data) {
    return str.replace(
        /{(\w*)}/g, // or /{(\w*)}/g for "{this} instead of %this%"
        function(m, key) {
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
}

export default class CustomLayersModule extends MapModule {
    public customSources: ObservableArray<SourceItem> = new ObservableArray([]);

    constructor() {
        super();
        // this.customSources = new ObservableArray([]) as any;
    }
    createMergeMBtiles({ name, sources, legend }: { name: string; sources: string[]; legend?: string }) {
        let dataSource;
        if (sources.length === 1) {
            dataSource = new MBTilesTileDataSource({
                databasePath: sources[0]
            });
        } else {
            dataSource = new MergedMBVTTileDataSource({
                dataSources: sources.map(
                    s =>
                        new MBTilesTileDataSource({
                            databasePath: s
                        })
                )
            });
        }
        const mapComp = this.mapComp;
        const opacity = appSettings.getNumber(`${name}_opacity`, 1);
        // const zoomLevelBias = Math.log(this.mapView.getOptions().getDPI() / 160.0) / Math.log(2);
        const layer = new VectorTileLayer({
            dataSource,
            // zoomLevelBias: zoomLevelBias * 0.75,
            opacity,
            decoder: mapComp.getVectorTileDecoder(),
            // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
            visible: opacity !== 0
        });
        layer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
        layer.setVectorTileEventListener(mapComp, mapComp.mapProjection);
        return {
            name,
            opacity,
            legend,
            index: undefined,
            layer,
            provider: { name, sources, legend }
        };
    }
    createRasterLayer(id: string, provider: Provider) {
        const rasterCachePath = path.join(getDataFolder(), 'rastercache');

        const opacity = appSettings.getNumber(`${id}_opacity`, 1);
        const databasePath = File.fromPath(path.join(rasterCachePath, id)).path;

        // Apply zoom level bias to the raster layer.
        // By default, bitmaps are upsampled on high-DPI screens.
        // We will correct this by applying appropriate bias
        const zoomLevelBias = Math.log(this.mapView.getOptions().getDPI() / 160.0) / Math.log(2);
        // console.log('createRasterLayer', id, opacity, provider.url, databasePath, zoomLevelBias);

        const dataSource = new HTTPTileDataSource({
            url: provider.url as string,
            ...provider.sourceOptions
        });
        return {
            name: id,
            legend: provider.legend,
            opacity,
            layer: new RasterTileLayer({
                dataSource:
                    provider.cacheable !== false
                        ? new PersistentCacheTileDataSource({
                              dataSource,
                              capacity: 300 * 1024 * 1024,
                              databasePath
                          })
                        : dataSource,
                zoomLevelBias: zoomLevelBias * 0.75,
                opacity,
                // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                visible: opacity !== 0,
                ...provider.layerOptions
            }),
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
    addProvider(arg, providers: { [k: string]: DataProvider }) {
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

        // overwrite values in provider from variant.
        if (variantName && 'variants' in data) {
            const variant = data.variants[variantName];
            if (!variant) {
                throw new Error('No such variant of ' + providerName + ' (' + variantName + ')');
            }
            // let variantUrlOptions;
            if (typeof variant === 'string') {
                provider.urlOptions = {
                    variant
                };
            } else {
                // variantUrlOptions = variant.urlOptions || {};
                provider.url = variant.url || provider.url;
                provider.sourceOptions = { ...provider.sourceOptions, ...variant.sourceOptions };
                provider.layerOptions = { ...provider.layerOptions, ...variant.layerOptions };
                provider.urlOptions = { variant: variantName, ...provider.urlOptions, ...variant.urlOptions };
            }
            // variantUrlOptions.variantName = variantName;
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
                provider.url.map(url => templateString(url, provider.urlOptions));
            }
        }

        // replace attribution placeholders with their values from toplevel provider attribution,
        // recursively
        const attributionReplacer = function(attr) {
            if (!attr || attr.indexOf('{attribution.') === -1) {
                return attr;
            }
            return attr.replace(/\{attribution.(\w*)\}/, function(match, attributionName) {
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
    getSourcesLibrary() {
        // clog('getSourcesLibrary', this.sourcesLoaded);
        if (this.sourcesLoaded) {
            return Promise.resolve();
        }
        // clog('loading source library');
        // // return Promise.resolve()
        // //     .then(function() {
        // //         try {
        //             return require('~/data/tilesources');
        //         } catch (err) {
        //             cerror(err);
        //             throw err;
        //         }
        return (
            import('~/data/tilesources')
                // })
                .then(module => {
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
                })
            // .catch(err => {
            //     // cerror(err);
            //     setTimeout(() => {
            //         throw err;
            //     }, 0);
            // })
        );
    }

    onMapReady(mapComp: Map, mapView: CartoMap<LatLonKeys>) {
        super.onMapReady(mapComp, mapView);
        const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
        // this.log('onMapReady', savedSources, this.customSources);
        if (savedSources.length > 0) {
            this.getSourcesLibrary().then(() => {
                savedSources.forEach(s => {
                    const provider = this.baseProviders[s] || this.overlayProviders[s];
                    const data = this.createRasterLayer(s, provider);
                    this.customSources.push(data);
                });
                this.customSources.forEach((data, index) => {
                    mapComp.addLayer(data.layer, 'customLayers', index);
                });
            });
        }

        // const localMbtilesSource = appSettings.getString('local_mbtiles_directory', path.join(getDataFolder(), 'alpimaps_mbtiles'));
        // const localMbtilesSource = appSettings.getString('local_mbtiles_directory', '/sdcard/Download/alpimaps_mbtiles');
        const localMbtilesSource = appSettings.getString('local_mbtiles_directory', LOCAL_MBTILES);
        console.log('localMbtilesSource', localMbtilesSource);
        if (localMbtilesSource) {
            this.loadLocalMbtiles(localMbtilesSource);
        }
    }
    vectorTileDecoderChanged(oldVectorTileDecoder, newVectorTileDecoder) {
        console.log('vectorTileDecoderChanged', oldVectorTileDecoder !== newVectorTileDecoder);
        this.customSources.forEach(s => {
            if (s.layer instanceof VectorTileLayer && s.layer.getTileDecoder() === oldVectorTileDecoder) {
                console.log('updating layer', s);
                const layer = new VectorTileLayer({
                    dataSource: s.layer.dataSource,
                    // zoomLevelBias: zoomLevelBias * 0.75,
                    opacity: s.layer.opacity,
                    decoder: newVectorTileDecoder,
                    // tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                    visible: s.layer.opacity !== 0
                });
                layer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
                layer.setVectorTileEventListener(this.mapComp, this.mapComp.mapProjection);

                this.mapComp.removeLayer(s.layer, 'customLayers');
                this.mapComp.addLayer(layer, 'customLayers', s.index);
                s.layer = layer;
            }
        });
    }
    loadLocalMbtiles(directory: string) {
        // console.log('loadLocalMbtiles',directory , Folder.exists(directory));
        if (!Folder.exists(directory)) {
            return;
        }
        const folder = Folder.fromPath(directory);

        const mapComp = this.mapComp;
        let index = this.customSources.length;
        folder
            .getEntities()
            .then(entities => {
                // console.log('loadLocalMbtiles', folder, entities);
                // if (entities.length > 0) {
                //     const e = entities[0];
                //     console.log('handling folder', e.path);
                //     if (Folder.exists(e.path)) {
                //         return Folder.fromPath(e.path)
                //             .getEntities()
                //             .then(subentities => {
                //                 const data = this.createMergeMBtiles({
                //                     legend: 'https://www.openstreetmap.org/key.html',
                //                     name: e.name,
                //                     sources: subentities.map(e2 => e2.path).filter(s => s.endsWith('.mbtiles'))
                //                 });
                //                 (data.index = index++), console.log('created mbtiles layer', data);
                //                 this.customSources.push(data);
                //                 mapComp.addLayer(data.layer, 'customLayers', data.index);
                //             });
                //     }
                // }
                return Promise.all(
                    entities.map(e => {
                        console.log('handling folder', e.path);
                        if (Folder.exists(e.path)) {
                            return Folder.fromPath(e.path)
                                .getEntities()
                                .then(subentities => {
                                    const data = this.createMergeMBtiles({
                                        legend: 'https://www.openstreetmap.org/key.html',
                                        name: e.name,
                                        sources: subentities.map(e2 => e2.path).filter(s => s.endsWith('.mbtiles'))
                                    });
                                    data.index = index++;
                                    // console.log('created mbtiles layer', data);
                                    this.customSources.push(data);
                                    mapComp.addLayer(data.layer, 'customLayers', data.index);
                                });
                        }
                    })
                );
            })
            .catch(err => {
                cerror(err);
                setTimeout(() => {
                    throw err;
                }, 0);
            });
    }

    selectLocalMbtilesFolder() {
        return openFilePicker({
            extensions: ['file/*'],
            multipleSelection: false,
            pickerMode: 0
        })
            .then(result => {
                console.log('selectLocalMbtilesFolder', result);
                if (Folder.exists(result.files[0])) {
                    const localMbtilesSource = result.files[0];
                    appSettings.setString('local_mbtiles_directory', localMbtilesSource);
                    this.loadLocalMbtiles(localMbtilesSource);
                } else {
                    return Promise.reject(new Error($t('no_folder_selected')));
                }
            })
            .catch(err => {
                cerror(err);
                setTimeout(() => {
                    throw err;
                }, 0);
            });
    }

    onMapDestroyed() {
        super.onMapDestroyed();
        this.customSources.splice(0, this.customSources.length);
    }
    addSource() {
        console.log('addSource');
        this.getSourcesLibrary()
            .then(() => {
                const options = {
                    props: {
                        title: $t('pick_source'),
                        options: Object.keys(this.baseProviders).map(s => ({ name: s, provider: this.baseProviders[s] }))
                    },
                    fullscreen: false
                };
                const instance = new OptionSelect();
                instance.options = Object.keys(this.baseProviders).map(s => ({ name: s, provider: this.baseProviders[s] }));
                instance.$mount();
                ((alert({
                    title: Vue.prototype.$tc('pick_source'),
                    okButtonText: Vue.prototype.$t('cancel'),
                    view: instance.nativeView
                }) as any) as Promise<{ name: string; provider: Provider }>).then(results => {
                    const result = Array.isArray(results) ? results[0] : results;
                    if (result) {
                        const data = this.createRasterLayer(result.name, result.provider);
                        // this.log('about to add', result, data);
                        this.mapComp.addLayer(data.layer, 'customLayers', this.customSources.length);
                        this.customSources.push(data);
                        this.log('layer added', data.provider);
                        const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
                        savedSources.push(result.name);
                        // clog('saving added_providers', savedSources);
                        appSettings.setString('added_providers', JSON.stringify(savedSources));
                    }
                });
            })
            .catch(err => {
                Vue.prototype.$showError(err);
            });
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
        // this.log('deleteSource', name, index);
        if (index !== -1) {
            this.mapComp.removeLayer(this.customSources.getItem(index).layer, 'customLayers', index);
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
