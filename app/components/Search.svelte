<script context="module" lang="ts">
    import { MapPos } from '@nativescript-community/ui-carto/core';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { ClusterElementBuilder } from '@nativescript-community/ui-carto/layers/cluster';
    import { ClusteredVectorLayer } from '@nativescript-community/ui-carto/layers/vector';
    import { VectorElementVector } from '@nativescript-community/ui-carto/vectorelements';
    import { Marker } from '@nativescript-community/ui-carto/vectorelements/marker';
    import { Point, PointStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/point';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Side } from '@nativescript-community/ui-drawer';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { GridLayout, ObservableArray, TextField } from '@nativescript/core';
    import { getJSON } from '@nativescript/core/http';
    import { fonticon } from 'nativescript-akylas-fonticon';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { l } from '~/helpers/locale';
    import ItemFormatter, { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Address, IItem as Item } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { globalMarginTop, primaryColor } from '~/variables';
    import { queryString } from '../utils/http';

    const providerColors = {
        here: 'blue',
        carto: 'orange',
        photon: 'red'
    };
    const deburr = require('deburr');
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
        position: MapPos<LatLonKeys>;
        address: Address;
        provider = 'photon';
        constructor(data) {
            const properties = data.properties || {};
            const actualName = properties.name === properties.city ? undefined : properties.name;
            const {
                region,
                name,
                state,
                street,
                housenumber,
                postcode,
                city,
                country,
                neighbourhood,
                ...actualProperties
            } = properties;
            this.address = {
                region,
                houseNumber: housenumber,
                postcode,
                county: city,
                country,
                state,
                road: properties['osm_key'] === 'highway' ? name : street,
                neighbourhood
            };
            this.properties = actualProperties;
            properties.name = actualName;
            this.position = { lat: data.geometry.coordinates[1], lon: data.geometry.coordinates[0] };
        }
    }
    class HereFeature {
        showOnMap = true;
        properties: { [k: string]: any };
        position: MapPos<LatLonKeys>;
        address: Address;
        categories?: string[];
        provider = 'here';
        constructor(data) {
            this.properties = {
                id: data.id,
                name: data.title,
                osm_key: data.category.id ? data.category.id.split('-')[0] : undefined,
                vicinity: data.vicinity,
                averageRating: data.averageRating
            };
            this.categories = [data.category.id];
            this.position = { lat: data.position[0], lon: data.position[1] };
            this.address = { name: data.vicinity };
        }
    }

    interface SearchItem extends Item {
        showOnMap?: boolean;
    }
</script>

<script lang="ts">
    let gridLayout: NativeViewElementNode<GridLayout>;
    let textField: NativeViewElementNode<TextField>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let _searchDataSource: LocalVectorDataSource<LatLonKeys>;
    let _searchLayer: ClusteredVectorLayer;
    let searchClusterStyle: PointStyleBuilder;
    let searchAsTypeTimer;
    let dataItems: ObservableArray<SearchItem> = new ObservableArray([] as any);
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
    function buildClusterElement(position: MapPos, elements: VectorElementVector) {
        if (!searchClusterStyle) {
            searchClusterStyle = new PointStyleBuilder({
                // hideIfOverlapped: false,
                size: 12,
                color: 'red'
            }).buildStyle();
        }

        return new Point({
            position,
            styleBuilder: searchClusterStyle
        });
    }
    function itemToMetaData(item: Item) {
        const result = {};
        Object.keys(item).forEach((k) => {
            if (item[k] !== null && item[k] !== undefined && k !== 'data') {
                result[k] = JSON.stringify(item[k]);
            }
        });
        return result;
    }
    function createSearchMarker(item: SearchItem) {
        const metaData = itemToMetaData(item);
        return new Marker({
            position: item.position,
            styleBuilder: {
                hideIfOverlapped: false,
                size: 10,
                scaleWithDPI: true,
                color: providerColors[item.provider]
            },
            metaData
        });
    }
    function getSearchLayer() {
        if (!_searchLayer) {
            _searchLayer = new ClusteredVectorLayer({
                visibleZoomRange: [0, 24],
                dataSource: getSearchDataSource(),
                minimumClusterDistance: 20,
                builder: new ClusterElementBuilder({
                    color: 'red',
                    size: 15,
                    shape: 'point'
                }),
                animatedClusters: true
            });
            _searchLayer.setVectorElementEventListener<LatLonKeys>({
                onVectorElementClicked: (data) => mapContext.onVectorElementClicked(data)
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
        searchResultsVisible = hasFocus && searchResultsCount > 0;
    }

    function getItemIcon(item: SearchItem) {
        return fonticon(formatter.geItemIcon(item));
    }
    function getItemIconColor(item: SearchItem) {
        return providerColors[item.provider];
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
    $: {
        const query = text;
        if (query !== currentSearchText) {
            // console.log('text changed', query);
            if (query) {
                if (searchAsTypeTimer) {
                    clearTimeout(searchAsTypeTimer);
                    searchAsTypeTimer = null;
                }
                if (query && query.length > 2) {
                    searchAsTypeTimer = setTimeout(() => {
                        searchAsTypeTimer = null;
                        instantSearch(query);
                    }, 500);
                } else if (query.length === 0 && currentSearchText && currentSearchText.length > 2) {
                    unfocus();
                }
            }
            currentSearchText = query;
        }
    }

    function searchInGeocodingService(options) {
        return packageService
            .searchInLocalGeocodingService(options)
            .then((result) => packageService.convertGeoCodingResults(result, true));
    }
    function searchInVectorTiles(options) {
        return packageService.searchInVectorTiles(options).then((result) => packageService.convertFeatureCollection(result));
    }

    function herePlaceSearch(options: {
        query: string;
        language?: string;
        location?: MapPos<LatLonKeys>;
        locationRadius?: number;
    }) {
        if (networkService.connected) {
            return Promise.resolve([]);
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
                    at: !options.locationRadius
                        ? options.location.lat + ',' + options.location.lon + ';' + options.locationRadius
                        : undefined,
                    in: options.locationRadius
                        ? options.location.lat + ',' + options.location.lon + ';' + options.locationRadius
                        : undefined
                },
                'https://places.cit.api.here.com/places/v1/discover/search'
            )
        ).then((result: any) => result.results.items.map((f) => new HereFeature(f)));
    }
    function photonSearch(options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number }) {
        if (!networkService.connected) {
            return Promise.resolve([]);
        }
        return getJSON(
            queryString(
                {
                    q: options.query,
                    lat: options.location && options.location.lat,
                    lon: options.location && options.location.lon,
                    lang: options.language,
                    limit: 40
                },
                'http://photon.komoot.de/api'
            )
        ).then(function (results: any) {
            return results.features.filter((r) => r.properties.osm_type !== 'R').map((f) => new PhotonFeature(f));
        });
    }
    let currentQuery;
    async function instantSearch(_query) {
        loading = true;
        currentQuery = cleanUpString(_query);
        const options = {
            query: cleanUpString(_query),
            projection: mapContext.getProjection(),
            language: packageService.currentLanguage,
            // regexFilter: `.*${cleanUpString(_query)}.*`,
            // filterExpression: `layer::name='transportation_name'`,
            // filterExpression: "layer::name='place' OR layer::name='poi'",
            // `REGEXP_LIKE(name, '${_query}')`
            location: mapContext.getMap().focusPos
            // locationRadius: 1000,
        };

        // TODO: dont fail when offline!!!

        let result = [];
        await Promise.all([
            searchInGeocodingService(options)
                .then((r) => result.push(...r))
                .catch((err) => {}),
            herePlaceSearch(options)
                .then((r) => result.push(...r))
                .catch((err) => {}),
            photonSearch(options)
                .then((r) => result.push(...r))
                .catch((err) => {})
        ]);
        if (result.length === 0) {
            showSnack({ message: l('no_result_found') });
        } else {
            await loadView();
        }
        dataItems = new ObservableArray(result);
        updateFilteredDataItems();
        loading = false;
    }
    function clearSearch() {
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
        mapContext.selectItem({ item, isFeatureInteresting: true, zoom: 14 });
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
    function showResultsOnMap() {
        const dataSource = getSearchDataSource();
        dataSource.clear();
        showingOnMap = true;
        const items = filteredDataItems.filter(
            (d) => !!d && (d.provider === 'here' || (d.provider === 'carto' && d.properties.layer === 'poi'))
        );
        items.forEach((d) => {
            dataSource.add(createSearchMarker(d));
        });
        ensureSearchLayer();
        unfocus();
        const mapBounds = dataSource.getDataExtent();
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
    rows="44,auto"
    columns="auto,*,auto,auto,auto,auto,auto"
    backgroundColor={focused ? '#99000000' : '#55000000'}
    borderRadius={searchResultsVisible ? 10 : 25}
    margin={`${globalMarginTop + 10} 10 10 10`}>
    <button variant="text" class="icon-btn-white" text="mdi-menu" on:tap={() => showMenu('left')} />
    <textfield
        bind:this={textField}
        variant="none"
        col="1"
        padding="0 15 0 0"
        row="0"
        hint="Search"
        placeholder="search"
        returnKeyType="search"
        on:focus={onFocus}
        on:blur={onBlur}
        bind:text
        width="100%"
        backgroundColor="transparent"
        autocapitalizationType="none"
        floating="false"
        verticalAlignment="center"
        color="white" />
    <mdactivityindicator visibility={loading ? 'visible' : 'collapsed'} row="0" col="2" busy={true} width={20} height={20} />
    {#if loaded}
        <button
            variant="text"
            class="icon-btn"
            visibility={searchResultsVisible ? 'visible' : 'collapsed'}
            row="0"
            col="3"
            text="mdi-shape"
            on:tap={toggleFilterOSMKey}
            color={filteringOSMKey ? primaryColor : 'lightgray'} />
        <button
            variant="text"
            class="icon-btn"
            visibility={searchResultsVisible ? 'visible' : 'collapsed'}
            row="0"
            col="4"
            text="mdi-map"
            on:tap={showResultsOnMap}
            color="lightgray" />
    {/if}
    <button
        variant="text"
        class="icon-btn"
        visibility={currentSearchText && currentSearchText.length > 0 ? 'visible' : 'collapsed'}
        row="0"
        col="5"
        text="mdi-close"
        on:tap={clearSearch}
        color="lightgray" />
    <button col="6" variant="text" class="icon-btn-white" text="mdi-dots-vertical" on:tap={showMapMenu} />
    {#if loaded}
        <collectionview
            bind:this={collectionView}
            col="0"
            row="1"
            height="200"
            colSpan="7"
            rowHeight="49"
            items={filteredDataItems}
            visibility={searchResultsVisible ? 'visible' : 'collapsed'}>
            <Template let:item>
                <gridlayout columns="30,*" rows="*,auto,auto,*" rippleColor="white" on:tap={() => onItemTap(item)}>
                    <label
                        col="0"
                        rowSpan="4"
                        text={getItemIcon(item)}
                        color={getItemIconColor(item)}
                        class="osm"
                        fontSize="20"
                        verticalAlignment="center"
                        textAlignment="center" />
                    <label col="1" row="1" text={getItemTitle(item)} color="white" fontSize="14" fontWeight="bold" />
                    <label col="1" row="2" text={getItemSubtitle(item)} color="#D0D0D0" fontSize="12" />
                </gridlayout>
            </Template>
        </collectionview>
    {/if}
</gridlayout>
