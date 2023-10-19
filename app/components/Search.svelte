<script lang="ts">
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { ClusterElementBuilder } from '@nativescript-community/ui-carto/layers/cluster';
    import { ClusteredVectorLayer } from '@nativescript-community/ui-carto/layers/vector';
    import { PointStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/point';
    import { Animation, ApplicationSettings, GridLayout, ObservableArray, TextField, View } from '@nativescript/core';
    import type { Point } from 'geojson';
    import { onDestroy } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { lc, slc } from '~/helpers/locale';
    import { currentTheme } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import { packageService } from '~/services/PackageService';
    import { showError } from '~/utils/error';
    import { actionBarButtonHeight, globalMarginTop, lightBackgroundColor, subtitleColor, widgetBackgroundColor } from '~/variables';
    import IconButton from './IconButton.svelte';
    import SearchCollectionView from './SearchCollectionView.svelte';
    import { closePopover, showPopover } from '@nativescript-community/ui-popover/svelte';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';

    const SEARCH_COLLECTIONVIEW_HEIGHT = 250;
    let animating = false;
    async function animateTargets(animations: any[]) {
        animations = animations.filter((a) => !!a.target);
        let shouldAnimate = true;
        try {
            if (shouldAnimate && animations[0].target.nativeView) {
                animating = true;
                await new Animation(animations).play();
            } else {
                animations.forEach((animation) => {
                    const { target, ...props } = animation;
                    target._batchUpdate(() => {
                        Object.assign(target, props);
                    });
                });
            }
        } catch (error) {
            console.error(error, error.stack);
        } finally {
            animating = false;
        }
    }

    interface SearchItem extends Item {
        geometry: Point;
        distance: number;
    }

    let gridLayout: NativeViewElementNode<GridLayout>;
    let textField: NativeViewElementNode<TextField>;
    let collectionViewHolder: NativeViewElementNode<GridLayout>;
    let collectionView: SearchCollectionView;
    let _searchDataSource: LocalVectorDataSource<LatLonKeys>;
    let _searchLayer: ClusteredVectorLayer;
    let searchAsTypeTimer;
    let loading = false;
    // let filteringOSMKey = false;
    export let dataItems: ObservableArray<SearchItem> = null;
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
                    // textSize: 15,
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
    let focused = false;
    let searchResultsCount;
    $: searchResultsVisible = focused && searchResultsCount > 0;
    // $: {
    //     if (nGridLayout) {
    //         animateView(nGridLayout, { elevation: $currentTheme !== 'dark' && focused ? 10 : 0, borderRadius: searchResultsVisible ? 10 : 25 }, 100);
    //     }
    // }

    $: {
        const nCollectionView = collectionViewHolder?.nativeView;
        const nGridLayout = gridLayout?.nativeView;
        if (nCollectionView || nGridLayout) {
            animateTargets([
                { target: nCollectionView, height: searchResultsVisible ? SEARCH_COLLECTIONVIEW_HEIGHT : 0, duration: 100 },
                { target: nGridLayout, elevation: $currentTheme !== 'dark' && focused ? 10 : 0, borderRadius: searchResultsVisible ? 10 : 25, duration: 100 }
            ]);
            // animateView(nCollectionView, { height: searchResultsVisible ? SEARCH_COLLECTIONVIEW_HEIGHT : 0 }, 100);
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
        clearSearch();
        currentSearchText = query;
        textField.nativeView.text = query;
        instantSearch(query);
    }

    function onReturnKey() {
        if (searchAsTypeTimer) {
            clearTimeout(searchAsTypeTimer);
            searchAsTypeTimer = null;
        }
        instantSearch(text);
    }

    function reloadSearch() {
        if (text && !loading && !searchAsTypeTimer) {
            instantSearch(text);
        }
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
                    didSearch = false;
                    console.log('will instantSerach', query);
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
    $: if (needToShowOnResult && searchResultsCount > 0) {
        needToShowOnResult = false;
        textField.nativeView.requestFocus();
    }
    let needToShowOnResult = false;
    let didSearch = false;
    async function instantSearch(_query) {
        try {
            loading = true;
            if (!loaded) {
                await loadView();
            }
            needToShowOnResult = true;
            await collectionView?.instantSearch(_query);
            didSearch = true;
        } catch (err) {
            needToShowOnResult = false;
            showError(err);
        } finally {
            loading = false;
        }
    }
    function clearSearch(clearQuery = true) {
        didSearch = false;
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
            textField.nativeView.text = '';
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
        if (!animating) {
            (textField.nativeView as any).clearFocus();
        }
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
    // function toggleFilterOSMKey() {
    // filteringOSMKey = !filteringOSMKey;
    // if (showingOnMap) {
    //     showResultsOnMap();
    // }
    // }
    function toggleShowResultsOnMap() {
        if (showingOnMap) {
            showingOnMap = false;
            getSearchLayer().visible = false;
        } else {
            showResultsOnMap(dataItems);
        }
    }
    let showingOnMap = false;
    let searchStyle: PointStyleBuilder;
    function showResultsOnMap(items) {
        try {
            if (!items || items.length === 0) {
                return;
            }
            showingOnMap = true;
            if (!_searchDataSource) {
                const dataSource = getSearchDataSource();
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
                const featureCollection = packageService.getGeoJSONReader().readFeatureCollection(geojson);
                dataSource.clear();
                dataSource.addFeatureCollection(featureCollection, searchStyle);
                // items.forEach((d) => {
                //     dataSource.add(createSearchMarker(d));
                // });
                ensureSearchLayer();
                const mapBounds = featureCollection.getBounds();
                mapContext.getMap().moveToFitBounds(mapBounds, undefined, false, false, false, 100);
            } else {
                getSearchLayer().visible = true;
            }

            unfocus();
        } catch (error) {
            showError(error);
        }
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

    async function showSearchOptions(event) {
        try {
            const actions: any[] = [
                {
                    type: 'checkbox',
                    name: lc('search_using_geocoding'),
                    value: ApplicationSettings.getBoolean('searchInGeocoding', true),
                    id: 'searchInGeocoding'
                },
                {
                    type: 'checkbox',
                    name: lc('search_in_vectortiles'),
                    value: ApplicationSettings.getBoolean('searchInTiles', true),
                    id: 'searchInTiles'
                },
                {
                    type: 'checkbox',
                    name: lc('search_using_here'),
                    value: ApplicationSettings.getBoolean('searchUsingHere', false),
                    id: 'searchUsingHere'
                },
                {
                    type: 'checkbox',
                    name: lc('search_using_photon'),
                    value: ApplicationSettings.getBoolean('searchUsingPhoton', true),
                    id: 'searchUsingPhoton'
                }
            ];
            const OptionSelect = (await import('~/components/OptionSelect.svelte')).default;
            const result = await showPopover<any>({
                vertPos: VerticalPosition.BELOW,
                horizPos: HorizontalPosition.ALIGN_LEFT,
                view: OptionSelect ,
                fitInScreen: true,
                anchor: event.object,
                props: {
                    showBorders: false,
                    backgroundColor: $lightBackgroundColor,
                    options: actions,
                    borderRadius: 6,
                    rowHeight: 50,
                    onClose: closePopover,
                    width: 300,
                    fontWeight: 'normal',
                    onCheckBox(item, value) {
                        ApplicationSettings.setBoolean(item.id, value);
                    }
                }
            });
            if (result) {
                switch (result.id) {
                    case 'delete':
                        break;
                }
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<gridlayout
    id="search"
    bind:this={gridLayout}
    {...$$restProps}
    rows="auto,auto"
    on:tap={() => {}}
    elevation={$currentTheme !== 'dark' && focused ? 6 : 0}
    columns="auto,*,auto,auto,auto"
    backgroundColor={$widgetBackgroundColor}
    margin={`${globalMarginTop + 10} 10 10 10`}
>
    <IconButton gray={true} text="mdi-magnify" on:tap={showSearchOptions} />
    <!-- <label class="icon-label" text="mdi-magnify" color={$subtitleColor} /> -->
    <textfield
        bind:this={textField}
        variant="none"
        col={1}
        margin="0 15 0 0"
        height={actionBarButtonHeight}
        hint={$slc('search')}
        placeholder={$slc('search')}
        returnKeyType="search"
        on:focus={onFocus}
        on:blur={onBlur}
        on:returnPress={onReturnKey}
        {text}
        on:textChange={(e) => (text = e['value'])}
        autocapitalizationType="none"
        floating="false"
        verticalTextAlignment="center"
    />
    <mdactivityindicator visibility={loading ? 'visible' : 'hidden'} col={2} busy={true} width={20} height={20} />
    <IconButton gray={true} isVisible={currentSearchText && currentSearchText.length > 0 && !loading && didSearch} col={2} text="mdi-refresh" on:tap={reloadSearch} />
    <IconButton gray={true} isVisible={currentSearchText && currentSearchText.length > 0} col={3} text="mdi-close" on:tap={() => clearSearch()} />
    <IconButton col={4} gray={true} text="mdi-dots-vertical" on:tap={showMapMenu} />
    {#if loaded}
        <absolutelayout bind:this={collectionViewHolder} row={1} height={0} colSpan={7} isUserInteractionEnabled={searchResultsVisible}>
            <gridlayout height={SEARCH_COLLECTIONVIEW_HEIGHT} width="100%" rows="*,auto" columns="auto,auto,*">
                <SearchCollectionView
                    bind:this={collectionView}
                    bind:searchResultsCount
                    bind:dataItems
                    colSpan={3}
                    isUserInteractionEnabled={searchResultsVisible}
                    on:tap={(event) => onItemTap(event.detail.detail)}
                />
                <stacklayout row={1} orientation="horizontal" on:tap={() => {}} width="100%">
                    <!-- <IconButton small={true} isVisible={searchResultsVisible} text="mdi-shape" on:tap={toggleFilterOSMKey} isSelected={filteringOSMKey} /> -->
                    <IconButton small={true} isVisible={searchResultsVisible} text="mdi-map" on:tap={toggleShowResultsOnMap} />
                </stacklayout>
            </gridlayout>
        </absolutelayout>
    {/if}
</gridlayout>
