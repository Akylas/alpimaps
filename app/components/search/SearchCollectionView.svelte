<script lang="ts">
    import { l } from '@nativescript-community/l';
    import { GenericMapPos, MapBounds, MapPos } from '@nativescript-community/ui-carto/core';
    import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
    import { SearchRequest, VectorTileSearchServiceOptions } from '@nativescript-community/ui-carto/search';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { ApplicationSettings, ObservableArray, Screen } from '@nativescript/core';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import deburr from 'deburr';
    import type { Point as GeoJSONPoint } from 'geojson';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoLocation } from '~/handlers/GeoHandler';
    import { formatDistance, osmicon } from '~/helpers/formatter';
    import { getBoundsOfDistance, getDistance, getDistanceSimple, getMetersPerPixel } from '~/helpers/geolib';
    import { lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import type { Photon } from '~/photon';
    import { networkService, regionToOSMString } from '~/services/NetworkService';
    import type { GeoResult } from '~/services/PackageService';
    import { packageService } from '~/services/PackageService';
    import { computeDistanceBetween } from '~/utils/geo';
    import { showSnack } from '~/utils/ui';
    import { arraySortOn } from '~/utils/utils';
    import { colors } from '~/variables';
    import { HereFeature, PhotonFeature } from './Features';

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
        geometry: GeoJSONPoint;
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
                return { ...s, style: { color: getItemIconColor(s), icon: getItemIcon(s) }, title, subtitle: getItemSubtitle(s, title) || lc(s.properties.class) };
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
    async function searchInVectorTiles(enabled: boolean, options: SearchRequest & VectorTileSearchServiceOptions & { bounds?: IMapBounds }) {
        if (!enabled) {
            return [];
        }
        const result = await packageService.searchInVectorTiles(options);
        if (result) {
            return packageService.convertFeatureCollection(result, options);
        } else {
            return [];
        }
    }

    async function herePlaceSearch(enabled: boolean, options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number }) {
        if (!enabled) {
            return [];
        }
        const result = await networkService.request({
            url: 'https://places.cit.api.here.com/places/v1/discover/search',
            tag: 'here',
            method: 'GET',
            queryParams: {
                q: options.query,
                app_id: HER_APP_ID,
                app_code: HER_APP_CODE,
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
            tag: 'photon',
            method: 'GET',
            queryParams: {
                q: options.query,
                lat: options.location && options.location.lat,
                lon: options.location && options.location.lon,
                lang: actualLang,
                limit: 40,
                // bbox: options.bounds ? regionToOSMString(options.bounds) : undefined
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
    export async function instantSearch(_query, position?: GenericMapPos<LatLonKeys>, item?: Item) {
        try {
            loading = true;
            currentQuery = cleanUpString(_query);
            let bounds: MapBounds<LatLonKeys>;
            if (!position) {
                if (item) {
                    if (item.properties?.zoomBounds) {
                        bounds = item.properties.zoomBounds;
                    } else if (item.properties?.extent) {
                        let extent: [number, number, number, number] = item.properties.extent as [number, number, number, number];
                        if (typeof extent === 'string') {
                            if (extent[0] !== '[') {
                                extent = `[${extent as string}]` as any;
                            }
                            extent = JSON.parse(extent as any);
                        }
                        bounds = new MapBounds({ lat: extent[1], lon: extent[0] }, { lat: extent[3], lon: extent[2] });
                    } else if (item.route) {
                        const geometry = packageService.getRouteItemGeometry(item);
                        //we need to convert geometry bounds to wgs84
                        //not perfect as vectorTile geometry might not represent the whole entier route at higher zoom levels
                        bounds = geometry?.getBounds();
                    } else {
                        const geometry = item.geometry as GeoJSONPoint;
                        position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                    }
                    if (bounds && !position) {
                        position = { lat: bounds.southwest.lat + (bounds.northeast.lat - bounds.southwest.lat) / 2, lon: bounds.southwest.lon + (bounds.northeast.lon - bounds.southwest.lon) / 2 };
                    }
                } else {
                    position = mapContext.getMap().focusPos;
                }
            }

            const mpp = getMetersPerPixel(position, mapContext.getMap().getZoom());
            const searchRadius = bounds
                ? Math.max(getDistanceSimple(position, { lat: bounds.southwest.lat, lon: position.lon }), getDistanceSimple(position, { lon: bounds.southwest.lon, lat: position.lat })) + 1000
                : Math.min(Math.max(mpp * Screen.mainScreen.widthPixels * 2, mpp * Screen.mainScreen.heightPixels * 2), 50000); //meters;
            DEV_LOG && console.log('instantSearch', currentQuery, !!item, position, bounds, searchRadius);
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
                bounds: bounds || getBoundsOfDistance(position, searchRadius) // only for Photon
                // locationRadius: 1000,
            };
            // DEV_LOG && console.log('instantSearch', JSON.stringify(position), mapContext.getMap().getZoom(), mpp, JSON.stringify(options));
            let newDataItems = new ObservableArray<SearchItem>();

            function addItems(items: SearchItem[]) {
                if (newDataItems.length === 0) {
                    dataItems = newDataItems = new ObservableArray(items);
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
            if (/^(class|subclass)/.test(currentQuery)) {
                bounds = bounds || mapContext.getMap().getMapBounds();
                DEV_LOG && console.log('bounds', bounds);

                const zoom = /peak|campsite/.test(currentQuery) ? 11 : 14;
                const geometry = new LineGeometry<LatLonKeys>({
                    poses: [bounds.northeast, { lat: bounds.southwest.lat, lon: bounds.northeast.lon }, { lat: bounds.southwest.lat, lon: bounds.southwest.lon }, bounds.northeast]
                });
                const array = currentQuery.split(':');
                await searchInVectorTiles(true, {
                    projection: options.projection,
                    geometry,
                    bounds,
                    minZoom: zoom,
                    maxZoom: zoom,
                    filterExpression: `regexp_ilike(${array[0]},'.*${array[1]}.*')`
                    // layers: ['poi', 'mountain_peak']
                })
                    .then((r) => prepareItems(r, addItems))
                    .catch((err) => console.error('searchInVectorTiles', err, err.stack));
            } else {
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
            }
            if (newDataItems.length === 0) {
                dataItems = newDataItems;
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
        // DEV_LOG && console.log('clearSearch', clearQuery, new Error().stack);
        networkService.clearRequests('photon', 'here');
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
            <cspan color={item.style.color} fontFamily="osm" fontSize={20} text={item.style.icon} verticalAlignment="middle" />
            <cgroup paddingLeft={34} paddingRight={80} verticalAlignment="middle">
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
