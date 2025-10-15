<script lang="ts">
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
    import { PointStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/point';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { Animation, ApplicationSettings, GridLayout, ObservableArray, TextField } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import type { Point } from 'geojson';
    import { onDestroy } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { lc, slc } from '~/helpers/locale';
    import { currentTheme, isEInk } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import { packageService } from '~/services/PackageService';
    import { showPopoverMenu } from '~/utils/ui/index.common';
    import { actionBarButtonHeight, colors, fontScaleMaxed, screenHeightDips } from '~/variables';
    import IconButton from '~/components/common/IconButton.svelte';
    import SearchCollectionView from '~/components/search/SearchCollectionView.svelte';

    let { colorOnSurface, colorWidgetBackground } = $colors;
    $: ({ colorOnSurface, colorWidgetBackground } = $colors);

    const SEARCH_COLLECTIONVIEW_HEIGHT = 250;
    let animating = false;
    async function animateTargets(animations: any[]) {
        animations = animations.filter((a) => !!a.target);
        const shouldAnimate = true;
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
    // let _searchDataSource: LocalVectorDataSource<LatLonKeys>;
    let _searchDataSource: GeoJSONVectorTileDataSource;
    // let _searchLayer: ClusteredVectorLayer;
    let _searchLayer: VectorTileLayer;
    let searchAsTypeTimer;
    let loading = false;
    let searchAroundItem = false;
    // let filteringOSMKey = false;
    export let dataItems: ObservableArray<SearchItem> = null;
    export let item: Item;
    // let text: string = null;
    let currentSearchText: string = null;
    const mapContext = getMapContext();

    export function getNativeView() {
        return gridLayout && gridLayout.nativeView;
    }

    function getSearchDataSource() {
        if (!_searchDataSource) {
            // const projection = mapContext.getProjection();
            // _searchDataSource = new LocalVectorDataSource<LatLonKeys>({ projection });
            _searchDataSource = new GeoJSONVectorTileDataSource({
                simplifyTolerance: 2,
                minZoom: 0,
                maxZoom: 24
            });
            _searchDataSource.createLayer('search');
        }
        return _searchDataSource;
    }
    function getSearchLayer() {
        if (!_searchLayer) {
            _searchLayer = new VectorTileLayer({
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0,
                labelRenderOrder: VectorTileRenderOrder.LAST,
                clickRadius: ApplicationSettings.getNumber('route_click_radius', 16),
                dataSource: getSearchDataSource(),
                decoder: mapContext.innerDecoder
            });
            // _searchLayer = new ClusteredVectorLayer({
            //     visibleZoomRange: [0, 24],
            //     dataSource: getSearchDataSource(),
            //     minimumClusterDistance: 30,
            //     builder: new ClusterElementBuilder({
            //         color: 'red',
            //         // textColor: 'white',
            //         // textSize: 15,
            //         size: 20,
            //         bbox: true,
            //         shape: 'point'
            //     })
            // });
            _searchLayer.setVectorTileEventListener<LatLonKeys>(
                {
                    onVectorTileClicked: (data) => mapContext.vectorTileClicked(data)
                },
                mapContext.getProjection()
            );
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
    // $: DEV_LOG && console.log('searchResultsVisible', searchResultsVisible, focused, searchResultsCount);
    // $: {
    //     if (nGridLayout) {
    //         animateView(nGridLayout, { elevation: $currentTheme !== 'dark' && !isEInk && focused ? 10 : 0, borderRadius: searchResultsVisible ? 10 : 25 }, 100);
    //     }
    // }

    $: {
        const nCollectionView = collectionViewHolder?.nativeView;
        const nGridLayout = gridLayout?.nativeView;
        if (nCollectionView || nGridLayout) {
            animateTargets([
                { target: nCollectionView, height: searchResultsVisible ? SEARCH_COLLECTIONVIEW_HEIGHT : __ANDROID__ ? 0 : 0.01, duration: 100 },
                { target: nGridLayout, elevation: $currentTheme !== 'dark' && !isEInk && focused ? 10 : 0, borderRadius: searchResultsVisible ? 10 : 25, duration: 100 }
            ]);
            // animateView(nCollectionView, { height: searchResultsVisible ? SEARCH_COLLECTIONVIEW_HEIGHT : 0 }, 100);
        }
    }
    function clearLayer() {
        if (_searchDataSource) {
            mapContext.unselectItem(); // TODO: only if selected one!
            _searchDataSource.deleteLayer(1);
            _searchDataSource.createLayer('search');
            _searchDataSource = null;
        }
        if (_searchLayer) {
            mapContext.removeLayer(_searchLayer, 'search');
            _searchLayer.setVectorTileEventListener(null);
            _searchLayer = null;
        }
    }
    onDestroy(() => {
        clearLayer();
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
        instantSearch(currentSearchText);
    }

    function reloadSearch() {
        if (currentSearchText && !loading && !searchAsTypeTimer) {
            instantSearch(currentSearchText);
        }
    }

    function onTextChanged(text: string) {
        const query = text.toLowerCase();
        // DEV_LOG && console.log('onTextChanged', text, currentSearchText);
        if (query !== currentSearchText) {
            if (query) {
                if (searchAsTypeTimer) {
                    clearTimeout(searchAsTypeTimer);
                    searchAsTypeTimer = null;
                }
                if (query && query.length > 2) {
                    didSearch = false;
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

    // $: onTextChanged(text);
    $: if (needToShowOnResult && searchResultsCount > 0) {
        needToShowOnResult = false;
        textField.nativeView.requestFocus();
    }
    let needToShowOnResult = false;
    let didSearch = false;
    async function instantSearch(_query) {
        try {
            if (/\d+(\.\d+)?\s*,\s*\d+(\.\d+)?/.test(_query)) {
                const latlong = _query.split(':')[1].split(',').map(parseFloat) as [number, number];
                if (latlong[0] !== 0 || latlong[1] !== 0) {
                    getMapContext().selectItem({
                        item: {
                            properties: {},
                            geometry: {
                                coordinates: latlong
                            } as any
                        },
                        isFeatureInteresting: true
                    });
                }
                return;
            }
            loading = true;
            if (!loaded) {
                await loadView();
            }
            needToShowOnResult = true;
            await collectionView?.instantSearch(_query, undefined, searchAroundItem ? item : undefined);
            didSearch = true;
        } catch (err) {
            needToShowOnResult = false;
            showError(err);
        } finally {
            loading = false;
        }
    }
    export function clearSearch(clearQuery = true) {
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
        clearLayer();
        mapContext.showMapResultsPager(null);
    }
    export function unfocus() {
        if (searchAsTypeTimer) {
            clearTimeout(searchAsTypeTimer);
            searchAsTypeTimer = null;
        }
        // console.log('unfocus', animating);
        if (!animating) {
            textField.nativeView.clearFocus();
        }
    }

    function showMapMenu(event) {
        mapContext.showMapMenu(event);
    }
    function showMapOptions(event) {
        mapContext.showMapOptions(event);
    }
    function onItemTap(item /*: SearchItem*/) {
        if (!searchResultsVisible || !item) {
            return;
        }
        mapContext.selectItem({ item, isFeatureInteresting: true, minZoom: 17, preventZoom: false });
        unfocus();
    }
    // function toggleFilterOSMKey() {
    // filteringOSMKey = !filteringOSMKey;
    // if (showingOnMap) {
    //     showResultsOnMap();
    // }
    // }

    $: if (showingOnMap && dataItems) {
        showResultsOnMap(dataItems, false);
    }
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
    function showResultsOnMap(items: ObservableArray<SearchItem>, shouldUnfocus = true) {
        try {
            if (!items || items.length === 0) {
                _searchDataSource?.deleteLayer(1);
                _searchDataSource?.createLayer('search');
                mapContext.showMapResultsPager(null);
                showingOnMap = false;
            } else {
                getSearchLayer().visible = true;
                showingOnMap = true;
                // if (!_searchDataSource) {
                const dataSource = getSearchDataSource();
                const geojson = {
                    type: 'FeatureCollection',
                    features: items.map((s) => ({ type: 'Feature', ...s }))
                };
                // if (!searchStyle) {
                //     searchStyle = new PointStyleBuilder({ color: 'red', size: 10 });
                // }
                // dataSource.clear();
                dataSource.setLayerGeoJSONString(1, geojson);
                // items.forEach((d) => {
                //     dataSource.add(createSearchMarker(d));
                // });
                ensureSearchLayer();
                const featureCollection = packageService.getGeoJSONReader().readFeatureCollection(geojson);
                const mapBounds = featureCollection.getBounds();

                const viewPort = mapContext.getMapViewPort();
                // we ensure the viewPort is squared for the screen captured
                const screenBounds = {
                    min: { x: viewPort.left, y: viewPort.top },
                    max: { x: viewPort.left + viewPort.width, y: viewPort.top + viewPort.height - 200 }
                };
                mapContext.getMap().moveToFitBounds(mapBounds, screenBounds, false, false, false, 100);
                // } else {
                // getSearchLayer().visible = true;
                // }
                mapContext.showMapResultsPager(items['_array'].slice());
            }
            if (shouldUnfocus) {
                unfocus();
            }
        } catch (error) {
            showError(error);
        }
    }

    let loaded = false;
    const loadedListeners = [];
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
            const actions: any[] = []
                .concat(
                    !!packageService.localOSMOfflineGeocodingService
                        ? [
                              {
                                  type: 'checkbox',
                                  name: lc('search_using_geocoding'),
                                  value: ApplicationSettings.getBoolean('searchInGeocoding', true),
                                  id: 'searchInGeocoding'
                              }
                          ]
                        : []
                )
                .concat(
                    !!packageService.localVectorTileLayer
                        ? [
                              {
                                  type: 'checkbox',
                                  name: lc('search_in_vectortiles'),
                                  value: ApplicationSettings.getBoolean('searchInTiles', true),
                                  id: 'searchInTiles'
                              }
                          ]
                        : []
                )
                .concat([
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
                ]);
            const result: any = await showPopoverMenu({
                options: actions,
                vertPos: VerticalPosition.BELOW,
                horizPos: HorizontalPosition.ALIGN_LEFT,
                anchor: event.object,
                props: {
                    autoSizeListItem: true,
                    fontWeight: 'normal',
                    maxHeight: screenHeightDips - 200,
                    rowHeight: 84 * Math.sqrt($fontScaleMaxed), // just for measure
                    onCheckBox(item, value) {
                        ApplicationSettings.setBoolean(item.id, value);
                    }
                }
            });
            // if (result) {
            //     switch (result.id) {
            //         case 'delete':
            //             break;
            //     }
            // }
        } catch (error) {
            showError(error);
        }
    }
</script>

<gridlayout
    bind:this={gridLayout}
    id="search"
    {...$$restProps}
    backgroundColor={!isEInk || focused ? colorWidgetBackground : 'transparent'}
    borderColor="#00000066"
    borderWidth={isEInk && !focused ? 1 : 0}
    columns="auto,*,auto,auto,auto,auto"
    elevation={$currentTheme !== 'dark' && !isEInk && focused ? 6 : 0}
    rows="auto,auto"
    on:tap={() => {}}>
    <IconButton gray={true} text="mdi-magnify" on:tap={showSearchOptions} />
    <!-- <label class="icon-label" text="mdi-magnify" color={colorOnSurfaceVariant} /> -->
    <textfield
        bind:this={textField}
        autocapitalizationType="none"
        col={1}
        color={colorOnSurface}
        floating={false}
        height={$actionBarButtonHeight}
        hint={$slc('search')}
        paddingLeft={0}
        placeholder={$slc('search')}
        returnKeyType="search"
        variant="none"
        verticalTextAlignment="center"
        on:blur={onBlur}
        on:returnPress={onReturnKey}
        on:textChange={(e) => onTextChanged(e['value'])}
        on:focus={onFocus} />
    <activityindicator busy={true} col={2} height={20} visibility={loading ? 'visible' : 'hidden'} width={20} />
    <IconButton col={2} gray={true} isVisible={currentSearchText && currentSearchText.length > 0 && !loading && didSearch} text="mdi-refresh" on:tap={reloadSearch} />
    <IconButton col={3} isSelected={searchAroundItem} isVisible={focused && !!item} text="mdi-map-marker-path" on:tap={() => (searchAroundItem = !searchAroundItem)} />
    <IconButton col={4} gray={true} isVisible={currentSearchText && currentSearchText.length > 0} text="mdi-close" on:tap={() => clearSearch()} />
    <IconButton accessibilityValue="menuBtn" col={5} gray={true} onLongPress={showMapOptions} text="mdi-dots-vertical" on:tap={showMapMenu} />
    {#if loaded}
        <absolutelayout bind:this={collectionViewHolder} id="searchCollectionViewHolder" clipToBounds={true} colSpan={7} height={0} isUserInteractionEnabled={searchResultsVisible} row={1}>
            <gridlayout id="searchCollectionViewSubHolder" columns="auto,auto,*" height={SEARCH_COLLECTIONVIEW_HEIGHT} rows="*,auto" width="100%">
                <SearchCollectionView bind:this={collectionView} colSpan={3} isUserInteractionEnabled={searchResultsVisible} bind:searchResultsCount bind:dataItems on:tap={onItemTap} />
                <stacklayout orientation="horizontal" row={1} width="100%" on:tap={() => {}}>
                    <!-- <IconButton small={true} isVisible={searchResultsVisible} text="mdi-shape" on:tap={toggleFilterOSMKey} isSelected={filteringOSMKey} /> -->
                    <IconButton isVisible={searchResultsVisible} small={true} text="mdi-map" on:tap={toggleShowResultsOnMap} />
                </stacklayout>
            </gridlayout>
        </absolutelayout>
    {/if}
</gridlayout>
