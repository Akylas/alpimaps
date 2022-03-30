<script lang="ts">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { ClusterElementBuilder } from '@nativescript-community/ui-carto/layers/cluster';
    import { ClusteredVectorLayer } from '@nativescript-community/ui-carto/layers/vector';
    import type { SearchRequest } from '@nativescript-community/ui-carto/search';
    import { PointStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/point';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import type { Side } from '@nativescript-community/ui-drawer';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { GridLayout, Screen, TextField } from '@nativescript/core';
    import { getJSON } from '@nativescript/core/http';
    import { Point } from 'geojson';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { formatDistance, osmicon } from '~/helpers/formatter';
    import { getMetersPerPixel } from '~/helpers/geolib';
    import { l, slc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { GeoResult, packageService } from '~/services/PackageService';
    import { showError } from '~/utils/error';
    import { computeDistanceBetween } from '~/utils/geo';
    import { arraySortOn } from '~/utils/utils';
    import { globalMarginTop, primaryColor, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
    import { queryString } from '../utils/http';
    import deburr from 'deburr';
import { dismissSoftInput } from '@nativescript/core/utils';
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

    // class PhotonAddress {
    //     constructor(private properties) {}
    //     get road() {
    //         if (this.properties['osm_key'] === 'highway') {
    //             return this.properties.name;
    //         }
    //         return this.properties.street;
    //     }
    //     get country() {
    //         return this.properties.country;
    //     }
    //     get county() {
    //         return this.properties.county;
    //     }
    //     get name() {
    //         if (this.properties.name === this.properties.city && !!this.properties.stret) {
    //             return undefined;
    //         }
    //         return this.properties.name;
    //     }
    //     // get categories() {
    //     //     return categories;
    //     // }
    //     get neighbourhood() {
    //         return this.properties.neighbourhood;
    //     }
    //     get postcode() {
    //         return this.properties.postcode;
    //     }
    //     get houseNumber() {
    //         return this.properties.housenumber;
    //     }
    //     get region() {
    //         return this.properties.region;
    //     }
    //     get locality() {
    //         return this.properties.city;
    //     }
    // }
    class PhotonFeature {
        properties: { [k: string]: any };
        public geometry!: Point;
        constructor(data) {
            const properties = data.properties || {};
            const actualName = properties.name === properties.city ? undefined : properties.name;
            const { region, name, state, street, housenumber, postcode, city, country, neighbourhood, ...actualProperties } = properties;
            actualProperties.address = {
                state,
                provider: 'photon',
                county: region,
                houseNumber: housenumber,
                postcode,
                city,
                country,
                street: properties['osm_key'] === 'highway' ? name : street,
                neighbourhood
            };
            actualProperties.name = actualName;
            this.properties = actualProperties;
            this.geometry = data.geometry;
        }
    }
    class HereFeature {
        properties: { [k: string]: any };
        public geometry!: Point;
        constructor(data) {
            this.properties = {
                provider: 'here',
                id: data.id,
                name: data.title,
                osm_key: data.category.id ? data.category.id.split('-')[0] : undefined,
                // vicinity: data.vicinity,
                // averageRating: data.averageRating,
                categories: data.category.id.split('-'),
                address: { name: data.vicinity }
            };
            this.geometry = {
                type: 'Point',
                coordinates: data.position.reverse()
            };
        }
    }

    interface SearchItem extends Item {
        geometry: Point;
    }

    let gridLayout: NativeViewElementNode<GridLayout>;
    let textField: NativeViewElementNode<TextField>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let _searchDataSource: LocalVectorDataSource<LatLonKeys>;
    let _searchLayer: ClusteredVectorLayer;
    let searchClusterStyle: PointStyleBuilder;
    let searchAsTypeTimer;
    let dataItems: SearchItem[];
    let filteredDataItems: SearchItem[] = dataItems as any;
    let loading = false;
    let filteringOSMKey = false;
    let text: string = null;
    let currentSearchText: string = null;
    const mapContext = getMapContext();

    export function getNativeView() {
        return gridLayout && gridLayout.nativeView;
    }

    function getSearchDataSource() {
        if (!_searchDataSource) {
            const projection = mapContext.getProjection();
            _searchDataSource = new LocalVectorDataSource<LatLonKeys>({ projection });
        }
        return _searchDataSource;
    }
    // function buildClusterElement(position: MapPos, elements: VectorElementVector) {
    //     if (!searchClusterStyle) {
    //         searchClusterStyle = new PointStyleBuilder({
    //             // hideIfOverlapped: false,
    //             size: 12,
    //             color: 'red'
    //         }).buildStyle();
    //     }

    //     return new Point({
    //         position,
    //         styleBuilder: searchClusterStyle
    //     });
    // }
    function itemToMetaData(item: Item) {
        const result = {};
        Object.keys(item).forEach((k) => {
            if (item[k] !== null && item[k] !== undefined && k !== 'data') {
                result[k] = JSON.stringify(item[k]);
            }
        });
        return result;
    }
    // function createSearchMarker(item: SearchItem) {
    //     const metaData = itemToMetaData(item);
    //     return new Marker({
    //         position: { lat: item.geometry.coordinates[1], lon: item.geometry.coordinates[0] },
    //         styleBuilder: {
    //             hideIfOverlapped: false,
    //             clickSize: 20,
    //             size: 20,
    //             scaleWithDPI: true,
    //             color: providerColors[item.properties.provider]
    //         },
    //         metaData
    //     });
    // }
    function getSearchLayer() {
        if (!_searchLayer) {
            _searchLayer = new ClusteredVectorLayer({
                visibleZoomRange: [0, 24],
                dataSource: getSearchDataSource(),
                minimumClusterDistance: 30,
                builder: new ClusterElementBuilder({
                    color: 'red',
                    // textColor: 'white',
                    textSize: 15,
                    size: 20,
                    bbox: true,
                    shape: 'point'
                })
            });
            _searchLayer.setVectorElementEventListener<LatLonKeys>({
                onVectorElementClicked: (data) => mapContext.vectorElementClicked(data)
            });
            mapContext.addLayer(_searchLayer, 'search');
        }
        return _searchLayer;
    }
    function ensureSearchLayer() {
        return getSearchLayer() !== null;
    }
    let searchResultsVisible = false;
    $: {
        searchResultsVisible = focused && searchResultsCount > 0;
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
    function getItemSubtitle(item: SearchItem) {
        return formatter.getItemSubtitle(item);
    }

    onDestroy(() => {
        if (_searchDataSource) {
            _searchDataSource.clear();
            _searchDataSource = null;
        }
        if (_searchLayer) {
            _searchLayer.setVectorElementEventListener(null);
            _searchLayer = null;
        }
    });

    let searchResultsCount = 0;
    $: {
        searchResultsCount = dataItems ? dataItems.length : 0;
    }
    let focused = false;
    export function hasFocus() {
        return focused;
    }
    function onFocus(e) {
        focused = true;
        if (currentSearchText && searchResultsCount === 0) {
            instantSearch(currentSearchText);
        }
    }
    function onBlur(e) {
        focused = false;
    }

    export function searchForQuery(query) {
        textField.nativeView.text = query;
        setTimeout(() => {
            textField.nativeView.focus();
        }, 100);
    }

    function onReturnKey() {
        if (searchAsTypeTimer) {
            clearTimeout(searchAsTypeTimer);
            searchAsTypeTimer = null;
        }
        instantSearch(text);
    }
    $: {
        const query = text;
        if (query !== currentSearchText) {
            if (query) {
                if (searchAsTypeTimer) {
                    clearTimeout(searchAsTypeTimer);
                    searchAsTypeTimer = null;
                }
                if (query && query.length > 2) {
                    searchAsTypeTimer = setTimeout(() => {
                        searchAsTypeTimer = null;
                        instantSearch(query);
                    }, 1000);
                } else {
                    if (searchAsTypeTimer) {
                        clearTimeout(searchAsTypeTimer);
                        searchAsTypeTimer = null;
                    }
                    dataItems = [] as any;
                    if (query.length === 0 && currentSearchText && currentSearchText.length > 0) {
                        unfocus();
                    }
                }
            }
            currentSearchText = query;
        }
    }

    async function searchInGeocodingService(options) {
        let result: any = await packageService.searchInLocalGeocodingService(options);
        result = packageService.convertGeoCodingResults(result, true) as any;
        return arraySortOn(result, 'rank').reverse() as any as GeoResult[];
    }
    async function searchInVectorTiles(options: SearchRequest) {
        // console.log('searchInVectorTiles', options);
        let result: any = await packageService.searchInVectorTiles(options);
        if (result) {
            result = packageService.convertFeatureCollection(result, options) as any;
        } else {
            result = [];
        }
        return arraySortOn(
            result.map((r) => {
                r.distance = computeDistanceBetween(options.position, r.position);
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
        ).then((result: any) => result.results.items.map((f) => new HereFeature(f)));
    }
    async function photonSearch(options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number }) {
        if (!networkService.connected) {
            return [];
        }
        const url = queryString(
            {
                q: options.query,
                lat: options.location && options.location.lat,
                lon: options.location && options.location.lon,
                lang: options.language,
                limit: 40
            },
            'https://photon.komoot.io/api'
        );
        return getJSON(url).then(function (results: any) {
            return results.features.filter((r) => r.properties.osm_type !== 'R').map((f) => new PhotonFeature(f));
        });
    }
    let currentQuery;
    async function instantSearch(_query) {
        // console.log('instantSearch', _query,loading) ;
        loading = true;
        currentQuery = cleanUpString(_query);
        const position = mapContext.getMap().focusPos;
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

        let result = [];
        try {
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
                    .then((r) => loading && r && result.push(...r))
                    .catch((err) => {
                        console.error('searchInGeocodingService', err);
                    }),
                herePlaceSearch(options)
                    .then((r) => loading && r && result.push(...r))
                    .catch((err) => {
                        console.error('herePlaceSearch', err, err.stack);
                    }),
                photonSearch(options)
                    .then((r) => loading && r && result.push(...r))
                    .catch((err) => {
                        console.error('photonSearch', err, err.stack);
                    })
            ]);

            // console.log('search done', result.length, JSON.stringify(result));
            if (!loading) {
                // was cancelled
                return;
            }
            if (result.length === 0) {
                showSnack({ message: l('no_result_found') });
            } else {
                await loadView();
            }
            let now = Date.now();
            dataItems = result.map((s) => ({ ...s, color: getItemIconColor(s), icon: getItemIcon(s), title: getItemTitle(s), subtitle: getItemSubtitle(s) }));
            updateFilteredDataItems();
        } catch (err) {
            showError(err);
        } finally {
            loading = false;
        }
    }
    function clearSearch() {
        loading = false;
        if (searchAsTypeTimer) {
            clearTimeout(searchAsTypeTimer);
            searchAsTypeTimer = null;
        }
        dataItems = [] as any;
        currentSearchText = null;
        currentQuery = null;
        textField.nativeView.text = null;
        showingOnMap = false;
        if (_searchDataSource) {
            mapContext.unselectItem(); // TODO: only if selected one!
            _searchDataSource.clear();
            _searchDataSource = null;
        }
        if (_searchLayer) {
            mapContext.removeLayer(_searchLayer, 'search');
            _searchLayer.setVectorElementEventListener(null);
            _searchLayer = null;
        }
    }
    export function unfocus() {
        if (searchAsTypeTimer) {
            clearTimeout(searchAsTypeTimer);
            searchAsTypeTimer = null;
        }
        textField.nativeView.clearFocus();
    }

    function focus() {
        textField.nativeView.focus();
    }

    function showMenu(side: Side = 'left') {
        unfocus();
        mapContext.toggleMenu(side);
    }

    function showMapMenu() {
        mapContext.showOptions();
    }
    function onItemTap(item: SearchItem) {
        if (!item) {
            return;
        }
        mapContext.selectItem({ item, isFeatureInteresting: true, minZoom: 14, preventZoom: false });
        unfocus();
    }
    function updateFilteredDataItems() {
        if (filteringOSMKey) {
            filteredDataItems = dataItems.filter((d) => d.properties.osm_key === currentQuery);
        } else {
            filteredDataItems = dataItems as any;
        }
    }
    function toggleFilterOSMKey() {
        filteringOSMKey = !filteringOSMKey;
        updateFilteredDataItems();
        if (showingOnMap) {
            showResultsOnMap();
        }
    }
    let showingOnMap = false;
    let searchStyle: PointStyleBuilder;
    function showResultsOnMap() {
        const dataSource = getSearchDataSource();
        showingOnMap = true;
        // const items = filteredDataItems.filter(
        //     // (d) => !!d && (d.provider === 'here' || (d.provider === 'carto' && d.properties.layer === 'poi'))
        //     (d) => !!d && (d.properties.provider === 'here' || d.properties.provider === 'carto')
        // );
        // if (items.length === 0) {
        //     return;
        // }
        const geojson = {
            type: 'FeatureCollection',
            features: filteredDataItems.map((s) => ({ type: 'Feature', ...s }))
        };
        if (!searchStyle) {
            searchStyle = new PointStyleBuilder({ color: 'red', size: 10 });
        }
        const featureCollection = packageService.getGeoJSONReader().readFeatureCollection(JSON.stringify(geojson));
        dataSource.clear();
        dataSource.addFeatureCollection(featureCollection, searchStyle);
        // items.forEach((d) => {
        //     dataSource.add(createSearchMarker(d));
        // });
        ensureSearchLayer();
        unfocus();
        const mapBounds = featureCollection.getBounds();
        mapContext.getMap().moveToFitBounds(mapBounds, undefined, false, false, false, 100);
    }

    let loaded = false;
    let loadedListeners = [];
    async function loadView() {
        if (!loaded) {
            await new Promise((resolve) => {
                loadedListeners.push(resolve);
                loaded = true;
            });
        }
    }
    $: {
        if (collectionView) {
            loadedListeners.forEach((l) => l());
        }
    }
</script>

<gridlayout
    id="search"
    bind:this={gridLayout}
    {...$$restProps}
    rows="auto,auto"
    columns="auto,*,auto,auto,auto,auto,auto"
    backgroundColor={$widgetBackgroundColor}
    borderRadius={searchResultsVisible ? 10 : 25}
    margin={`${globalMarginTop + 10} 10 10 10`}
>
    <button variant="text" class="icon-btn" text="mdi-magnify" on:tap={() => showMenu('left')} />
    <textfield
        bind:this={textField}
        variant="none"
        col={1}
        padding="0 15 0 0"
        hint={$slc('search')}
        placeholder={$slc('search')}
        returnKeyType="search"
        on:focus={onFocus}
        on:blur={onBlur}
        on:return={onReturnKey}
        text={text} on:textChange={e => text = e['value']}
        backgroundColor="transparent"
        autocapitalizationType="none"
        floating="false"
        verticalTextAlignment="center"
    />
    <mdactivityindicator visibility={loading ? 'visible' : 'collapsed'} col={2} busy={true} width={20} height={20} />
    {#if loaded}
        <button
            variant="text"
            class="small-icon-btn"
            visibility={searchResultsVisible ? 'visible' : 'collapsed'}
            col={3}
            text="mdi-shape"
            on:tap={toggleFilterOSMKey}
            color={filteringOSMKey ? primaryColor : $subtitleColor}
        />
        <button variant="text" class="small-icon-btn" visibility={searchResultsVisible ? 'visible' : 'collapsed'} col={4} text="mdi-map" on:tap={showResultsOnMap} color={$subtitleColor} />
    {/if}
    <button
        variant="text"
        class="icon-btn"
        visibility={currentSearchText && currentSearchText.length > 0 ? 'visible' : 'collapsed'}
        col={5}
        text="mdi-close"
        on:tap={clearSearch}
        color={$subtitleColor}
    />
    <button col={6} variant="text" class="icon-btn" text="mdi-dots-vertical" on:tap={showMapMenu} />
    {#if loaded}
        <collectionview bind:this={collectionView} row={1} height="200" colSpan={7} rowHeight="49" items={filteredDataItems} visibility={searchResultsVisible ? 'visible' : 'collapsed'}>
            <Template let:item>
                <gridlayout columns="34,*" padding="0 10 0 10" rows="*,auto,auto,*" class="textRipple" on:tap={() => onItemTap(item)}>
                    <label rowSpan={4} text={item.icon} color={item.color} class="osm" fontSize="20" verticalAlignment="center" textAlignment="center" />
                    <label col={1} row={1} text={item.title} fontSize="14" fontWeight="bold" />
                    <label
                        col={1}
                        row={2}
                        text={item.subtitle || (item.distance && formatDistance(item.distance))}
                        class="subtitle"
                        fontSize="12"
                        visibility={!!item.subtitle || 'distance' in item ? 'visible' : 'collapsed'}
                    />
                    <label col={1} rowSpan={2} text={item.provider} class="subtitle" textAlignment="right" fontSize="12" />
                </gridlayout>
            </Template>
        </collectionview>
    {/if}
</gridlayout>
