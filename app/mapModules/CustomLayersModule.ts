import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { VectorLayer } from 'nativescript-carto/layers/vector';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { Point } from 'nativescript-carto/vectorelements/point';
import { Polygon } from 'nativescript-carto/vectorelements/polygon';
import Map from '~/components/Map';
import MapModule from './MapModule';
import { TileLayer } from 'nativescript-carto/layers/layer';
import { RasterTileLayer } from 'nativescript-carto/layers/raster';
import { HTTPTileDataSource } from 'nativescript-carto/datasources/http';
import * as appSettings from 'tns-core-modules/application-settings/application-settings';
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { File, path } from 'tns-core-modules/file-system';
import { getDataFolder } from '~/utils';
import { DataProvider, Provider } from '~/data/tilesources';
import OptionSelect from '~/components/OptionSelect';
import localize from 'nativescript-localize';
import { clog } from '~/utils/logging';

import Vue from 'nativescript-vue';

const rasterCachePath = path.join(getDataFolder(), 'rastercache');

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
}

export default class CustomLayersModule extends MapModule {
    public customSources: SourceItem[] = [];

    createRasterLayer(id: string, provider: Provider) {
        const opacity = appSettings.getNumber(`${id}_opacity`, 1);
        const databasePath = File.fromPath(path.join(rasterCachePath, id)).path;
        console.log('createRasterLayer', id, opacity, provider.url, databasePath);

        const dataSource = new HTTPTileDataSource({
            url: provider.url as string,
            ...provider.sourceOptions
        });
        return {
            name: id,
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
                zoomLevelBias: 1,
                opacity,
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
        if (!!provider.isOverlay || (provider.layerOptions && provider.layerOptions.opacity && provider.layerOptions.opacity < 1)) {
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
            legend: data.legend,
            sourceOptions: {
                minZoom: 0,
                maxZoom: 22,
                ...data.sourceOptions
            },
            urlOptions: data.urlOptions,
            layerOptions: data.layerOptions
        };

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
        clog('getSourcesLibrary', this.sourcesLoaded);
        if (this.sourcesLoaded) {
            return Promise.resolve();
        }
        return import('~/data/tilesources').then(module => {
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
        });
    }

    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
        const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
        if (savedSources.length > 0) {
            this.getSourcesLibrary().then(() => {
                savedSources.forEach(s => {
                    const provider = this.baseProviders[s] || this.overlayProviders[s];
                    const data = this.createRasterLayer(s, provider);
                    this.customSources.push(data);
                });
                this.customSources.forEach((data, index) => {
                    mapView.addLayer(data.layer, 1 + index);
                });
            });
        }
    }
    addSource() {
        this.getSourcesLibrary().then(() => {
            const options = {
                props: {
                    title: localize('pick_source'),
                    options: Object.keys(this.baseProviders).map(s => ({ name: s, provider: this.baseProviders[s], data: '' }))
                },
                fullscreen: false
            };
            (this.mapComp as Vue).$showModal(OptionSelect, options).then((result: { name: string; provider: Provider }) => {
                clog(result);
                if (result) {
                    const data = this.createRasterLayer(result.name, result.provider);
                    clog('about to add', data.layer, !!this.mapView);
                    this.mapView.addLayer(data.layer, 1 + this.customSources.length);
                    this.customSources.push(data);
                    clog('layer added');
                    const savedSources: string[] = JSON.parse(appSettings.getString('added_providers', '[]'));
                    savedSources.push(result.name);
                    clog('saving added_providers', savedSources);
                    appSettings.setString('added_providers', JSON.stringify(savedSources));
                }
            });
        });
    }
    deleteSource(name: string) {
        let index = this.customSources.findIndex(d => d.name === name);
        if (index !== -1) {
            this.mapView.removeLayer(this.customSources[index].layer);
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
