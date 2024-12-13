<script lang="ts">
    import { request } from '@nativescript-community/perms';
    import { estimateMagneticField, startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
    import { MultiTileDataSource, TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
    import { MapTilerOnlineTileDataSource } from '@nativescript-community/ui-carto/datasources/maptiler';
    import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { AWebView, LoadFinishedEventData } from '@nativescript-community/ui-webview';
    import { Folder, LoadEventData, ObservableArray, Page, Utils, path } from '@nativescript/core';
    import { getBoolean, getNumber, setBoolean, setNumber } from '@nativescript/core/application-settings';
    import { debounce } from '@nativescript/core/utils';
    import dayjs from 'dayjs';
    import type { Feature } from 'geojson';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { formatDistance } from '~/helpers/formatter';
    import { formatTime, lc } from '~/helpers/locale';
    import { showError } from '@shared/utils/showError';
    import { getDataFolder } from '~/utils/utils';
    import { colors, fonts, windowInset } from '~/variables';

    $: ({ colorOnSurface, colorPrimary, colorSurfaceContainer } = $colors);
    export let position;
    export let bearing;
    export let terrarium: boolean = false;
    export let dataSource: TileDataSource<any, any>;
    export let vectorDataSource: MBTilesTileDataSource | MultiTileDataSource<any, any>;
    export let rasterDataSource: TileDataSource<any, any>;
    let webView: NativeViewElementNode<AWebView>;
    let page: NativeViewElementNode<Page>;
    let collectionView1: NativeViewElementNode<CollectionView>;
    let collectionView2: NativeViewElementNode<CollectionView>;
    let selectedItem: Feature & { distance: number } = null;
    let bottomSheetStepIndex = 0;

    const now = new Date();
    const secondsInDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const SCROLL_VIEW_TAG_1 = 9721;
    const SCROLL_VIEW_TAG_2 = 9722;
    const simultaneousHandlersTags = [];
    // let simultaneousHandlersTags = [SCROLL_VIEW_TAG_1, SCROLL_VIEW_TAG_2];
    let currentAltitude;
    let selectedPageIndex = 0;
    // const consoleEnabled = false;
    const consoleEnabled = !PRODUCTION;

    function truncate(str, maxlength) {
        return str.length > maxlength ? str.slice(0, maxlength - 1) + '…' : str;
    }
    function getDefaultDataSource() {
        const cacheFolder = Folder.fromPath(path.join(getDataFolder(), 'carto_cache'));
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
        return formatTime(dayjs().hour(hours).minute(minutes).second(seconds));
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
                terrarium,
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
            console.error(error, error.stack);
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
            console.error(error, error.stack);
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
        currentHeight = Utils.layout.toDeviceIndependentPixels(event.object.getMeasuredHeight());
        sliderHeight = 0.7 * currentHeight;
    }
    function createCustomWebViewClient(webview: AWebView, webClientClass) {
        const originalClient = new webClientClass(webview);
        const vDataSource = (vectorDataSource || getDefaultDataSource()).getNative();
        const client = new (akylas as any).alpi.maps.WebViewClient(originalClient, dataSource?.getNative(), vDataSource, vDataSource, rasterDataSource?.getNative());
        // this crashes in production saying no originalClient property ...
        // client.originalClient = originalClient;
        return client;
    }
    function itemIdGenerator(item, i) {
        return i;
    }
</script>

<page bind:this={page} actionBarHidden={true} on:navigatedTo={onNavigatedTo}>
    <bottomsheet
        panGestureOptions={{ failOffsetXEnd: 50, minDist: 150 }}
        {shouldPan}
        stepIndex={bottomSheetStepIndex}
        steps={[0, 300]}
        on:stepIndexChange={(e) => (bottomSheetStepIndex = e.value)}
        android:marginBottom={$windowInset.bottom}
        android:paddingLeft={$windowInset.left}
        android:paddingRight={$windowInset.right}>
        <gridlayout height="100%" width="100%" on:layoutChanged={onLayoutChanged}>
            <awebview
                bind:this={webView}
                createWebViewClient={createCustomWebViewClient}
                debugMode={consoleEnabled}
                displayZoomControls={false}
                domStorage={true}
                mediaPlaybackRequiresUserAction={false}
                normalizeUrls={false}
                webConsoleEnabled={consoleEnabled}
                webRTC={true}
                on:loaded={webviewLoaded}
                on:sensors={onSensorsToggle}
                on:selected={onFeatureSelected}
                on:position={onPositionChanged}
                on:zoom={onZoomChanged} />
            <slider
                style={`transform: rotate(-90) translate(20,${sliderHeight * 0.5})`}
                horizontalAlignment="left"
                maxValue={6000}
                minValue={0}
                originX={0}
                value={currentAltitude}
                verticalAlignment="middle"
                width={sliderHeight}
                on:valueChange={(e) => (currentAltitude = e['value'])} />

            <gridlayout
                backgroundColor="#4465be94"
                borderRadius={20}
                columns="*,auto"
                height={40}
                horizontalAlignment="center"
                marginBottom={50}
                padding={5}
                verticalAlignment="bottom"
                visibility={!!selectedItem ? 'visible' : 'hidden'}
                width="60%">
                <canvaslabel color="white" fontSize={13} paddingLeft={10} on:tap={(e) => callJSFunction('focusSelectedItem')}>
                    <cgroup verticalAlignment="middle" verticalTextAlignment="center">
                        <cspan fontWeight="bold" text={selectedItem && truncate(selectedItem.properties.name, 25)} />
                        <cspan text={selectedItem && ` ${selectedItem.properties.ele}m(${formatDistance(selectedItem.distance)})`} />
                    </cgroup>
                </canvaslabel>
                <mdbutton col={1} color="white" fontFamily={$fonts.app} text="alpimaps-paper-plane" variant="text" width={40} on:tap={(e) => callJSFunction('goToSelectedItem')} />
            </gridlayout>
            <stacklayout horizontalAlignment="left" marginLeft={5} orientation="horizontal" verticalAlignment="bottom">
                <mdbutton class="small-floating-btn" color={colorPrimary} text="mdi-map" on:tap={(e) => toggleSetting('mapMap')} />
                <mdbutton class="small-floating-btn" color={colorPrimary} text="mdi-compass" on:tap={(e) => (listeningForHeading ? stopHeadingListener() : startHeadingListener())} />
                <mdbutton class="small-floating-btn" color={colorPrimary} text="mdi-cog" on:tap={(e) => (bottomSheetStepIndex = 1 - bottomSheetStepIndex)} />
            </stacklayout>
            <mdactivityindicator busy={true} horizontalAlignment="right" verticalAlignment="bottom" visibility={listeningForHeading ? 'visible' : 'hidden'} />
            <label color={colorOnSurface} fontSize={12} horizontalAlignment="right" paddingRight={10} text={currentAltitude?.toFixed(0) + 'm'} verticalAlignment="bottom" />
            <label
                class="alpimaps"
                fontSize={80}
                horizontalAlignment="right"
                marginBottom={100}
                text="alpimaps-compass-calibrate"
                verticalAlignment="bottom"
                visibility={!listeningForHeading || headingAccuracy >= 2 ? 'hidden' : 'visible'} />
        </gridlayout>
        <gridlayout prop:bottomSheet backgroundColor={colorSurfaceContainer} columns="*,*" height={300} rows="30,*" width="100%" on:tap={() => {}}>
            <mdbutton class="mdi" fontSize={16} text="mdi-cog" variant="text" width={undefined} on:tap={() => (selectedPageIndex = 0)} />
            <mdbutton class="mdi" col={1} fontSize={16} text="mdi-bug" variant="text" width={undefined} on:tap={() => (selectedPageIndex = 1)} />
            <pager colSpan={2} disableSwipe={false} row={1} selectedIndex={selectedPageIndex} on:selectedIndexChange={(e) => (selectedPageIndex = e['value'])}>
                <pageritem>
                    <collectionview bind:this={collectionView1} {itemIdGenerator} itemTemplateSelector={selectTemplate} items={listView1Items} android:marginBottom={windowInsetBottom}>
                        <Template key="checkbox" let:item>
                            <checkbox checked={item.value} text={item.title} on:checkedChange={(e) => onCheckBox(item, e.value)} />
                        </Template>
                        <Template key="slider" let:item>
                            <gridlayout columns="*,auto" padding="0 10 0 10" rows="auto,*">
                                <label colSpan={2} text={item.title} />
                                <slider
                                    maxValue={item.max * (item.decimalFactor || 1)}
                                    minValue={item.min * (item.decimalFactor || 1)}
                                    row={1}
                                    stepSize={item.stepSize}
                                    value={item.value * (item.decimalFactor || 1)}
                                    on:valueChange={(e) => onSliderValue(listView1Items, item, e)} />
                                <label col={1} row={1} text={itemValue(item)} on:tap={() => promptSliderValue(listView1Items, item)} />
                            </gridlayout>
                        </Template>
                    </collectionview>
                </pageritem>
                <pageritem>
                    <collectionview bind:this={collectionView2} {itemIdGenerator} itemTemplateSelector={selectTemplate} items={listView2Items} android:marginBottom={windowInsetBottom}>
                        <Template key="checkbox" let:item>
                            <checkbox checked={item.value} text={item.title} on:checkedChange={(e) => onCheckBox(item, e.value)} />
                        </Template>
                        <Template key="slider" let:item>
                            <gridlayout columns="*,auto" padding="0 10 0 10" rows="auto,*">
                                <label colSpan={2} text={item.title} />
                                <slider
                                    maxValue={item.max * (item.decimalFactor || 1)}
                                    minValue={item.min * (item.decimalFactor || 1)}
                                    row={1}
                                    stepSize={item.stepSize || 0.1}
                                    value={item.value * (item.decimalFactor || 1)}
                                    on:valueChange={(e) => onSliderValue(listView2Items, item, e)} />
                                <label col={1} row={1} text={itemValue(item)} on:tap={() => promptSliderValue(listView2Items, item)} />
                            </gridlayout>
                        </Template>
                    </collectionview>
                </pageritem>
            </pager>
        </gridlayout>
    </bottomsheet>
</page>
