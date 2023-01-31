<script lang="ts">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { ClusterElementBuilder } from '@nativescript-community/ui-carto/layers/cluster';
    import { ClusteredVectorLayer } from '@nativescript-community/ui-carto/layers/vector';
    import type { SearchRequest } from '@nativescript-community/ui-carto/search';
    import { PointStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/point';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { GridLayout, Screen, TextField, View } from '@nativescript/core';
    import { getJSON } from '@nativescript/core/http';
    import deburr from 'deburr';
    import type { Point } from 'geojson';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { HereFeature, PhotonFeature } from '~/components/Features';
    import { formatDistance, osmicon } from '~/helpers/formatter';
    import { getMetersPerPixel } from '~/helpers/geolib';
    import { l, slc } from '~/helpers/locale';
    import { currentTheme } from '~/helpers/theme';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import type { Photon } from '~/photon';
    import { networkService } from '~/services/NetworkService';
    import type { GeoResult } from '~/services/PackageService';
    import { packageService } from '~/services/PackageService';
    import { showError } from '~/utils/error';
    import { computeDistanceBetween } from '~/utils/geo';
    import { queryString } from '~/utils/http';
    import { arraySortOn } from '~/utils/utils';
    import { globalMarginTop, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
    import IconButton from './IconButton.svelte';

    async function animateView(view: View, to, duration) {
        let shouldAnimate = false;
        Object.keys(to).some((k) => {
            if (view[k] !== to[k]) {
                shouldAnimate = true;
                return true;
            }
        });
        if (!shouldAnimate) {
            return;
        }
        // console.log('animateView', view, view.nativeView, to, duration);
        try {
            if (view.nativeView) {
                await view.animate({
                    duration,
                    ...to
                });
            } else {
                view._batchUpdate(() => {
                    Object.assign(view, to);
                });
            }
        } catch (error) {
            console.error(error, error.stack);
        }
        // const from = {};
        // Object.keys(to).forEach((k) => {
        //     from[k] = view[k];
        // });
        // const anim = new AdditiveTweening({
        //     onRender: (state) => {
        //         // console.log('onRender', state)
        //         Object.assign(view, state);
        //     }
        // });
        // anim.tween(from, to, duration);
        // return anim;
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

    interface SearchItem extends Item {
        geometry: Point;
    }

    let gridLayout: NativeViewElementNode<GridLayout>;
    let textField: NativeViewElementNode<TextField>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let collectionViewHolder: NativeViewElementNode<GridLayout>;
    let _searchDataSource: LocalVectorDataSource<LatLonKeys>;
    let _searchLayer: ClusteredVectorLayer;
    let searchClusterStyle: PointStyleBuilder;
    let searchAsTypeTimer;
    let dataItems: SearchItem[] = [];
    let filteredDataItems: SearchItem[] = dataItems;
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
    // function itemToMetaData(item: Item) {
    //     const result = {};
    //     Object.keys(item).forEach((k) => {
    //         if (item[k] !== null && item[k] !== undefined && k !== 'data') {
    //             result[k] = JSON.stringify(item[k]);
    //         }
    //     });
    //     return result;
    // }
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
    $: {
        const nGridLayout = gridLayout?.nativeView;
        if (nGridLayout) {
            animateView(nGridLayout, { elevation: $currentTheme !== 'dark' && focused ? 10 : 0, borderRadius: searchResultsVisible ? 10 : 25 }, 100);
        }
    }

    $: {
        const nCollectionView = collectionViewHolder?.nativeView;
        if (nCollectionView) {
            animateView(nCollectionView, { height: searchResultsVisible ? 200 : 0 }, 100);
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
                    // the timeout is to allow svelte to see changes with $:
                    setTimeout(() => {
                        clearSearch(false);
                    }, 0);

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
    let currentQuery;

    async function addItems(r: GeoResult[]) {
        if (!loading) {
            // was cancelled
            return;
        }
        if (r.length === 0) {
            showSnack({ message: l('no_result_found') });
        } else {
            await loadView();
        }
        dataItems = dataItems.concat(
            r.map((s: SearchItem) => {
                return { ...s, color: getItemIconColor(s), icon: getItemIcon(s), title: getItemTitle(s), subtitle: getItemSubtitle(s) };
            })
        );
        updateFilteredDataItems();
    }
    async function instantSearch(_query) {
        try {
            TEST_LOG && console.log('instantSearch', _query, loading, networkService.connected);
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

            dataItems = [];

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
                    .then(addItems)
                    .catch((err) => {
                        console.error('searchInGeocodingService', err);
                    }),
                herePlaceSearch(options)
                    .then(addItems)
                    .catch((err) => {
                        console.error('herePlaceSearch', err, err.stack);
                    }),
                photonSearch(options)
                    .then(addItems)
                    .catch((err) => {
                        console.error('photonSearch', err, err.stack);
                    })
            ]);
            if (searchResultsCount > 0) {
                textField.nativeView.focus();
            }
        } catch (err) {
            showError(err);
        } finally {
            loading = false;
        }
    }
    function clearSearch(clearQuery = true) {
        loading = false;
        if (searchAsTypeTimer) {
            clearTimeout(searchAsTypeTimer);
            searchAsTypeTimer = null;
        }
        dataItems = [];
        filteredDataItems = [];
        if (clearQuery) {
            currentSearchText = null;
            currentQuery = null;
            textField.nativeView.text = null;
            showingOnMap = false;
        }
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
        (textField.nativeView as any).clearFocus();
    }

    function focus() {
        textField.nativeView.focus();
    }

    function showMapMenu() {
        mapContext.showOptions();
    }
    function onItemTap(item: SearchItem) {
        if (!searchResultsVisible || !item) {
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
    elevation={$currentTheme !== 'dark' && focused ? 6 : 0}
    columns="auto,*,auto,auto,auto"
    backgroundColor={$widgetBackgroundColor}
    margin={`${globalMarginTop + 10} 10 10 10`}
>
    <label class="icon-label" text="mdi-magnify" color={$subtitleColor}/>
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
        {text}
        on:textChange={(e) => (text = e['value'])}
        backgroundColor="transparent"
        autocapitalizationType="none"
        floating="false"
        verticalTextAlignment="center"
    />
    <mdactivityindicator visibility={loading ? 'visible' : 'collapsed'} col={2} busy={true} width={20} height={20} />

    <IconButton gray={true} isVisible={currentSearchText && currentSearchText.length > 0} col={3} text="mdi-close" on:tap={() => clearSearch()} />
    <IconButton col={4} gray={true} text="mdi-dots-vertical" on:tap={showMapMenu} />
    {#if loaded}
        <absolutelayout bind:this={collectionViewHolder} row={1} height={0} colSpan={7} isUserInteractionEnabled={searchResultsVisible}>
            <gridlayout height={200} width="100%" rows="*,auto" columns="auto,auto,*">
                <IconButton small={true} row={1} isVisible={searchResultsVisible} text="mdi-shape" on:tap={toggleFilterOSMKey} isSelected={filteringOSMKey} />
                <IconButton small={true} isVisible={searchResultsVisible} col={1} row={1} text="mdi-map" on:tap={showResultsOnMap} />
                <collectionview colSpan={3} bind:this={collectionView} rowHeight={49} items={filteredDataItems} isUserInteractionEnabled={searchResultsVisible}>
                    <Template let:item>
                        <canvaslabel columns="34,*" padding="0 10 0 10" rows="*,auto,auto,*" disableCss={true}  color={$textColor} rippleColor={$textColor} on:tap={() => onItemTap(item)}>
                            <cspan text={item.icon} color={item.color} fontFamily="osm" fontSize={20} verticalAlignment="middle" />
                            <cspan paddingLeft={34} verticalAlignment="middle" paddingBottom={item.subtitle ? 10 : 0} text={item.title} fontSize={14} fontWeight="bold" />
                            <cspan
                                paddingLeft={34}
                                verticalAlignment="middle"
                                paddingTop={10}
                                text={item.subtitle}
                                color={$subtitleColor}
                                fontSize={12}
                                visibility={!!item.subtitle ? 'visible' : 'collapsed'}
                            />
                            <cspan
                                textAlignment="right"
                                verticalAlignment="middle"
                                paddingTop={10}
                                text={item.distance && formatDistance(item.distance)}
                                color={$subtitleColor}
                                fontSize={12}
                                visibility={'distance' in item ? 'visible' : 'collapsed'}
                            />
                            <!-- <cspan col={1} rowSpan={2} text={item.provider} class="subtitle" textAlignment="right" fontSize={12} /> -->
                        </canvaslabel>
                    </Template>
                </collectionview>
            </gridlayout>
        </absolutelayout>
    {/if}
</gridlayout>
