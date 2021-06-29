<script lang="ts" context="module">
    import { ClickType, fromNativeMapBounds, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { VectorLayer } from '@nativescript-community/ui-carto/layers/vector';
    import type { VectorElementEventData, VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { RoutingResult, RoutingService } from '@nativescript-community/ui-carto/routing';
    import type { ValhallaProfile } from '@nativescript-community/ui-carto/routing';
    import { Group } from '@nativescript-community/ui-carto/vectorelements/group';
    import { Line, LineEndType, LineJointType, LineStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/line';
    import { Marker, MarkerStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/marker';
    import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
    import { Text, TextStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/text';
    import { ObservableArray, TextField } from '@nativescript/core';
    import { Device, GridLayout, StackLayout } from '@nativescript/core';
    import { onDestroy } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import { Route, RoutingAction } from '~/models/Route';
    import type { RouteInstruction } from '~/models/Route';
    import { packageService } from '~/services/PackageService';
    import { omit } from '~/utils/utils';
    import { globalMarginTop, mdiFontFamily, primaryColor } from '~/variables';

    function routingResultToJSON(result: RoutingResult<LatLonKeys>) {
        const rInstructions = result.getInstructions();
        const instructions: RouteInstruction[] = [];
        // const positions = getPointsFromResult(result);
        for (let i = 0; i < rInstructions.size(); i++) {
            const instruction = rInstructions.get(i);
            const index = instruction.getPointIndex();
            instructions.push({
                a: RoutingAction[instruction.getAction().toString().replace('ROUTING_ACTION_', '')],
                az: Math.round(instruction.getAzimuth()),
                dist: instruction.getDistance(),
                time: instruction.getTime(),
                index,
                angle: Math.round(instruction.getTurnAngle()),
                name: instruction.getStreetName(),
                inst: (instruction as any).getInstruction()
            });
        }
        const res = {
            positions: result.getPoints(),
            totalTime: result.getTotalTime(),
            totalDistance: result.getTotalDistance(),
            instructions
        } as Route;

        return res;
    }

</script>

<script lang="ts">
    import { getDistanceSimple } from '~/helpers/geolib';
    import { convertDistance, convertValueToUnit, formatValueToUnit } from '~/helpers/formatter';
    import { getCenter } from '~/utils/geo';
    import { showError } from '~/utils/error';
    import { lc } from '~/helpers/locale';
    import { Template } from 'svelte-native/components';

    const mapContext = getMapContext();
    export let translationFunction: Function = null;
    let opened = false;
    let _routeDataSource: LocalVectorDataSource;
    let _routeLayer: VectorLayer;
    let waypoints: ObservableArray<{
        marker: Group;
        position: MapPos<LatLonKeys>;
        isStart: boolean;
        isStop: boolean;
        metaData: any;
        text: string;
    }> = new ObservableArray([]);
    let nbWayPoints = 0;
    let profile: ValhallaProfile = 'pedestrian';
    let showOptions = true;
    let loading = false;
    let currentRoute: Route;
    let currentLine: Line;
    let line: Line<LatLonKeys>;
    let loaded = false;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let topLayout: NativeViewElementNode<StackLayout>;

    const valhallaSettings = {
        use_hills: {
            min: 0.25,
            max: 1
        },
        use_tracks: {
            min: 0.25,
            max: 1
        },
        use_roads: {
            min: 0,
            max: 1
        },
        max_hiking_difficulty: {
            min: 1,
            max: 6
        },
        avoid_bad_surfaces: {
            min: 0.25,
            max: 1
        },
        use_ferry: {
            min: 0,
            max: 1
        },
        step_penalty: {
            min: 20,
            max: 5
        }
    };

    let costingOptions = { use_ferry: 0, shortest: false };
    let profileCostingOptions = {
        pedestrian: { use_hills: 1, max_hiking_difficulty: 6, step_penalty: 5, driveway_factor: 10, use_roads: 0, use_tracks: 1, walking_speed: 4 },
        bicycle: { use_hills: 0.25, bicycle_type: 'hybrid', avoid_bad_surfaces: 0.25, use_roads: 1, use_tracks: 0, cycling_speed: 16 },
        car: { use_roads: 1, use_tracks: 0 }
    };

    function switchValhallaSetting(key: string, options?: any) {
        try {
            if (options === profileCostingOptions) {
                options = profileCostingOptions[profile];
            }
            // console.log('switchValhallaSetting', key, options);
            const settings = valhallaSettings[key];
            if (options[key] === settings.max) {
                options[key] = settings.min;
            } else {
                options[key] = settings.max;
            }
            // to trigger an update
            profileCostingOptions = profileCostingOptions;
        } catch (error) {
            console.error(key, error);
        }
    }
    function valhallaSettingColor(key: string, options?: any) {
        try {
            if (options === profileCostingOptions) {
                options = profileCostingOptions[profile];
            }
            // console.log('valhallaSettingColor', key, options);
            const settings = valhallaSettings[key];
            return options[key] === settings.max ? 'white' : '#ffffff55';
        } catch (error) {
            console.error(key, error);
        }
    }
    function profileColor(currentP, p) {
        return currentP === p ? '#fff' : '#ffffff55';
    }

    function setProfile(p: ValhallaProfile) {
        profile = p;
        // to trigger an update
        profileCostingOptions = profileCostingOptions;
    }

    // function peekHeight() {
    //     return Math.round(layout.toDeviceIndependentPixels(nativeView.getMeasuredHeight()));
    // }

    // let steps= [peekHeight];

    onDestroy(() => {
        if (_routeDataSource) {
            _routeDataSource.clear();
            _routeDataSource = null;
        }

        if (_routeLayer) {
            _routeLayer.setVectorElementEventListener(null);
            _routeLayer = null;
        }
    });

    function getRouteDataSource() {
        if (!_routeDataSource) {
            const projection = mapContext.getProjection();
            _routeDataSource = new LocalVectorDataSource({ projection });
        }
        return _routeDataSource;
    }
    function getRouteLayer() {
        if (!_routeLayer) {
            _routeLayer = new VectorLayer({ visibleZoomRange: [0, 24], dataSource: getRouteDataSource(), opacity: 0.7 });
            _routeLayer.setVectorElementEventListener<LatLonKeys>({
                onVectorElementClicked: (data) => mapContext.vectorElementClicked(data)
            });
            mapContext.addLayer(_routeLayer, 'directions');
        }
        return _routeLayer;
    }
    function reversePoints() {
        if (waypoints.length > 1) {
            waypoints.splice(0, waypoints.length, ...waypoints.reverse());
            // for (let index = 0; index < waypoints.length; index++) {
            //     const element = waypoints[index];

            // }
            // waypoints = waypoints.reverse();
            waypoints.forEach((w, index) => {
                if (w.isStart) {
                    w.isStart = false;
                    w.isStop = true;
                    waypoints.setItem(index, w);
                } else if (w.isStop) {
                    w.isStart = true;
                    w.isStop = false;
                    waypoints.setItem(index, w);
                }
                if (w.marker) {
                    (w.marker.elements[0] as Marker).color = index === 0 ? 'green' : index === waypoints.length - 1 ? 'red' : 'blue';
                }
            });
            updateWayPoints;
        }
    }
    function addStartPoint(position: MapPos<LatLonKeys>, metaData?) {
        const toAdd = {
            isStart: true,
            isStop: false,
            id: Date.now(),
            position,
            metaData,
            marker: null,
            text: metaData ? metaData.name : `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`
        };
        const group = new Group();
        group.elements = [
            new Marker({
                position,
                styleBuilder: {
                    size: 15,
                    hideIfOverlapped: false,
                    scaleWithDPI: true,
                    color: 'green'
                }
            })
            // new Text({
            //     position,
            //     text: '0',
            //     styleBuilder: {
            //         fontSize: 5,
            //         anchorPointY: 1,
            //         hideIfOverlapped: false,
            //         // scaleWithDPI: true,
            //         color: 'white',
            //         // backgroundColor: 'red'
            //     }
            // })
        ];
        toAdd.marker = group;
        getRouteDataSource().add(group);
        ensureRouteLayer();
        waypoints.unshift(toAdd);
        nbWayPoints++;
        // waypoints = waypoints;
        if (startTF) {
            startTF.nativeView.text = currentStartSearchText = toAdd.text;
        }
        updateWayPoints();
    }
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
        if (gridLayout) {
            loadedListeners.forEach((l) => l());
        }
    }
    export function addStopPoint(position: MapPos<LatLonKeys>, metaData?) {
        const toAdd = {
            isStart: false,
            isStop: true,
            id: Date.now(),
            position,
            metaData,
            marker: null,
            text: metaData?.name || `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`
        };
        const lastPoint = waypoints.getItem(waypoints.length - 1);
        if (waypoints.length > 0 && lastPoint.isStop === true) {
            if (lastPoint.isStop === true) {
                lastPoint.isStop = false;
                waypoints.setItem(waypoints.length - 1, lastPoint);
            }
            (lastPoint.marker.elements[0] as Point).styleBuilder = {
                size: 15,
                hideIfOverlapped: false,
                scaleWithDPI: true,
                color: 'blue'
            };
            addStopPoint(position, metaData);
            return;
        }
        const group = new Group();
        group.elements = [
            new Marker({
                position,
                styleBuilder: {
                    size: 15,
                    hideIfOverlapped: false,
                    scaleWithDPI: true,
                    color: 'red'
                }
            }),
            new Text({
                position: getCenter(position, lastPoint.position),
                // position: { lat: (position.lat - lastPoint.position.lat) / 2, lon: (position.lon - lastPoint.position.lon) / 2 },
                text: formatValueToUnit(getDistanceSimple(position, lastPoint.position), 'km'),
                styleBuilder: {
                    hideIfOverlapped: false,
                    scaleWithDPI: false,
                    color: 'darkgray',
                    fontSize: 12
                }
            })
        ];
        toAdd.marker = group;
        getRouteDataSource().add(group);
        if (stopTF) {
            stopTF.nativeView.text = currentStopSearchText = toAdd.text;
        }
        ensureRouteLayer();
        waypoints.push(toAdd);
        nbWayPoints++;
        // waypoints = waypoints;
        updateWayPoints();
    }
    function updateWayPoints() {
        if (!line) {
            line = new Line<LatLonKeys>({
                styleBuilder: {
                    color: 'gray',
                    width: 4
                },
                positions: waypoints.map((w) => w.position)
            });
            getRouteDataSource().add(line);
        } else {
            line.positions = waypoints.map((w) => w.position);
        }
        show();
    }
    let currentTranslationY = -440;
    export let translationY = 0;
    async function show() {
        await loadView();
        const nView = topLayout.nativeView;
        const height = nView.getMeasuredHeight();
        const superParams = {
            target: nView,
            translate: {
                x: 0,
                y: 0
            },
            duration: 200
        };
        const params = translationFunction ? translationFunction(height, 0, 1, superParams) : superParams;
        await nView.animate(params);
        currentTranslationY = 0;
        translationY = 220;
    }
    async function hide() {
        if (!loaded) {
            return;
        }
        const nView = topLayout.nativeView;
        const height = nView.getMeasuredHeight();
        const superParams = {
            target: nView,
            translate: {
                x: 0,
                y: -height
            },
            duration: 200
        };
        const params = translationFunction ? translationFunction(height, -height, 0, superParams) : superParams;
        currentTranslationY = -height;
        await nView.animate(params);
        translationY = 0;
    }
    export function isVisible() {
        return translationY > 0;
    }
    export async function addWayPoint(position: MapPos<LatLonKeys>, metaData?, index = -1) {
        await loadView();
        if (waypoints.length === 0 || waypoints.getItem(0).isStart === false) {
            addStartPoint(position, metaData);
        } else {
            addStopPoint(position, metaData);
        }
    }

    function handleClickOnPos(position: MapPos<LatLonKeys>, metaData?) {
        addWayPoint(position);
    }
    function handleClickOnItem(item: Item) {
        handleClickOnPos(item.position, item.properties);
    }
    function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featurePosition, featureData } = data;
        // console.log('onVectorTileClicked', clickType, ClickType.LONG);
        if (clickType === ClickType.LONG) {
            // console.log('onVectorTileClicked', data.featureLayerName);
            if (data.featureLayerName === 'poi' || data.featureLayerName === 'mountain_peak') {
                handleClickOnPos(featurePosition, featureData);
                return true;
            }
        }
        return false;
    }
    export function onMapClicked(e) {
        const { clickType, position } = e.data;
        // console.log('onMapClicked', clickType, ClickType.LONG);

        if (clickType === ClickType.LONG) {
            handleClickOnPos(position);
            return true;
        }
    }

    function clear(unselect = true) {
        waypoints = new ObservableArray([]);
        nbWayPoints = 0;
        if (_routeDataSource) {
            _routeDataSource.clear();
        }
        if (line) {
            line = null;
        }
        if (currentRoute && unselect) {
            mapContext.unselectItem();
        }
        if (startTF) {
            unfocus(startTF.nativeView);
            startTF.nativeView.text = null;
        }
        if (stopTF) {
            unfocus(stopTF.nativeView);
            stopTF.nativeView.text = null;
        }
    }
    export function cancel(unselect = true) {
        clear(unselect);
        hide();
    }

    let _routePointStyle;

    function routePointStyle() {
        if (!_routePointStyle) {
            _routePointStyle = new MarkerStyleBuilder({
                hideIfOverlapped: false,
                size: 10,
                color: 'white'
            }).buildStyle();
        }
        return _routePointStyle;
    }
    let _routeLeftPointStyle;
    function routeLeftPointStyle() {
        if (!_routeLeftPointStyle) {
            _routeLeftPointStyle = new MarkerStyleBuilder({
                hideIfOverlapped: false,
                size: 10,
                color: 'yellow'
            }).buildStyle();
        }
        return _routeLeftPointStyle;
    }
    let _routeRightPointStyle;
    function routeRightPointStyle() {
        if (!_routeRightPointStyle) {
            _routeRightPointStyle = new MarkerStyleBuilder({
                hideIfOverlapped: false,
                size: 10,
                color: 'purple'
            }).buildStyle();
        }
        return _routeRightPointStyle;
    }
    function createPolyline(result: Route, positions) {
        const styleBuilder = new LineStyleBuilder({
            color: 'orange',
            joinType: LineJointType.ROUND,
            endType: LineEndType.ROUND,
            clickWidth: 20,
            width: 6
        });
        return new Line({
            positions,
            metaData: { route: JSON.stringify(omit(result, 'positions')) },
            styleBuilder
        });
    }
    function secondsToHours(sec: number) {
        const hours = sec / 3600;
        const remainder = sec % 3600;
        const minutes = remainder / 60;
        const seconds = remainder % 60;
        return (hours < 10 ? '0' : '') + hours + 'h' + (minutes < 10 ? '0' : '') + minutes + 'm' + (seconds < 10 ? '0' : '') + seconds + 's';
    }
    async function showRoute(online = false) {
        try {
            if (waypoints.length <= 1) {
                return;
            }
            let startTime = Date.now();
            loading = true;
            const costing_options = {
                [profile]: Object.assign({}, costingOptions, profileCostingOptions[profile])
            };
            // console.log(
            //     'showRoute',
            //     waypoints.map((r) => r.position),
            //     online,
            //     profile,
            //     costing_options
            // );
            let service: RoutingService<any, any>;
            if (!online) {
                service = packageService.offlineRoutingSearchService();
            }
            if (!service) {
                service = packageService.onlineRoutingSearchService();
            }
            (service as any).profile = profile;
            const result = await service.calculateRoute<LatLonKeys>({
                projection: mapContext.getProjection(),
                points: waypoints.map((r) => r.position),
                customOptions: {
                    directions_options: { language: Device.language },
                    costing_options
                }
            });
            // console.log('got  route', result.getTotalDistance(), result.getTotalTime(), Date.now() - startTime, 'ms');

            // startTime = Date.now();
            const route = routingResultToJSON(result);
            // console.log('routingResultToJSON', Date.now() - startTime, 'ms');

            currentRoute = route;
            clearCurrentLine();
            currentLine = createPolyline(route, route.positions);
            getRouteDataSource().add(currentLine);
            ensureRouteLayer();
            const geometry = currentLine.getGeometry();
            mapContext.selectItem({
                item: {
                    position: fromNativeMapPos(geometry.getCenterPos()),
                    route,
                    zoomBounds: fromNativeMapBounds(geometry.getBounds())
                },
                isFeatureInteresting: true,
                showButtons: true
            });
            loading = false;
            // getRouteDataSource().clear();
            // hide();
            // clear();
        } catch (error) {
            console.log('showRoute error', error, error.stack);
            // if (!online) {
            // return confirm({
            //     message: $t('try_online'),
            //     okButtonText: $t('ok'),
            //     cancelButtonText: $t('cancel')
            // }).then(result => {
            // if (result) {
            // showRoute(true);
            //     } else {
            //         cancel();
            //     }
            // });
            // } else {
            loading = false;
            cancel();
            showError(error || 'failed to compute route');
            // }
        }
    }
    function ensureRouteLayer() {
        return getRouteLayer() !== null;
    }
    function clearCurrentLine() {
        if (currentLine) {
            getRouteDataSource().remove(currentLine);
            currentLine = null;
        }
    }
    export function onUnselectedItem(item: Item) {
        if (!!item.route && item.route === currentRoute) {
            currentRoute = null;
            clearCurrentLine();
        }
    }
    export function onSelectedItem(item: Item, oldItem: Item) {
        if (!!oldItem && !!oldItem.route && oldItem.route === currentRoute) {
            currentRoute = null;
            clearCurrentLine();
        }
        if (!!item && !!item.route && item.route !== currentRoute) {
            currentRoute = null;
            clearCurrentLine();
        }
    }

    function unfocus(textField: TextField) {
        //@ts-ignore
        textField.clearFocus();
    }

    let currentStartSearchText = null;
    let currentStopSearchText = null;
    // onStartTextChange(e) {
    //     currentStartSearchText = e.value;
    // }
    // onStopTextChange(e) {
    //     currentStopSearchText = e.value;
    // }
    let startTF: NativeViewElementNode<TextField>;
    let stopTF: NativeViewElementNode<TextField>;

    function clearWayPoint(item) {
        try {
            let index = -1;
            waypoints.some((d, i) => {
                if (d === item) {
                    index = i;
                    return true;
                }
                return false;
            });
            console.log('clearWayPoint', index);
            if (index >= 0) {
                const toRemove = waypoints.splice(index, 1)[0];
                console.log('clearStartSearch', !!toRemove.marker);
                getRouteDataSource().remove(toRemove.marker);
                if (currentRoute) {
                    mapContext.unselectItem();
                }
                if (line) {
                    line.positions = waypoints.map((w) => w.position);
                }
            }
        } catch (error) {
            console.error(error);
        }
    }

    function clearStartSearch() {
        try {
            if (waypoints.length >= 1 && waypoints.getItem(0).isStart === true) {
                const toRemove = waypoints.splice(0, 1)[0];
                console.log('clearStartSearch', !!toRemove.marker);
                getRouteDataSource().remove(toRemove.marker);
                if (currentRoute) {
                    mapContext.unselectItem();
                }
                if (line) {
                    line.positions = waypoints.map((w) => w.position);
                }
            }
            currentStartSearchText = null;
            if (startTF) {
                startTF.nativeView.text = null;
                unfocus(startTF.nativeView);
            }
        } catch (error) {
            console.error(error);
        }
    }
    function clearStopSearch() {
        try {
            if (waypoints.length >= 1 && waypoints[waypoints.length - 1].isStop === true) {
                const toRemove = waypoints.splice(waypoints.length - 1, 1)[0];
                console.log('clearStopSearch', !!toRemove.marker);
                getRouteDataSource().remove(toRemove.marker);
                if (currentRoute) {
                    mapContext.unselectItem();
                }
                if (line) {
                    line.positions = waypoints.map((w) => w.position);
                }
            }
            currentStopSearchText = null;
            if (stopTF) {
                stopTF.nativeView.text = null;
                unfocus(stopTF.nativeView);
            }
        } catch (error) {
            console.error(error);
        }
    }

</script>

<stacklayout bind:this={topLayout} {...$$restProps} backgroundColor={primaryColor} paddingTop={globalMarginTop} translateY={currentTranslationY}>
    {#if loaded}
        <gridlayout bind:this={gridLayout} id="directions" on:tap={() => {}} rows="50,100,35" columns="*,30">
            <button horizontalAlignment="left" variant="text" class="icon-btn-white" text="mdi-arrow-left" on:tap={() => cancel()} />
            <stacklayout colSpan={2} orientation="horizontal" horizontalAlignment="center">
                <button variant="text" class="icon-btn-white" text="mdi-car" on:tap={() => setProfile('car')} color={profileColor(profile, 'car')} />
                <button variant="text" class="icon-btn-white" text="mdi-walk" on:tap={() => setProfile('pedestrian')} color={profileColor(profile, 'pedestrian')} />
                <button variant="text" class="icon-btn-white" text="mdi-bike" on:tap={() => setProfile('bicycle')} color={profileColor(profile, 'bicycle')} />
                <!-- <button variant="text" class="icon-btn-white" text="mdi-auto-fix" on:tap={() => setProfile('auto_shorter')} color={profileColor(profile, 'auto_shorter')} /> -->
            </stacklayout>
            <button
                colSpan={2}
                horizontalAlignment="right"
                class="icon-btn-text"
                text="mdi-magnify"
                on:tap={() => showRoute(false)}
                isEnabled={nbWayPoints > 1}
                margin="4 10 4 10"
                visibility={loading ? 'hidden' : 'visible'}
            />
            <mdactivityindicator visibility={loading ? 'visible' : 'collapsed'} horizontalAlignment="right" busy={true} width="40" height="40" color="white" />
            <collectionview row={1} items={waypoints} rowHeight="50" itemIdGenerator={(item, i) => item.id} animateItemUpdate={true}>
                <Template let:item>
                    <gridlayout>
                        <canvaslabel color="white" fontSize="16" paddingLeft="10" fontFamily={mdiFontFamily}>
                            <cspan text="mdi-dots-vertical" verticalAlignment="top" visibility={item.isStart ? 'hidden' : 'visible'} fontSize="18" paddingTop={-3} />
                            <cspan text="mdi-dots-vertical" verticalAlignment="bottom" visibility={item.isStop ? 'hidden' : 'visible'} fontSize="18" paddingBottom={-3} />
                            <cspan text={item.isStop ? 'mdi-map-marker' : 'mdi-checkbox-blank-circle-outline'} verticalAlignment="center" />
                        </canvaslabel>
                        <gridlayout borderRadius="2" backgroundColor="white" columns=" *,auto,auto" height="40" margin="0 10 0 40">
                            <textfield
                                col="0"
                                marginLeft="15"
                                row="0"
                                hint={item.isStart ? lc('start') : lc('end')}
                                returnKeyType="search"
                                width="100%"
                                fontSize={15}
                                editable={false}
                                color="black"
                                variant="none"
                                backgroundColor="transparent"
                                floating="false"
                                verticalAlignment="center"
                                text={item.text}
                            />
                            <button
                                variant="text"
                                class="icon-btn"
                                visibility={item.text && item.text.length > 0 ? 'visible' : 'collapsed'}
                                row="0"
                                col={2}
                                text="mdi-close"
                                on:tap={() => clearWayPoint(item)}
                                color="gray"
                            />
                        </gridlayout>
                    </gridlayout>
                </Template>
            </collectionview>
            <button row={1} col={1} variant="text" class="icon-btn-white" text="mdi-swap-vertical" on:tap={() => reversePoints()} isEnabled={nbWayPoints > 1} />
            <!-- <gridlayout row="1" colSpan="3" borderRadius="2" backgroundColor="white" columns=" *,auto,auto" height="40" margin="5 10 5 10">
                <textfield
                    bind:this={startTF}
                    col="0"
                    marginLeft="15"
                    row="0"
                    hint="start"
                    returnKeyType="search"
                    bind:text={currentStartSearchText}
                    width="100%"
                    fontSize={15}
                    editable={false}
                    color="black"
                    variant="none"
                    backgroundColor="transparent"
                    floating="false"
                    verticalAlignment="center"
                />
                <button
                    variant="text"
                    class="icon-btn"
                    visibility={currentStartSearchText && currentStartSearchText.length > 0 ? 'visible' : 'collapsed'}
                    row="0"
                    col={2}
                    text="mdi-close"
                    on:tap={clearStartSearch}
                    color="gray"
                />
            </gridlayout> -->
            <!-- <gridlayout row="2" borderRadius="2" backgroundColor="white" columns=" *,auto,auto" height="40" margin="0 10 0 10">
                <textfield
                    bind:this={stopTF}
                    variant="none"
                    col="0"
                    color="black"
                    marginLeft="15"
                    fontSize={15}
                    row="0"
                    hint="stop"
                    bind:text={currentStopSearchText}
                    editable={false}
                    returnKeyType="search"
                    width="100%"
                    backgroundColor="transparent"
                    floating="false"
                    verticalAlignment="center"
                />
                <mdactivityindicator visibility={false ? 'visible' : 'collapsed'} row="0" col="1" busy={true} width={20} height={20} />
                <button
                    variant="text"
                    class="icon-btn"
                    visibility={currentStopSearchText && currentStopSearchText.length > 0 ? 'visible' : 'collapsed'}
                    row={0}
                    col={2}
                    text="mdi-close"
                    on:tap={clearStopSearch}
                    color="gray"
                />
            </gridlayout> -->
            <stacklayout colSpan={2} orientation="horizontal" row="3" visibility={showOptions ? 'visible' : 'hidden'}>
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-ferry"
                    color={valhallaSettingColor('use_ferry', costingOptions)}
                    on:tap={() => switchValhallaSetting('use_ferry', costingOptions)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-road"
                    visibility={profile === 'bicycle' || profile === 'pedestrian' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('use_roads', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('use_roads', profileCostingOptions)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-chart-areaspline"
                    visibility={profile === 'bicycle' || profile === 'pedestrian' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('use_hills', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('use_hills', profileCostingOptions)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-texture-box"
                    visibility={profile === 'bicycle' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('avoid_bad_surfaces', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('avoid_bad_surfaces', profileCostingOptions)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-stairs"
                    visibility={profile === 'pedestrian' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('step_penalty', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('step_penalty', profileCostingOptions)}
                />
                <checkbox
                    variant="text"
                    onCheckColor="white"
                    tintColor="white"
                    color="white"
                    text={lc('shortest')}
                    checked={costingOptions.shortest === true}
                    on:checkedChange={(e) => (costingOptions.shortest = e.value)}
                />
            </stacklayout>
        </gridlayout>
    {/if}
</stacklayout>
