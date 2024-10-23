<script lang="ts">
    import { l } from '@nativescript-community/l';
    import type { MapBounds, MapPos } from '@nativescript-community/ui-carto/core';
    import { SearchRequest } from '@nativescript-community/ui-carto/search';
    import { showSnack } from '~/utils/ui';
    import { ApplicationSettings, ObservableArray, Screen } from '@nativescript/core';
    import deburr from 'deburr';
    import type { Point } from 'geojson';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { Template } from 'svelte-native/components';
    import { formatDistance, osmicon } from '~/helpers/formatter';
    import { getBoundsOfDistance, getMetersPerPixel } from '~/helpers/geolib';
    import { lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import type { Photon } from '~/photon';
    import { networkService, regionToOSMString } from '~/services/NetworkService';
    import type { GeoResult } from '~/services/PackageService';
    import { packageService } from '~/services/PackageService';
    import { computeDistanceBetween } from '~/utils/geo';
    import { arraySortOn } from '~/utils/utils';
    import { colors } from '~/variables';
    import { HereFeature, PhotonFeature } from './Features';
    import { onThemeChanged } from '~/helpers/theme';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { CollectionView } from '@nativescript-community/ui-collectionview';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    const dispatch = createEventDispatcher();
    export let dataItems: ObservableArray<SearchItem> = new ObservableArray();
    // export let filteringOSMKey = false;
    // export let filteredDataItems: SearchItem[] = dataItems;
    export let loading = false;
    let currentQuery;
    export let searchResultsCount = 0;
    const mapContext = getMapContext();

    // export function getFilteredDataItems() {
    //     return filteredDataItems;
    // }
    const PHOTON_SUPPORTED_LANGUAGES = ['en', 'de', 'fr'];

    const providerColors = {
        here: 'blue',
        carto: 'orange',
        photon: 'red'
    };
    function cleanUpString(s) {
        return new deburr.Deburr(s)
            .toString()
            .toLowerCase()
            .replace(/["'`]/g, ' ')
            .replace(/^(the|le|la|el)\s/, '')
            .trim();
    }

    interface SearchItem extends Item {
        geometry: Point;
        distance: number;
    }

    $: searchResultsCount = dataItems ? dataItems.length : 0;
    // $: updateFilteredDataItems(filteringOSMKey);

    // export function updateFilteredDataItems(filter) {
    //     if (filter) {
    //         filteredDataItems = dataItems.filter((d) => d.properties.osm_key === currentQuery);
    //     } else {
    //         filteredDataItems = dataItems as any;
    //     }
    // }
    function getItemIcon(item: SearchItem) {
        const icons = formatter.geItemIcon(item);
        return osmicon(icons);
    }
    function getItemIconColor(item: SearchItem) {
        return providerColors[item.properties.provider] || colorOnSurface;
    }
    function getItemTitle(item: SearchItem) {
        return formatter.getItemTitle(item);
    }
    function getItemSubtitle(item: SearchItem, title?: string) {
        return formatter.getItemSubtitle(item, title);
    }
    async function prepareItems(r: GeoResult[], callback) {
        if (!loading || r.length === 0) {
            // was cancelled
            return;
        }
        callback(
            r.map((s: SearchItem) => {
                const title = getItemTitle(s);
                return { ...s, color: getItemIconColor(s), icon: getItemIcon(s), title, subtitle: getItemSubtitle(s, title) || lc(s.properties.class) };
            })
        );
    }

    async function searchInGeocodingService(enabled: boolean, options) {
        if (!enabled) {
            return [];
        }
        let result: any = await packageService.searchInLocalGeocodingService(options);
        result = packageService.convertGeoCodingResults(result, true) as any;
        return arraySortOn(
            result.map((r) => {
                r['distance'] = computeDistanceBetween(options.position, {
                    lat: r.geometry.coordinates[1],
                    lon: r.geometry.coordinates[0]
                });
                return r;
            }),
            'distance'
        ) as GeoResult[];
    }
    async function searchInVectorTiles(enabled: boolean, options: SearchRequest) {
        if (!enabled) {
            return [];
        }
        // console.log('searchInVectorTiles', options)
        let result: GeoResult[] = (await packageService.searchInVectorTiles(options)) as any;
        if (result) {
            result = packageService.convertFeatureCollection(result as any, options);
        } else {
            result = [];
        }
        return result;
        // console.log('searchInVectorTiles result', result)
        // return arraySortOn(
        //     result.map((r) => {
        //         r['distance'] = computeDistanceBetween(options.position, {
        //             lat: r.geometry.coordinates[1],
        //             lon: r.geometry.coordinates[0]
        //         });
        //         return r;
        //     }),
        //     'distance'
        // ) as any as GeoResult[];
    }

    async function herePlaceSearch(enabled: boolean, options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number }) {
        if (!enabled) {
            return [];
        }
        const result = await networkService.request({
            url: 'https://places.cit.api.here.com/places/v1/discover/search',
            method: 'GET',
            queryParams: {
                q: options.query,
                app_id: gVars.HER_APP_ID,
                app_code: gVars.HER_APP_CODE,
                radius: options.locationRadius,
                tf: 'plain',
                show_content: 'wikipedia',
                lang: options.language,
                rankby: 'distance',
                limit: 40,
                at: options.location.lat + ',' + options.location.lon
                // in: options.locationRadius ? options.location.lat + ',' + options.location.lon + ';' + options.locationRadius : undefined
            }
        });
        if (result) {
            return result.results.items.map((f) => {
                const r = new HereFeature(f);
                if (options.location) {
                    r['distance'] = computeDistanceBetween(options.location, {
                        lat: r.geometry.coordinates[1],
                        lon: r.geometry.coordinates[0]
                    });
                }
                return r;
            });
        }
        return [];
    }
    async function photonSearch(enabled: boolean, options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number; bounds?: MapBounds<LatLonKeys> }) {
        if (!enabled) {
            return [];
        }
        let actualLang = (options.language || 'en').split('-')[0];
        if (PHOTON_SUPPORTED_LANGUAGES.indexOf(actualLang) === -1) {
            actualLang = 'en';
        }
        const results = await networkService.request<Photon>({
            url: 'https://photon.komoot.io/api',
            method: 'GET',
            queryParams: {
                q: options.query,
                lat: options.location && options.location.lat,
                lon: options.location && options.location.lon,
                lang: actualLang,
                limit: 40,
                bbox: options.bounds ? regionToOSMString(options.bounds) : undefined
            }
        });
        return arraySortOn(
            results.features
                .filter((r) => r.properties.osm_type !== 'R')
                .map((f) => {
                    const r = new PhotonFeature(f);
                    if (options.location) {
                        r['distance'] = computeDistanceBetween(options.location, {
                            lat: r.geometry.coordinates[1],
                            lon: r.geometry.coordinates[0]
                        });
                    }
                    return r;
                }),
            'distance'
        );
    }
    export async function instantSearch(_query, position = mapContext.getMap().focusPos) {
        try {
            loading = true;
            currentQuery = cleanUpString(_query);
            const mpp = getMetersPerPixel(position, mapContext.getMap().getZoom());
            const searchRadius = Math.min(Math.max(mpp * Screen.mainScreen.widthPixels * 2, mpp * Screen.mainScreen.heightPixels * 2), 50000); //meters;

            const options = {
                query: currentQuery,
                projection: mapContext.getProjection(),
                language: packageService.currentLanguage,
                // regexFilter: `.*${currentQuery}.*`,
                // filterExpression: `layer='transportation_name'`,
                filterExpression: `regexp_ilike(name,'.*${currentQuery}.*') OR regexp_ilike(class,'.*${currentQuery}.*')`,
                // filterExpression: `class='bakery'`,
                // `REGEXP_LIKE(name, '${_query}')`
                location: position,
                position,
                locationRadius: searchRadius,
                searchRadius,
                bounds: getBoundsOfDistance(position, searchRadius)
                // locationRadius: 1000,
            };
            DEV_LOG && console.log('instantSearch', position, mapContext.getMap().getZoom(), mpp, options);
            dataItems = new ObservableArray();

            // TODO: dont fail when offline!!!

            function addItems(items: SearchItem[]) {
                if (dataItems.length === 0) {
                    dataItems = new ObservableArray(items);
                } else {
                    items.forEach((item) => {
                        const index = dataItems.findIndex((i) => i.distance > item.distance);
                        if (index >= 0) {
                            dataItems.splice(index, 0, item);
                        } else {
                            dataItems.push(item);
                        }
                    });
                    searchResultsCount = dataItems ? dataItems.length : 0;
                    // dataItems = dataItems.concat(items);
                }
                // updateFilteredDataItems(filteringOSMKey);
            }
            const searchInTiles = ApplicationSettings.getBoolean('searchInTiles', true);
            const searchInGeocoding = ApplicationSettings.getBoolean('searchInGeocoding', true);
            const searchUsingHere = networkService.connected && ApplicationSettings.getBoolean('searchUsingHere', false);
            const searchUsingPhoton = networkService.connected && ApplicationSettings.getBoolean('searchUsingPhoton', true);
            await Promise.all([
                searchInGeocodingService(searchInGeocoding, options)
                    .then((r) => prepareItems(r, addItems))
                    .catch((err) => console.error('searchInGeocodingService', err)),
                searchInVectorTiles(searchInTiles, { ...options, searchRadius: Math.min(options.searchRadius, 50000) })
                    .then((r) => prepareItems(r, addItems))
                    .catch((err) => console.error('searchInVectorTiles', err, err.stack)),
                herePlaceSearch(searchUsingHere, options)
                    .then((r) => prepareItems(r, addItems))
                    .catch((err) => console.error('herePlaceSearch', err, err.stack)),
                photonSearch(searchUsingPhoton, options as any)
                    .then((r) => prepareItems(r, addItems))
                    .catch((err) => console.error('photonSearch', err, err.stack))
            ]);
            if (dataItems.length === 0) {
                showSnack({ message: l('no_result_found') });
                // } else {
                // await loadView();
            } else {
            }
        } catch (err) {
            throw err;
        } finally {
            loading = false;
        }
    }
    export function clearSearch(clearQuery = true) {
        loading = false;
        dataItems = new ObservableArray();
        // filteredDataItems = [];
        if (clearQuery) {
            currentQuery = null;
        }
    }
    let collectionView: NativeViewElementNode<CollectionView>;
    function refreshCollectionView() {
        collectionView?.nativeView.refresh();
    }
    onThemeChanged(refreshCollectionView);
</script>

<collectionview bind:this={collectionView} items={dataItems} rowHeight={52} {...$$restProps}>
    <Template let:item>
        <canvaslabel color={colorOnSurface} columns="34,*" disableCss={true} padding="0 10 0 10" rippleColor={colorOnSurface} rows="*,auto,auto,*" on:tap={() => dispatch('tap', item)}>
            <cspan color={item.color} fontFamily="osm" fontSize={20} text={item.icon} verticalAlignment="middle" />
            <cgroup paddingLeft={34} paddingRight={34} verticalAlignment="middle">
                <cspan fontSize={13} fontWeight="bold" text={item.title} />
                <cspan color={colorOnSurfaceVariant} fontSize={11} text={!!item.subtitle ? '\n' + item.subtitle : null} visibility={!!item.subtitle ? 'visible' : 'collapse'} />
            </cgroup>
            <cspan
                color={colorOnSurfaceVariant}
                fontSize={12}
                paddingTop={10}
                text={item.distance && formatDistance(item.distance)}
                textAlignment="right"
                verticalAlignment="top"
                visibility={'distance' in item ? 'visible' : 'collapse'} />
        </canvaslabel>
    </Template>
</collectionview>
