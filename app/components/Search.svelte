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
    import SearchCollectionView from './SearchCollectionView.svelte';

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

    interface SearchItem extends Item {
        geometry: Point;
    }

    let gridLayout: NativeViewElementNode<GridLayout>;
    let textField: NativeViewElementNode<TextField>;
    let collectionViewHolder: NativeViewElementNode<GridLayout>;
    let collectionView: SearchCollectionView;
    let _searchDataSource: LocalVectorDataSource<LatLonKeys>;
    let _searchLayer: ClusteredVectorLayer;
    let searchAsTypeTimer;
    let loading = false;
    let filteringOSMKey = false;
    export let filteredDataItems: SearchItem[] = null;
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

    let searchResultsCount;
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

    async function instantSearch(_query) {
        try {
            loading = true;
            if (!loaded) {
                await loadView();
            }
            await collectionView?.instantSearch(_query);

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
        if (collectionView) {
            collectionView.clearSearch(clearQuery);
        }
        if (searchAsTypeTimer) {
            clearTimeout(searchAsTypeTimer);
            searchAsTypeTimer = null;
        }
        if (clearQuery) {
            currentSearchText = null;
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

    $: {
        if (showingOnMap) {
            showResultsOnMap(filteredDataItems);
        }
    }
    function toggleFilterOSMKey() {
        filteringOSMKey = !filteringOSMKey;
        // if (showingOnMap) {
        //     showResultsOnMap();
        // }
    }
    function toggleShowResultsOnMap() {
        showResultsOnMap(filteredDataItems);
    }
    let showingOnMap = false;
    let searchStyle: PointStyleBuilder;
    function showResultsOnMap(items) {
        if (!items || items.length === 0) {
            return;
        }
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
            features: items.map((s) => ({ type: 'Feature', ...s }))
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
        if (collectionViewHolder) {
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
    <label class="icon-label" text="mdi-magnify" color={$subtitleColor} />
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
                <SearchCollectionView
                    bind:this={collectionView}
                    bind:filteringOSMKey
                    bind:searchResultsCount
                    bind:filteredDataItems
                    colSpan={3}
                    isUserInteractionEnabled={searchResultsVisible}
                    on:tap={(event) => onItemTap(event.detail)}
                />
                <stacklayout row={1} orientation="horizontal" on:tap={() => {}} width="100%">
                    <IconButton small={true} isVisible={searchResultsVisible} text="mdi-shape" on:tap={toggleFilterOSMKey} isSelected={filteringOSMKey} />
                    <IconButton small={true} isVisible={searchResultsVisible} text="mdi-map" on:tap={toggleShowResultsOnMap} /></stacklayout
                >
            </gridlayout>
        </absolutelayout>
    {/if}
</gridlayout>
