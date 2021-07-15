<script lang="ts">
    import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
    import { LoadFinishedEventData, ShouldOverrideUrlLoadEventData, AWebView } from '@nativescript-community/ui-webview';
    import { Folder, LoadEventData, WebView, knownFolders, path, Page, ObservableArray } from '@nativescript/core';
    import { MapTilerOnlineTileDataSource } from '@nativescript-community/ui-carto/datasources/maptiler';
    import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
    import { HandlerType, Manager } from '@nativescript-community/gesturehandler';

    import { MergedMBVTTileDataSource, TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { debounce } from 'push-it-to-the-limit';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { onDestroy, onMount } from 'svelte';
    import { Drawer } from '@nativescript-community/ui-drawer';
    import { request } from '@nativescript-community/perms';
    import { showError } from '~/utils/error';
    import { alpimapsFontFamily, mdiFontFamily, navigationBarHeight, primaryColor, textColor, widgetBackgroundColor } from '~/variables';
    import { Template } from 'svelte-native/components';
    import { lc } from '~/helpers/locale';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { convertDistance, formatDistance } from '~/helpers/formatter';
    import dayjs from 'dayjs';
    import { PorterDuffMode } from '@nativescript-community/ui-canvas';
    import type { Feature } from 'geojson';

    export let position;
    export let terrarium: boolean = false;
    export let dataSource: TileDataSource<any, any>;
    export let vectorDataSource: MBTilesTileDataSource | MergedMBVTTileDataSource<any, any>;
    export let rasterDataSource: TileDataSource<any, any>;
    let webView: NativeViewElementNode<AWebView>;
    let page: NativeViewElementNode<Page>;
    let drawer: NativeViewElementNode<Drawer>;
    let collectionView1: NativeViewElementNode<CollectionView>;
    let collectionView2: NativeViewElementNode<CollectionView>;
    // 45.182362864932706, 5.722772489758224,
    let webserver;
    let selectedItem: Feature & { distance: number } = null;

    const now = new Date();
    let secondsInDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const SCROLL_VIEW_TAG_1 = 9721;
    const SCROLL_VIEW_TAG_2 = 9722;
    let simultaneousHandlersTags = [SCROLL_VIEW_TAG_1, SCROLL_VIEW_TAG_2];
    let currentAltitude;
    let selectedPageIndex = 0;
    const consoleEnabled = !PRODUCTION;

    function truncate(str, maxlength) 
{
	return str.length > maxlength ?
		str.slice(0, maxlength - 1) + '…' : str;
}
    function getDefaultDataSource() {
        const cacheFolder = Folder.fromPath(path.join(knownFolders.documents().path, 'carto_cache'));
        const dataSource = new PersistentCacheTileDataSource({
            dataSource: new MapTilerOnlineTileDataSource({ key: 'V7KGiDaKQBCWTYsgsmxh' }),
            capacity: 300 * 1024 * 1024,
            databasePath: path.join(cacheFolder.path, 'cache.db')
        });
        return dataSource;
    }

    function formatSecondsInDay(value) {
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value - hours * 3600) / 60);
        const seconds = Math.floor(value - hours * 3600 - minutes * 60);
        return dayjs().hour(hours).minute(minutes).second(seconds).format('LT');
    }

    const updateElevation = debounce(function (elevation) {
        if (!webView) {
            return;
        }
        webView.nativeView.executeJavaScript(`webapp.setElevation(${elevation})`);
    }, 10);
    function refresh() {
        webView.nativeView.reload();
    }
    let shown = false;
    function onShownModally() {
        // called also on resume
        if (shown) {
            return;
        }
        shown = true;
        if (webView) {
            webView.nativeView.src = '~/assets/webapp.html';
        }
    }

    function webviewLoaded(args: LoadEventData) {
        const webview = args.object as AWebView;
        // webview.once('layoutChanged', () => {
        // webview.src = '~/assets/webapp.html';
        // });

        webview.once(AWebView.loadFinishedEvent, (args: LoadFinishedEventData) => {
            args.object.executeJavaScript(`webapp.setTerrarium(${terrarium});webapp.setPosition(${JSON.stringify({ ...position, altitude: currentAltitude })})`);
        });

        webview.on('requestPermissions', async (args: any) => {
            const wantedPerssions = args.permissions
                .map((p) => {
                    if (p === 'RECORD_AUDIO') {
                        return android.Manifest.permission.RECORD_AUDIO;
                    }

                    if (p === 'CAMERA') {
                        return android.Manifest.permission.CAMERA;
                    }

                    return p;
                })
                .filter((p) => !!p);
            const res = await request(wantedPerssions[0]);
            args.callback(res[0] === 'authorized');
        });

        // webview.on('gotMessage', (msg) => {
        //     console.log(`webview.gotMessage: ${JSON.stringify(msg.data)} (${typeof msg})`);
        // });
    }

    onMount(() => {
        // console.log('onMount', !!vectorDataSource, !!dataSource, !!rasterDataSource);
        try {
            webserver = new (akylas.alpi as any).maps.WebServer(8080, dataSource.getNative(), (vectorDataSource || getDefaultDataSource()).getNative(), rasterDataSource?.getNative());
            webserver.start();
        } catch (err) {
            console.error(err);
        }
    });
    onDestroy(() => {
        if (webserver) {
            webserver.stop();
        }
    });

    function callJSFunction(method: string, ...args) {
        // console.log('callJSFunction', method, ...args);
        if (!webView) {
            return;
        }
        try {
            if (args) {
                webView.nativeView.executeJavaScript(`webapp.${method}(${args.join(',')})`);
            } else {
                webView.nativeView.executeJavaScript(`webapp.${method}()`);
            }
        } catch (err) {
            showError(err);
        }
    }

    // async function toggleCamera() {
    //     // console.log('toggleCamera');
    //     try {
    //         callJSFunction('toggleCamera');
    //     } catch (err) {
    //         showError(err);
    //     }
    // }
    // function resetBearing() {
    //     callJSFunction('setAzimuth', 0);
    // }

    function onCheckBox(item, value: boolean) {
        callJSFunction(item.method, value);
    }

    function itemValue(item) {
        const result = item.value / (item.decimalFactor || 1);
        // console.log('itemValue', item.title, item.value, result)
        if (item.formatter) {
            return item.formatter(result);
        }
        return result + '';
    }

    const listView1Items = new ObservableArray([
        {
            type: 'checkbox',
            title: lc('dark_mode'),
            checked: false,
            method: 'setDarkMode'
        },
        {
            type: 'checkbox',
            title: lc('map_mode'),
            checked: false,
            method: 'setMapMode'
        },
        {
            type: 'checkbox',
            title: lc('map_outline'),
            checked: false,
            method: 'setMapOultine'
        },
        {
            type: 'checkbox',
            title: lc('day_night_cycle'),
            checked: false,
            method: 'setDayNightCycle'
        },
        {
            type: 'checkbox',
            title: lc('draw_features'),
            checked: false,
            method: 'setDebugFeaturePoints'
        },
        {
            type: 'checkbox',
            title: lc('draw_elevations'),
            checked: false,
            method: 'setDrawElevations'
        },
        {
            type: 'slider',
            min: 10,
            max: 400000,
            value: 173000,
            method: 'setViewingDistance',
            formatter: formatDistance,
            title: lc('viewing_distance')
        },
        {
            type: 'slider',
            min: 0,
            max: 86400,
            method: 'setDate',
            value: secondsInDay,
            formatter: formatSecondsInDay,
            title: lc('day_time')
        }
    ]);
    const listView2Items = new ObservableArray([
        {
            type: 'checkbox',
            title: lc('debug_mode'),
            checked: false,
            method: 'setDebugMode'
        },
        {
            type: 'checkbox',
            title: lc('compute_normals'),
            checked: false,
            method: 'setComputeNormals'
        },
        {
            type: 'checkbox',
            title: lc('draw_normals'),
            checked: false,
            method: 'setNormalsInDebug'
        },
        {
            type: 'checkbox',
            title: lc('read_Features'),
            checked: true,
            method: 'setReadFeatures'
        },
        {
            type: 'checkbox',
            title: lc('debug_gpu_picking'),
            checked: false,
            method: 'setDebugGPUPicking'
        },
        {
            type: 'checkbox',
            title: lc('show_fps'),
            checked: false,
            method: 'setShowStats'
        },
        {
            type: 'checkbox',
            title: lc('wireframe'),
            checked: false,
            method: 'setWireFrame'
        },
        {
            type: 'slider',
            min: 0,
            max: 6,
            formatter: (f) => f.toFixed(2),
            decimalFactor: 100,
            value: 1.7 * 100,
            method: 'setExageration',
            title: lc('exageration')
        },
        {
            type: 'slider',
            min: 0.01,
            max: 100,
            decimalFactor: 1000,
            formatter: (f) => f.toFixed(2),
            method: 'setDepthBiais',
            value: 6 * 1000,
            title: lc('depth_biais')
        },
        {
            type: 'slider',
            min: 0.01,
            max: 1000,
            decimalFactor: 1000,
            method: 'setDepthMultiplier',
            formatter: (f) => f.toFixed(2),
            value: 30 * 1000,
            title: lc('depth_multiplier')
        }
    ]);

    function drawerTranslationFunction(side, width, value, delta, progress) {
        if (side === 'left') {
            const result = {
                mainContent: {
                    translateX: 0
                },
                [side + 'Drawer']: {
                    translateX: side === 'left' ? -value : value
                }
                // backDrop: {
                //     translateX: 0,
                //     opacity: 0,
                // },
            } as any;
            if (side === 'left') {
                result.backDrop = {
                    translateX: 0,
                    opacity: progress
                };
            }
            return result;
        } else if (side === 'bottom') {
            const result = {
                mainContent: {
                    translateY: 0
                },
                [side + 'Drawer']: {
                    translateY: value
                }
                // backDrop: {
                //     translateX: 0,
                //     opacity: 0,
                // },
            } as any;
            result.backDrop = {
                translateY: 0,
                opacity: 0
            };
            return result;
        }
    }

    function selectTemplate(item, index, items) {
        // Your logic here
        return item.type;
    }
    $: {
        callJSFunction('setDate', secondsInDay);
    }
    $: currentAltitude = position.altitude + 10;
    $: updateElevation(currentAltitude);

    $: {
        if (collectionView1) {
            const manager = Manager.getInstance();
            const gestureHandler = manager.createGestureHandler(HandlerType.NATIVE_VIEW, SCROLL_VIEW_TAG_1, {
                shouldActivateOnStart: true,
                disallowInterruption: false
            });
            gestureHandler.attachToView(collectionView1.nativeView);
        }
    }

    function onFeatureSelected(event) {
        selectedItem = event.data;
    }
    function onPositionChanged(event) {
        currentAltitude = event.data.altitude;
    }
    function onViewingDistanceChanged(event) {}
    function onZoomChanged(event) {
        console.log('onZoomChanged', event.data);
    }

    function shouldPan(side) {
        if (side === 'bottom') {
            if (selectedPageIndex === 1) {
                return collectionView2.nativeView.scrollOffset <= 0;
            }
            return collectionView1.nativeView.scrollOffset <= 0;
        }
    }
    function onSliderValue(items: ObservableArray<any>, item, index, event) {
        // console.log('onSliderValue', item.title, item.value, index, event.value)
        callJSFunction(item.method, event.value / (item.decimalFactor || 1));
        item.value = event.value;
        items.setItem(index, item);
    }
</script>

<frame backgroundColor="transparent" on:shownModally={onShownModally}>
    <page bind:this={page} actionBarHidden={true}>
        <drawer
            bind:this={drawer}
            gestureMinDist={60}
            bottomClosedDrawerAllowDraging={false}
            simultaneousHandlers={simultaneousHandlersTags}
            {shouldPan}
            translationFunction={drawerTranslationFunction}
        >
            <gridLayout android:marginBottom={navigationBarHeight}>
                <awebview
                    bind:this={webView}
                    on:loaded={webviewLoaded}
                    webRTC={true}
                    mediaPlaybackRequiresUserAction={false}
                    webConsoleEnabled={consoleEnabled}
                    displayZoomControls={false}
                    on:selected={onFeatureSelected}
                    on:position={onPositionChanged}
                    on:zoom={onZoomChanged}
                />
                <!-- <canvaslabel marginTop="20" class="icon-btn" verticalAlignment="top" horizontalAlignment="left" rippleColor="#ffffff33" on:tap={toggleCamera} >
                    <cspan text="mdi-camera" verticalAlignment="center" textAlignment="center" color="red" xfermode={PorterDuffMode.SCREEN}/>
                </canvaslabel> -->

                <slider horizontalAlignment="left" verticalAlignment="center" bind:value={currentAltitude} minValue="0" maxValue="8000" style="transform: rotate(-90) translate(-80,50)" width="200" />

                <gridlayout
                    marginBottom="40"
                    verticalAlignment="bottom"
                    horizontalAlignment="center"
                    columns="*,auto"
                    width="60%"
                    padding={5}
                    visibility={!!selectedItem ? 'visible' : 'hidden'}
                    backgroundColor="#4465be94"
                    borderRadius={20}
                    height={40}
                >
                    <canvaslabel color="white" fontSize="13" paddingLeft={10} on:tap={(e) => callJSFunction('focusSelectedItem')}>
                        <cgroup verticalAlignment="center" verticalTextAlignment="center">
                            <cspan fontWeight="bold" text={selectedItem && truncate(selectedItem.properties.name, 25)} />
                            <cspan text={selectedItem && ` ${selectedItem.properties.ele}m(${formatDistance(selectedItem.distance)})`} />
                        </cgroup>
                    </canvaslabel>
                    <button col={1} width={40} on:tap={(e) => callJSFunction('goToSelectedItem')} fontFamily={alpimapsFontFamily} variant="text" text="alpimaps-paper-plane" />
                </gridlayout>
                <button
                    verticalAlignment="bottom"
                    horizontalAlignment="left"
                    color={primaryColor}
                    on:tap={(e) => callJSFunction('togglePredefinedMapMode')}
                    class="small-floating-btn"
                    text="mdi-map"
                />
                <button verticalAlignment="bottom" horizontalAlignment="right" color={primaryColor} on:tap={(e) => drawer.nativeView.toggle('bottom')} class="small-floating-btn" text="mdi-cog" />
            </gridLayout>
            <gridlayout prop:bottomDrawer height={300} rows="*,*" columns="30,*" backgroundColor={$widgetBackgroundColor} on:tap={() => {}}>
                <button variant="text" class="mdi" fontSize={16} width={undefined} text="mdi-cog" on:tap={() => (selectedPageIndex = 0)} />
                <button variant="text" row={1} class="mdi" fontSize={16} width={undefined} text="mdi-bug" on:tap={() => (selectedPageIndex = 1)} />
                <pager rowSpan={2} col={1} disableSwipe={false} bind:selectedIndex={selectedPageIndex}>
                    <pageritem>
                        <collectionview
                            bind:this={collectionView1}
                            items={listView1Items}
                            itemTemplateSelector={selectTemplate}
                            itemIdGenerator={(item, i) => i}
                            android:marginBottom={navigationBarHeight}
                        >
                            <Template let:item key="checkbox">
                                <checkbox text={item.title} checked={item.checked} on:checkedChange={(e) => onCheckBox(item, e.value)} />
                            </Template>
                            <Template let:item let:index key="slider">
                                <gridlayout rows="auto,*" columns="*,auto" orientation="horizontal" padding="0 10 0 10">
                                    <label text={item.title} colSpan={2} />
                                    <slider
                                        row={1}
                                        value={item.value}
                                        minValue={item.min}
                                        maxValue={item.max * (item.decimalFactor || 1)}
                                        stepSize={item.stepSize || 0}
                                        on:valueChange={(e) => onSliderValue(listView1Items, item, index, e)}
                                    />
                                    <label text={itemValue(item)} row={1} col={1} />
                                </gridlayout>
                            </Template>
                        </collectionview>
                    </pageritem>
                    <pageritem>
                        <collectionview
                            bind:this={collectionView2}
                            items={listView2Items}
                            itemTemplateSelector={selectTemplate}
                            itemIdGenerator={(item, i) => i}
                            android:marginBottom={navigationBarHeight}
                        >
                            <Template let:item key="checkbox">
                                <checkbox text={item.title} checked={item.checked} on:checkedChange={(e) => onCheckBox(item, e.value)} />
                            </Template>
                            <Template let:item let:index key="slider">
                                <gridlayout rows="auto,*" columns="*,auto" orientation="horizontal" padding="0 10 0 10">
                                    <label text={item.title} colSpan={2} />
                                    <slider
                                        row={1}
                                        value={item.value}
                                        minValue={item.min}
                                        maxValue={item.max * (item.decimalFactor || 1)}
                                        stepSize={item.stepSize || 0}
                                        on:valueChange={(e) => onSliderValue(listView2Items, item, index, e)}
                                    />
                                    <label text={itemValue(item)} row={1} col={1} />
                                </gridlayout>
                            </Template>
                        </collectionview>
                    </pageritem>
                </pager>
            </gridlayout>
        </drawer>
    </page>
</frame>
