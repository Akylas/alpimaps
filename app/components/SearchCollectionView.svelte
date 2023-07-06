<script lang="ts">
    import { l } from '@nativescript-community/l';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { SearchRequest } from '@nativescript-community/ui-carto/search';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { Screen } from '@nativescript/core';
    import { getJSON } from '@nativescript/core/http';
    import deburr from 'deburr';
    import type { Point } from 'geojson';
    import { createEventDispatcher } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { formatDistance, osmicon } from '~/helpers/formatter';
    import { getMetersPerPixel } from '~/helpers/geolib';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import type { Photon } from '~/photon';
    import { networkService } from '~/services/NetworkService';
    import type { GeoResult } from '~/services/PackageService';
    import { packageService } from '~/services/PackageService';
    import { computeDistanceBetween } from '~/utils/geo';
    import { queryString } from '~/utils/http';
    import { arraySortOn } from '~/utils/utils';
    import { subtitleColor, textColor } from '~/variables';
    import { HereFeature, PhotonFeature } from './Features';
    const dispatch = createEventDispatcher();
    let dataItems: SearchItem[] = [];
    export let filteringOSMKey = false;
    export let filteredDataItems: SearchItem[] = dataItems;
    export let loading = false;
    const mapContext = getMapContext();

    export function getFilteredDataItems() {
        return filteredDataItems;
    }

    const providerColors = {
        here: 'blue',
        carto: 'orange',
        photon: 'red'
    };
    function cleanUpString(s) {
        return new deburr.Deburr(s)
            .toString()
            .toLowerCase()
            .replace(/^(the|le|la|el)\s/, '')
            .trim();
    }

    interface SearchItem extends Item {
        geometry: Point;
    }
    let currentQuery;

    export let searchResultsCount = 0;
    $: {
        searchResultsCount = dataItems ? dataItems.length : 0;
    }
    $: updateFilteredDataItems(filteringOSMKey);

    export function updateFilteredDataItems(filter) {
        if (filter) {
            filteredDataItems = dataItems.filter((d) => d.properties.osm_key === currentQuery);
        } else {
            filteredDataItems = dataItems as any;
        }
    }
    function getItemIcon(item: SearchItem) {
        const icons = formatter.geItemIcon(item);
        return osmicon(icons);
    }
    function getItemIconColor(item: SearchItem) {
        return providerColors[item.properties.provider] || $textColor;
    }
    function getItemTitle(item: SearchItem) {
        return formatter.getItemTitle(item);
    }
    function getItemSubtitle(item: SearchItem, title?: string) {
        return formatter.getItemSubtitle(item, title);
    }
    async function addItems(r: GeoResult[], callback) {
        if (!loading || r.length === 0) {
            // was cancelled
            return;
        }
        callback(
            r.map((s: SearchItem) => {
                const title = getItemTitle(s);
                return { ...s, color: getItemIconColor(s), icon: getItemIcon(s), title, subtitle: getItemSubtitle(s, title) };
            })
        );
    }

    async function searchInGeocodingService(options) {
        let result: any = await packageService.searchInLocalGeocodingService(options);
        result = packageService.convertGeoCodingResults(result, true) as any;
        return arraySortOn(result, 'rank').reverse() as any as GeoResult[];
    }
    async function searchInVectorTiles(options: SearchRequest) {
        let result: GeoResult[] = (await packageService.searchInVectorTiles(options)) as any;
        if (result) {
            result = packageService.convertFeatureCollection(result as any, options);
        } else {
            result = [];
        }
        return arraySortOn(
            result.map((r) => {
                r['distance'] = computeDistanceBetween(options.position, {
                    lat: r.geometry.coordinates[1],
                    lon: r.geometry.coordinates[0]
                });
                return r;
            }),
            'distance'
        ) as any as GeoResult[];
    }

    async function herePlaceSearch(options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number }) {
        if (!networkService.connected) {
            return [];
        }
        return getJSON(
            queryString(
                {
                    q: options.query,
                    app_id: gVars.HER_APP_ID,
                    app_code: gVars.HER_APP_CODE,
                    radius: options.locationRadius,
                    tf: 'plain',
                    show_content: 'wikipedia',
                    lang: options.language,
                    // rankby: 'distance',
                    limit: 40,
                    at: !options.locationRadius ? options.location.lat + ',' + options.location.lon + ';' + options.locationRadius : undefined,
                    in: options.locationRadius ? options.location.lat + ',' + options.location.lon + ';' + options.locationRadius : undefined
                },
                'https://places.cit.api.here.com/places/v1/discover/search'
            )
        ).then((result: any) =>
            result.results.items.map((f) => {
                const r = new HereFeature(f);
                if (options.location) {
                    r['distance'] = computeDistanceBetween(options.location, {
                        lat: r.geometry.coordinates[1],
                        lon: r.geometry.coordinates[0]
                    });
                }
                return r;
            })
        );
    }
    async function photonSearch(options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number }) {
        if (!networkService.connected) {
            return [];
        }
        const results = await networkService.request<Photon>({
            url: 'https://photon.komoot.io/api',
            method: 'GET',
            queryParams: {
                q: options.query,
                lat: options.location && options.location.lat,
                lon: options.location && options.location.lon,
                lang: options.language,
                limit: 40
            }
        });
        return results.features
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
            });
    }
    export async function instantSearch(_query, position = mapContext.getMap().focusPos) {
        try {
            loading = true;
            currentQuery = cleanUpString(_query);
            const mpp = getMetersPerPixel(position, mapContext.getMap().getZoom());
            const options = {
                query: currentQuery,
                projection: mapContext.getProjection(),
                language: packageService.currentLanguage,
                // regexFilter: `.*${currentQuery}.*`,
                // filterExpression: `layer='transportation_name'`,
                filterExpression: `regexp_ilike(name,'.*${currentQuery}.*')`,
                // filterExpression: `class='bakery'`,
                // `REGEXP_LIKE(name, '${_query}')`
                location: position,
                position,
                searchRadius: Math.min(Math.max(mpp * Screen.mainScreen.widthPixels, mpp * Screen.mainScreen.heightPixels)) //meters
                // locationRadius: 1000,
            };
            // console.log('instantSearch', position, mapContext.getMap().getZoom(), mpp, options);

            // TODO: dont fail when offline!!!

            let newItems;

            function onItemAdded(items) {
                if (!newItems) {
                    dataItems = newItems = items;
                } else {
                    dataItems = dataItems.concat(items);
                }
                updateFilteredDataItems(filteringOSMKey);
            }

            await Promise.all([
                // searchInVectorTiles({
                //     ...options,
                //     filterExpression: undefined,
                //     // filterExpression: `layer='poi'`,
                //     regexFilter: currentQuery,
                //     searchRadius: Math.min(options.searchRadius, 10000) //meters
                // })
                //     .then((r) => loading && r && result.push(...r))
                //     .catch((err) => {
                //         console.error('searchInVectorTiles', err);
                //     }),
                searchInGeocodingService(options)
                    .then((r) => addItems(r, onItemAdded))
                    .catch((err) => console.error('searchInGeocodingService', err)),
                herePlaceSearch(options)
                    .then((r) => addItems(r, onItemAdded))
                    .catch((err) => console.error('herePlaceSearch', err, err.stack)),
                photonSearch(options)
                    .then((r) => addItems(r, onItemAdded))
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
        dataItems = [];
        filteredDataItems = [];
        if (clearQuery) {
            currentQuery = null;
        }
    }
</script>

<collectionview rowHeight={52} items={filteredDataItems} {...$$restProps}>
    <Template let:item>
        <canvaslabel columns="34,*" padding="0 10 0 10" rows="*,auto,auto,*" disableCss={true} color={$textColor} rippleColor={$textColor} on:tap={(event) => dispatch('tap', item)}>
            <cspan text={item.icon} color={item.color} fontFamily="osm" fontSize={20} verticalAlignment="middle" />
            <cgroup  paddingLeft={34}  paddingRight={34}  verticalAlignment="middle" lineBreak="end">
                <cspan text={item.title} fontSize={13} fontWeight="bold" />
                <cspan text={!!item.subtitle ? '\n' + item.subtitle : null} color={$subtitleColor} fontSize={11} visibility={!!item.subtitle ? 'visible' : 'collapsed'} />
                
            </cgroup>
            <cspan
                textAlignment="right"
                verticalAlignment="top"
                paddingTop={10}
                text={item.distance && formatDistance(item.distance)}
                color={$subtitleColor}
                fontSize={12}
                visibility={'distance' in item ? 'visible' : 'collapsed'}
            />
        </canvaslabel>
    </Template>
</collectionview>
