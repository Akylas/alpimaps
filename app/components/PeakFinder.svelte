<script lang="ts">
    import { request } from '@nativescript-community/perms';
    import { estimateMagneticField, startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
    import { MergedMBVTTileDataSource, TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
    import { MapTilerOnlineTileDataSource } from '@nativescript-community/ui-carto/datasources/maptiler';
    import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { AWebView, LoadFinishedEventData, WebViewEventData } from '@nativescript-community/ui-webview';
    import { Folder, knownFolders, LoadEventData, ObservableArray, Page, path } from '@nativescript/core';
    import { getBoolean, getNumber, setBoolean, setNumber } from '@nativescript/core/application-settings';
    import { layout } from '@nativescript/core/utils';
    import dayjs from 'dayjs';
    import type { Feature } from 'geojson';
    import { debounce } from 'push-it-to-the-limit/target/es6';
    import { onDestroy, onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { showError } from '~/utils/error';
    import { alpimapsFontFamily, navigationBarHeight, primaryColor, textColorDark, textColorLight, widgetBackgroundColor } from '~/variables';

    export let position;
    export let bearing;
    export let terrarium: boolean = false;
    export let dataSource: TileDataSource<any, any>;
    export let vectorDataSource: MBTilesTileDataSource | MergedMBVTTileDataSource<any, any>;
    export let rasterDataSource: TileDataSource<any, any>;
    let webView: NativeViewElementNode<AWebView>;
    let page: NativeViewElementNode<Page>;
    let collectionView1: NativeViewElementNode<CollectionView>;
    let collectionView2: NativeViewElementNode<CollectionView>;
    let selectedItem: Feature & { distance: number } = null;
    let bottomSheetStepIndex = 0;

    const now = new Date();
    let secondsInDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const SCROLL_VIEW_TAG_1 = 9721;
    const SCROLL_VIEW_TAG_2 = 9722;
    let simultaneousHandlersTags = [];
    // let simultaneousHandlersTags = [SCROLL_VIEW_TAG_1, SCROLL_VIEW_TAG_2];
    let currentAltitude;
    let selectedPageIndex = 0;
    const consoleEnabled = false;
    // const consoleEnabled = !PRODUCTION;

    function truncate(str, maxlength) {
        return str.length > maxlength ? str.slice(0, maxlength - 1) + '…' : str;
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
        if (isNaN(elevation)) {
            return;
        }
        callJSFunction('setSettings', 'elevation', elevation);
    }, 10);
    function refresh() {
        webView.nativeView.reload();
    }
    let shown = false;
    function onNavigatedTo() {
        // called also on resume
        if (shown) {
            return;
        }
        shown = true;
        if (webView) {
            // webView.nativeView.src = 'http://192.168.1.51:3000/?stats=true';
            webView.nativeView.src = '~/assets/peakfinder/index.html';
        }
    }

    function webviewLoaded(args: LoadEventData) {
        const webview = args.object as AWebView;

        webview.once(AWebView.loadFinishedEvent, (args: LoadFinishedEventData) => {
            const startValues = {
                terrarium: terrarium,
                setPosition: { ...position, altitude: currentAltitude },
                setAzimuth: bearing
            };
            listView1Items.forEach((item) => {
                startValues[item.key || item['method']] = item.value as number;
            });
            listView2Items.forEach((item) => {
                startValues[item.key || item['method']] = item.value as number;
            });
            args.object.executeJavaScript(`webapp.callMethods(${JSON.stringify(startValues)});`);
        });

        webview.on('requestPermissions', async (args: any) => {
            const wantedPerssions = args.permissions
                .map((p) => {
                    if (p === 'RECORD_AUDIO') {
                        return 'android.permission.RECORD_AUDIO';
                    }

                    if (p === 'CAMERA') {
                        return 'android.permission.CAMERA';
                    }

                    return p;
                })
                .filter((p) => !!p);
            const res = await request(wantedPerssions[0]);
            args.callback(res[0] === 'authorized');
        });
    }

    // onMount(() => {
    // console.log('onMount', !!vectorDataSource, !!dataSource, !!rasterDataSource);
    // try {
    //     const vDataSource = (vectorDataSource || getDefaultDataSource()).getNative();
    //     webserver = new (akylas.alpi as any).maps.WebServer(8080, dataSource.getNative(), vDataSource, vDataSource, rasterDataSource?.getNative());
    //     webserver.start();
    // } catch (err) {
    //     console.error(err);
    // }
    // });
    // onDestroy(() => {
    //     if (webserver) {
    //         webserver.stop();
    //     }
    // });

    function callJSFunction(method: string, ...args) {
        // if (DEV_LOG) {
        //     console.log('callJSFunction', method, `webapp.${method}(${args ? args.map((s) => (typeof s === 'string' ? `"${s}"` : s)).join(',') : ''})`);
        // }
        const nView = webView?.nativeView;
        if (!nView) {
            return;
        }
        try {
            nView.executeJavaScript(`webapp.${method}(${args ? args.map((s) => (typeof s === 'string' ? `"${s}"` : s)).join(',') : ''})`);
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
    function itemKey(item) {
        const method = item.method as string;
        if (method) {
            return method[3].toLowerCase() + method.slice(4);
        }
        return item.key;
    }
    function saveItem(item, value, number = false) {
        if (item.key === 'dark') {
            darkMode = value;
        }
        if (item.shouldSave) {
            if (number) {
                setNumber(`peakfinder_${itemKey(item)}`, value);
            } else {
                setBoolean(`peakfinder_${itemKey(item)}`, value);
            }
        }
    }
    function onCheckBox(item, value: boolean) {
        try {
            if (item.key) {
                callJSFunction('setSettings', item.key, value);
            } else {
                callJSFunction(item.method, value);
            }
            saveItem(item, value);
        } catch (error) {
            console.error(error);
        }
    }

    function itemValue(item) {
        const result = item.value;
        // console.log('itemValue', item.title, item.value, result)
        if (item.formatter) {
            return item.formatter(result);
        }
        return result + '';
    }

    let darkMode = getBoolean('peakfinder_darkMode', false);

    const listView1Items = new ObservableArray([
        {
            type: 'checkbox',
            title: lc('dark_mode'),
            shouldSave: true,
            value: darkMode,
            key: 'dark'
        },
        {
            type: 'checkbox',
            title: lc('map_mode'),
            shouldSave: true,
            value: getBoolean('peakfinder_mapMap', false),
            key: 'mapMap'
        },
        {
            type: 'checkbox',
            title: lc('generateColor'),
            shouldSave: true,
            value: getBoolean('peakfinder_generateColor', false),
            key: 'generateColor'
        },
        {
            type: 'checkbox',
            title: lc('outline'),
            shouldSave: true,
            value: getBoolean('peakfinder_outline', true),
            key: 'outline'
        },
        {
            type: 'checkbox',
            title: lc('dayNightCycle'),
            shouldSave: true,
            value: getBoolean('peakfinder_dayNightCycle', false),
            key: 'dayNightCycle'
        },
        {
            type: 'checkbox',
            title: lc('shadows'),
            shouldSave: true,
            value: getBoolean('peakfinder_shadows', true),
            key: 'shadows'
        },
        {
            type: 'checkbox',
            title: lc('draw_elevations'),
            shouldSave: true,
            value: getBoolean('peakfinder_drawElevations', false),
            key: 'drawElevations'
        },
        {
            type: 'slider',
            min: 10,
            max: 400000,
            shouldSave: true,
            value: getNumber('peakfinder_viewingDistance', 173000),
            key: 'far',
            formatter: formatDistance,
            title: lc('viewing_distance')
        },
        {
            type: 'slider',
            min: 10,
            max: 80,
            shouldSave: true,
            value: getNumber('peakfinder_cameraFOVFactor', 28.605121612548828),
            key: 'fovFactor',
            formatter: formatDistance,
            title: lc('camera_fov')
        },
        {
            type: 'slider',
            min: 0,
            max: 86400,
            key: 'secondsInDay',
            value: secondsInDay,
            formatter: formatSecondsInDay,
            title: lc('day_time')
        }
    ]);
    const listView2Items = new ObservableArray([
        {
            type: 'checkbox',
            title: lc('debug_mode'),
            value: false,
            key: 'debug'
        },
        {
            type: 'checkbox',
            title: lc('read_features'),
            value: true,
            key: 'readFeatures'
        },
        {
            type: 'checkbox',
            title: lc('show_fps'),
            value: !PRODUCTION,
            key: 'stats'
        },
        {
            type: 'checkbox',
            title: lc('wireframe'),
            value: false,
            key: 'wireframe'
        },
        {
            type: 'checkbox',
            title: lc('debug_gpu_picking'),
            value: false,
            key: 'debugGPUPicking'
        },
        {
            type: 'checkbox',
            title: lc('draw_features'),
            value: false,
            key: 'debugFeaturePoints'
        },
        {
            type: 'checkbox',
            title: lc('compute_normals'),
            value: false,
            key: 'computeNormals'
        },
        {
            type: 'checkbox',
            title: lc('draw_normals'),
            value: false,
            key: 'drawNormals'
        },
        {
            type: 'slider',
            min: 0,
            max: 6,
            shouldSave: true,
            formatter: (f) => f.toFixed(2),
            decimalFactor: 100,
            value: getNumber('peakfinder_exageration', 1.6),
            key: 'exageration',
            title: lc('exageration')
        },
        {
            type: 'slider',
            min: 0,
            max: 2,
            shouldSave: true,
            decimalFactor: 100,
            formatter: (f) => f.toFixed(2),
            key: 'depthBiais',
            value: getNumber('peakfinder_depthBiais', 0.23),
            title: lc('depth_biais')
        },
        {
            type: 'slider',
            min: 0,
            max: 120,
            shouldSave: true,
            decimalFactor: 100,
            key: 'depthMultiplier',
            formatter: (f) => f.toFixed(2),
            value: getNumber('peakfinder_depthMultiplier', 11),
            title: lc('depth_multiplier')
        },
        {
            type: 'slider',
            min: 16,
            max: 512,
            shouldSave: true,
            transformer: (value) => {
                value = Math.round(value);
                if (value % 2 === 1) {
                    return value - 1;
                }
                return value;
            },
            key: 'geometrySize',
            formatter: (f) => f.toFixed(),
            value: getNumber('peakfinder_geometrySize', 320),
            title: lc('geometry_size')
        }
    ]);

    function selectTemplate(item, index, items) {
        // Your logic here
        return item.type;
    }
    $: {
        callJSFunction('setDate', secondsInDay);
    }
    $: currentAltitude = position.altitude;
    $: updateElevation(currentAltitude);

    // $: {
    //     if (collectionView1) {
    //         const manager = Manager.getInstance();
    //         const gestureHandler = manager.createGestureHandler(HandlerType.NATIVE_VIEW, SCROLL_VIEW_TAG_1, {
    //             shouldActivateOnStart: true,
    //             disallowInterruption: false
    //         });
    //         gestureHandler.attachToView(collectionView1.nativeView);
    //     }
    // }

    function onFeatureSelected(event) {
        selectedItem = event.data;
    }
    function onPositionChanged(event) {
        position = event.data;
    }

    function onSensorsToggle(event) {
        if (event.data) {
            startHeadingListener();
        } else {
            stopHeadingListener();
        }
    }
    function onViewingDistanceChanged(event) {}
    function onZoomChanged(event) {}

    function shouldPan(side) {
        if (side === 'bottom') {
            if (selectedPageIndex === 1) {
                return collectionView2.nativeView.scrollOffset <= 0;
            }
            return collectionView1.nativeView.scrollOffset <= 0;
        }
    }

    function toggleSetting(key) {
        let item;
        let index = listView1Items.findIndex((i) => i.key === key);
        if (index >= 0) {
            item = listView1Items.getItem(index);
        } else {
            index = listView2Items.findIndex((i) => i.key === key);
            if (index >= 0) {
                item = listView2Items.getItem(index);
            }
        }
        if (item) {
            onCheckBox(item, !item.value);
        }
    }
    function onSliderValue(items: ObservableArray<any>, item, event) {
        try {
            let newValue = event.value / (item.decimalFactor || 1);
            if (item.transformer) {
                newValue = item.transformer(newValue);
            }
            saveItem(item, newValue, true);
            if (item.key) {
                callJSFunction('setSettings', item.key, newValue);
            } else {
                callJSFunction(item.method, newValue);
            }
            const index = items.findIndex((i) => i === item);
            item.value = newValue;
            items.setItem(index, item);
        } catch (error) {
            console.error(error);
        }
    }

    async function promptSliderValue(items: ObservableArray<any>, item) {
        const result = await prompt({
            defaultText: item.value * (item.decimalFactor || 1) + '',
            capitalizationType: 'none',
            textFieldProperties: {
                keyboardType: 'number'
            }
        });

        if (result?.result) {
            onSliderValue(items, item, { value: parseFloat(result.text) });
        }
    }

    let listeningForHeading = false;
    let headingAccuracy: number;
    function startHeadingListener() {
        if (!listeningForHeading) {
            listeningForHeading = true;
            headingAccuracy = undefined;
            startListeningForSensor('heading', onSensor, 100, 0, { headingFilter: 0 });
        }
    }
    function stopHeadingListener() {
        if (listeningForHeading) {
            listeningForHeading = false;
            headingAccuracy = 4;
            stopListeningForSensor('heading', onSensor);
        }
    }

    function onSensor(data, sensor: string) {
        switch (sensor) {
            case 'heading':
                if (__ANDROID__) {
                    headingAccuracy = data.accuracy;
                } else {
                    headingAccuracy = 4 - data.accuracy;
                }
                // console.log('heading', data.accuracy, headingAccuracy)
                if (headingAccuracy < 3) {
                    return;
                }
                stopHeadingListener();
                if (__ANDROID__ && !('trueHeading' in data) && position) {
                    const res = estimateMagneticField(position.lat, position.lon, position.altitude);
                    if (res) {
                        data.trueHeading = data.heading + res.getDeclination();
                    }
                }
                const newValue = 'trueHeading' in data ? data.trueHeading : data.heading;
                callJSFunction('setAzimuth', 360 - newValue);
                break;
        }
    }
    let currentHeight = 0;
    let sliderHeight = 0;
    function onLayoutChanged(event) {
        currentHeight = layout.toDeviceIndependentPixels(event.object.getMeasuredHeight());
        sliderHeight = 0.7 * currentHeight;
    }
    function createCustomWebViewClient(webview: AWebView, webClientClass) {
        const originalClient = new webClientClass(webview);
        const vDataSource = (vectorDataSource || getDefaultDataSource()).getNative();
        const client = new (akylas as any).alpi.maps.WebViewClient(originalClient, dataSource?.getNative(), vDataSource, vDataSource, rasterDataSource?.getNative());
        client.originalClient = originalClient;
        return client;
    }
    function itemIdGenerator(item, i) {
        return i;
    }
</script>

<page bind:this={page} actionBarHidden={true} on:navigatedTo={onNavigatedTo}>
    <bottomsheet on:stepIndexChange={(e) => (bottomSheetStepIndex = e.value)} steps={[0, 300]} stepIndex={bottomSheetStepIndex} panGestureOptions={{ failOffsetXEnd: 50, minDist: 150 }} {shouldPan}>
        <gridLayout android:marginBottom={$navigationBarHeight} on:layoutChanged={onLayoutChanged}>
            <awebview
                bind:this={webView}
                on:loaded={webviewLoaded}
                createWebViewClient={createCustomWebViewClient}
                webRTC={true}
                normalizeUrls={false}
                domStorage={true}
                mediaPlaybackRequiresUserAction={false}
                debugMode={consoleEnabled}
                webConsoleEnabled={consoleEnabled}
                displayZoomControls={false}
                on:sensors={onSensorsToggle}
                on:selected={onFeatureSelected}
                on:position={onPositionChanged}
                on:zoom={onZoomChanged}
            />
            <slider
                horizontalAlignment="left"
                verticalAlignment="center"
                value={currentAltitude}
                on:valueChange={(e) => (currentAltitude = e['value'])}
                minValue="0"
                maxValue="6000"
                originX={0}
                style={`transform: rotate(-90) translate(20,${sliderHeight * 0.5})`}
                width={sliderHeight}
            />

            <gridlayout
                marginBottom={50}
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
                <button col={1} width={40} on:tap={(e) => callJSFunction('goToSelectedItem')} fontFamily={alpimapsFontFamily} variant="text" text="alpimaps-paper-plane" color="white" />
            </gridlayout>
            <stacklayout verticalAlignment="bottom" horizontalAlignment="left" orientation="horizontal" marginLeft={5}>
                <button color={primaryColor} on:tap={(e) => toggleSetting('mapMap')} class="small-floating-btn" text="mdi-map" />
                <button color={primaryColor} on:tap={(e) => (listeningForHeading ? stopHeadingListener() : startHeadingListener())} class="small-floating-btn" text="mdi-compass" />
                <button color={primaryColor} on:tap={(e) => (bottomSheetStepIndex = 1 - bottomSheetStepIndex)} class="small-floating-btn" text="mdi-cog" />
            </stacklayout>
            <mdactivityindicator visibility={listeningForHeading ? 'visible' : 'collapsed'} verticalAlignment="bottom" horizontalAlignment="right" busy={true} />
            <label text={currentAltitude?.toFixed(0) + 'm'} horizontalAlignment="right" verticalAlignment="bottom" fontSize="12" color={darkMode ? textColorDark : textColorLight} paddingRight={10} />
            <label
                visibility={!listeningForHeading || headingAccuracy >= 2 ? 'hidden' : 'visible'}
                class="alpimaps"
                text="alpimaps-compass-calibrate"
                horizontalAlignment="right"
                verticalAlignment="bottom"
                fontSize="80"
                marginBottom={100}
            />
        </gridLayout>
        <gridlayout prop:bottomSheet height={300} rows="30,*" columns="*,*" backgroundColor={$widgetBackgroundColor} on:tap={() => {}}>
            <button variant="text" class="mdi" fontSize={16} width={undefined} text="mdi-cog" on:tap={() => (selectedPageIndex = 0)} />
            <button variant="text" col={1} class="mdi" fontSize={16} width={undefined} text="mdi-bug" on:tap={() => (selectedPageIndex = 1)} />
            <pager colSpan={2} row={1} disableSwipe={false} selectedIndex={selectedPageIndex} on:selectedIndexChange={(e) => (selectedPageIndex = e['value'])}>
                <pageritem>
                    <collectionview bind:this={collectionView1} items={listView1Items} itemTemplateSelector={selectTemplate} {itemIdGenerator} android:marginBottom={$navigationBarHeight}>
                        <Template let:item key="checkbox">
                            <checkbox text={item.title} checked={item.value} on:checkedChange={(e) => onCheckBox(item, e.value)} />
                        </Template>
                        <Template let:item key="slider">
                            <gridlayout rows="auto,*" columns="*,auto" orientation="horizontal" padding="0 10 0 10">
                                <label text={item.title} colSpan={2} />
                                <slider
                                    row={1}
                                    value={item.value * (item.decimalFactor || 1)}
                                    minValue={item.min * (item.decimalFactor || 1)}
                                    maxValue={item.max * (item.decimalFactor || 1)}
                                    stepSize={item.stepSize || 0}
                                    on:valueChange={(e) => onSliderValue(listView1Items, item, e)}
                                />
                                <label text={itemValue(item)} row={1} col={1} on:tap={() => promptSliderValue(listView1Items, item)} />
                            </gridlayout>
                        </Template>
                    </collectionview>
                </pageritem>
                <pageritem>
                    <collectionview bind:this={collectionView2} items={listView2Items} itemTemplateSelector={selectTemplate} {itemIdGenerator} android:marginBottom={$navigationBarHeight}>
                        <Template let:item key="checkbox">
                            <checkbox text={item.title} checked={item.value} on:checkedChange={(e) => onCheckBox(item, e.value)} />
                        </Template>
                        <Template let:item key="slider">
                            <gridlayout rows="auto,*" columns="*,auto" orientation="horizontal" padding="0 10 0 10">
                                <label text={item.title} colSpan={2} />
                                <slider
                                    row={1}
                                    value={item.value * (item.decimalFactor || 1)}
                                    minValue={item.min * (item.decimalFactor || 1)}
                                    maxValue={item.max * (item.decimalFactor || 1)}
                                    stepSize={item.stepSize || 0}
                                    on:valueChange={(e) => onSliderValue(listView2Items, item, e)}
                                />
                                <label text={itemValue(item)} row={1} col={1} on:tap={() => promptSliderValue(listView2Items, item)} />
                            </gridlayout>
                        </Template>
                    </collectionview>
                </pageritem>
            </pager>
        </gridlayout>
    </bottomsheet>
</page>
