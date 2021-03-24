<script lang="ts">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { ClusterElementBuilder } from '@nativescript-community/ui-carto/layers/cluster';
    import { ClusteredVectorLayer } from '@nativescript-community/ui-carto/layers/vector';
    import type { SearchRequest } from '@nativescript-community/ui-carto/search';
    import { VectorElementVector } from '@nativescript-community/ui-carto/vectorelements';
    import { Marker } from '@nativescript-community/ui-carto/vectorelements/marker';
    import { Point, PointStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/point';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import type { Side } from '@nativescript-community/ui-drawer';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { GridLayout, ObservableArray, TextField } from '@nativescript/core';
    import { getJSON } from '@nativescript/core/http';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { osmicon } from '~/helpers/formatter';
    import { l, slc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { Address, IItem as Item } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { GeoResult, packageService } from '~/services/PackageService';
    import { globalMarginTop, primaryColor, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
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
                state,
                county: region,
                houseNumber: housenumber,
                postcode,
                city,
                country,
                street: properties['osm_key'] === 'highway' ? name : street,
                neighbourhood
            };
            this.properties = actualProperties;
            this.properties.name = actualName;
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
                clickSize: 20,
                size: 20,
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
        return osmicon(formatter.geItemIcon(item));
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
                    }, 1000);
                } else if (query.length === 0 && currentSearchText && currentSearchText.length > 2) {
                    unfocus();
                }
            }
            currentSearchText = query;
        }
    }

    async function searchInGeocodingService(options) {
        let result: any = await packageService.searchInLocalGeocodingService(options);
        result = packageService.convertGeoCodingResults(result, true) as any;
        return (result as any) as GeoResult[];
    }
    async function searchInVectorTiles(options: SearchRequest) {
        let result: any = await packageService.searchInVectorTiles(options);
        if (result) {
            result = packageService.convertFeatureCollection(result, options) as any;
        } else {
            result = [];
        }
        return (result as any) as GeoResult[];
    }

    async function herePlaceSearch(options: {
        query: string;
        language?: string;
        location?: MapPos<LatLonKeys>;
        locationRadius?: number;
    }) {
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
    async function photonSearch(options: {
        query: string;
        language?: string;
        location?: MapPos<LatLonKeys>;
        locationRadius?: number;
    }) {
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
            'https://photon.komoot.de/api'
        );
        return getJSON(url).then(function (results: any) {
            return results.features.filter((r) => r.properties.osm_type !== 'R').map((f) => new PhotonFeature(f));
        });
    }
    let currentQuery;
    async function instantSearch(_query) {
        console.log('instantSearch', _query,loading) ;
        loading = true;
        currentQuery = cleanUpString(_query);
        const position = mapContext.getMap().focusPos;
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
            searchRadius: 1000
            // locationRadius: 1000,
        };

        // TODO: dont fail when offline!!!

        let result = [];
        await Promise.all([
            searchInVectorTiles(options as any)
                .then((r) => r && result.push(...r))
                .catch((err) => {
                    console.error('searchInVectorTiles', err);
                }),
            searchInGeocodingService(options)
                .then((r) => loading && r  && result.push(...r))
                .catch((err) => {
                    console.error('searchInGeocodingService', err);
                }),
            herePlaceSearch(options)
                .then((r) => loading && r  && result.push(...r))
                .catch((err) => {
                    console.error('herePlaceSearch', err);
                }),
            photonSearch(options)
                .then((r) => loading && r && result.push(...r))
                .catch((err) => {
                    console.error('photonSearch', err);
                })
        ]);
        if (!loading) {
            // was cancelled
            return;
        }
        if (result.length === 0) {
            showSnack({ message: l('no_result_found') });
        } else {
            await loadView();
        }
        dataItems = result.map(s=>({...s , color:getItemIconColor(s), icon:getItemIcon(s), title:getItemTitle(s), subtitle:getItemSubtitle(s)}));
        updateFilteredDataItems();
        loading = false;
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
        mapContext.selectItem({ item, isFeatureInteresting: true, minZoom: 14 });
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
            // (d) => !!d && (d.provider === 'here' || (d.provider === 'carto' && d.properties.layer === 'poi'))
            (d) => !!d && (d.provider === 'here' || d.provider === 'carto')
        );
        if (items.length === 0) {
            return;
        }
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
        col="1"
        padding="0 15 0 0"
        row="0"
        hint={$slc('search')}
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
    />
    <mdactivityindicator visibility={loading ? 'visible' : 'collapsed'} row="0" col="2" busy={true} width={20} height={20} />
    {#if loaded}
        <button
            variant="text"
            class="small-icon-btn"
            visibility={searchResultsVisible ? 'visible' : 'collapsed'}
            row="0"
            col="3"
            text="mdi-shape"
            on:tap={toggleFilterOSMKey}
            color={filteringOSMKey ? primaryColor : $subtitleColor}
        />
        <button
            variant="text"
            class="small-icon-btn"
            visibility={searchResultsVisible ? 'visible' : 'collapsed'}
            row="0"
            col="4"
            text="mdi-map"
            on:tap={showResultsOnMap}
            color={$subtitleColor}
        />
    {/if}
    <button
        variant="text"
        class="icon-btn"
        visibility={currentSearchText && currentSearchText.length > 0 ? 'visible' : 'collapsed'}
        row="0"
        col="5"
        text="mdi-close"
        on:tap={clearSearch}
        color={$subtitleColor}
    />
    <button col="6" variant="text" class="icon-btn" text="mdi-dots-vertical" on:tap={showMapMenu} />
    {#if loaded}
        <collectionview
            bind:this={collectionView}
            col="0"
            row="1"
            height="200"
            colSpan="7"
            rowHeight="49"
            items={filteredDataItems}
            visibility={searchResultsVisible ? 'visible' : 'collapsed'}
        >
            <Template let:item>
                <gridlayout columns="34,*" padding="0 10 0 10" rows="*,auto,auto,*" class="textRipple" on:tap={() => onItemTap(item)}>
                    <label
                        col="0"
                        rowSpan="4"
                        text={item.icon}
                        color={item.color}
                        class="osm"
                        fontSize="20"
                        verticalAlignment="center"
                        textAlignment="center"
                    />
                    <label col="1" row="1" text={item.title} fontSize="14" fontWeight="bold"/>
                    <label col="1" row="2" text={item.subtitle} class="subtitle" fontSize="12" visibility={!!item.subtitle ? 'visible' : 'collapsed'} />
                </gridlayout>
            </Template>
        </collectionview>
    {/if}
</gridlayout>
