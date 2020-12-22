<script lang="ts" context="module">
    import { ClickType, fromNativeMapBounds, fromNativeMapPos, MapPos } from '@nativescript-community/ui-carto/core';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { VectorElementEventData, VectorLayer, VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { RoutingResult, RoutingService, ValhallaProfile } from '@nativescript-community/ui-carto/routing';
    import { Group } from '@nativescript-community/ui-carto/vectorelements/group';
    import { Line, LineEndType, LineJointType, LineStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/line';
    import { Marker, MarkerStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/marker';
    import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
    import { TextField } from '@nativescript/core';
    import { Device, GridLayout, StackLayout } from '@nativescript/core';
    import {  onDestroy } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { getMapContext } from '~/mapModules/MapModule';
    import { IItem as Item } from '~/models/Item';
    import { Route, RouteInstruction, RoutingAction } from '~/models/Route';
    import { packageService } from '~/services/PackageService';
    import { omit } from '~/utils/utils';
    import { globalMarginTop, primaryColor } from '~/variables';

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
    const mapContext = getMapContext();
    export let translationFunction: Function = null;
    let opened = false;
    let _routeDataSource: LocalVectorDataSource;
    let _routeLayer: VectorLayer;
    let waypoints: {
        marker: Group;
        position: MapPos<LatLonKeys>;
        isStart: boolean;
        isStop: boolean;
        metaData: any;
        text: string;
    }[] = [];
    let profile: ValhallaProfile = 'pedestrian';
    let showOptions = true;
    let loading = false;
    let currentRoute: Route;
    let currentLine: Line;
    let line: Line<LatLonKeys>;
    let loaded = false;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let topLayout: NativeViewElementNode<StackLayout>;

    let valhallaCostingOptions = { use_hills: 0, use_roads: 0, use_ferry: 0, max_hiking_difficulty: 6 };

    function profileColor(currentP, p) {
        return currentP === p ? '#fff' : '#55ffffff';
    }

    function setProfile(p: ValhallaProfile) {
        profile = p;
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
                onVectorElementClicked: (data) => mapContext.onVectorElementClicked(data)
            });
            mapContext.addLayer(_routeLayer, 'directions');
        }
        return _routeLayer;
    }

    function addStartPoint(position: MapPos<LatLonKeys>, metaData?) {
        const toAdd = {
            isStart: true,
            isStop: false,
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
        waypoints = waypoints;
        startTF.nativeView.text = currentStartSearchText = toAdd.text;
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
            position,
            metaData,
            marker: null,
            text: metaData?.name || `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`
        };
        if (waypoints.length > 0 && waypoints[waypoints.length - 1].isStop === true) {
            waypoints[waypoints.length - 1].isStop = false;
            (waypoints[waypoints.length - 1].marker.elements[0] as Point).styleBuilder = {
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
            })
        ];
        toAdd.marker = group;
        getRouteDataSource().add(group);
        stopTF.nativeView.text = currentStopSearchText = toAdd.text;
        ensureRouteLayer();
        waypoints.push(toAdd);
        waypoints = waypoints;
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
        await nView.animate(params);
        currentTranslationY = -height;
    }
    async function addWayPoint(position: MapPos<LatLonKeys>, metaData?, index = -1) {
        await loadView();
        const toAdd = {
            isStart: false,
            isStop: false,
            position,
            metaData,
            marker: null,
            text: metaData ? metaData.name : `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`
        };
        if (waypoints.length === 0 || waypoints[0].isStart === false) {
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
    function onVectorElementClicked(data: VectorElementEventData<LatLonKeys>) {
        const { clickType, position, elementPos, metaData } = data;
        // console.log('onVectorElementClicked', clickType, ClickType.LONG);
        if (clickType === ClickType.LONG) {
            handleClickOnPos(elementPos, metaData);
            return true;
        }
    }
    export function onMapClicked(e) {
        const { clickType, position } = e.data;
        // console.log('onMapClicked', clickType, ClickType.LONG);

        if (clickType === ClickType.LONG) {
            handleClickOnPos(position);
            return true;
        }
    }

    function clear() {
        waypoints = [];
        if (line) {
            line = null;
        }
        if (_routeDataSource) {
            _routeDataSource.clear();
        }
        unfocus(startTF.nativeView);
        unfocus(stopTF.nativeView);
        startTF.nativeView.text = null;
        stopTF.nativeView.text = null;
    }
    export function cancel() {
        clear();
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
        return (
            (hours < 10 ? '0' : '') +
            hours +
            'h' +
            (minutes < 10 ? '0' : '') +
            minutes +
            'm' +
            (seconds < 10 ? '0' : '') +
            seconds +
            's'
        );
    }
    function switchValhallaSetting(key: string) {
        valhallaCostingOptions[key] = !valhallaCostingOptions[key];
    }
    function valhallaSetting(key: string) {
        return valhallaCostingOptions[key];
    }
    function valhallaSettingColor(options, key: string) {
        return options[key] ? 'white' : '#55ffffff';
    }
    async function showRoute(online = false) {
        try {
            let startTime = Date.now();
            loading = true;
            console.log(
                'showRoute',
                waypoints.map((r) => r.position),
                online,
                profile,
                valhallaCostingOptions
            );
            let service: RoutingService<any, any>;
            if (!online) {
                service = packageService.offlineRoutingSearchService();
            }
            if (!service) {
                service = packageService.onlineRoutingSearchService();
            }
            service.profile = profile;
            const result = await service.calculateRoute<LatLonKeys>({
                projection: mapContext.getProjection(),
                points: waypoints.map((r) => r.position),
                customOptions: {
                    directions_options: { language: Device.language },
                    costing_options: {
                        car: valhallaCostingOptions,
                        pedestrian: valhallaCostingOptions,
                        bicycle: valhallaCostingOptions
                    }
                }
            });
            console.log('got  route', Date.now() - startTime, 'ms');

            clear();
            startTime = Date.now();
            const route = routingResultToJSON(result);
            console.log('routingResultToJSON', Date.now() - startTime, 'ms');

            currentRoute = route;
            clearCurrentLine();
            currentLine = createPolyline(route, route.positions);
            getRouteDataSource().clear();
            line = null;
            waypoints = [];
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
            hide();
        } catch (error) {
            console.log('showRoute error', error, error.stack);
            if (!online) {
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
            } else {
                loading = false;
                cancel();
                throw error || 'failed to compute route';
            }
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

    function clearStartSearch() {
        console.log('clearStartSearch');
        if (waypoints.length >= 1 && waypoints[0].isStart === true) {
            const toRemove = waypoints.splice(0, 1)[0];
            getRouteDataSource().remove(toRemove.marker);
            if (line) {
                line.positions = waypoints.map((w) => w.position);
            }
        }
        currentStartSearchText = null;
        startTF.nativeView.text = null;
        unfocus(startTF.nativeView);
    }
    function clearStopSearch() {
        console.log('clearStopSearch');
        if (waypoints.length >= 1 && waypoints[waypoints.length - 1].isStop === true) {
            const toRemove = waypoints.splice(waypoints.length - 1, 1)[0];
            getRouteDataSource().remove(toRemove.marker);
            if (line) {
                line.positions = waypoints.map((w) => w.position);
            }
        }
        currentStopSearchText = null;
        stopTF.nativeView.text = null;
        unfocus(stopTF.nativeView);
    }
</script>

<stacklayout
    bind:this={topLayout}
    {...$$restProps}
    backgroundColor={primaryColor}
    paddingTop={globalMarginTop}
    translateY={currentTranslationY}>
    {#if loaded}
        <gridlayout bind:this={gridLayout} id="directions" on:tap={() => {}} rows="50,60,60,50">
            <button
                horizontalAlignment="left"
                variant="text"
                class="icon-btn-white"
                text="mdi-arrow-left"
                on:tap={() => cancel()} />
            <stacklayout orientation="horizontal" horizontalAlignment="center">
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-car"
                    on:tap={() => setProfile('car')}
                    color={profileColor(profile, 'car')} />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-walk"
                    on:tap={() => setProfile('pedestrian')}
                    color={profileColor(profile, 'pedestrian')} />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-bike"
                    on:tap={() => setProfile('bicycle')}
                    color={profileColor(profile, 'bicycle')} />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-auto-fix"
                    on:tap={() => setProfile('auto_shorter')}
                    color={profileColor(profile, 'auto_shorter')} />
            </stacklayout>
            <button
                horizontalAlignment="right"
                class="icon-btn-text"
                text="mdi-magnify"
                on:tap={() => showRoute(false)}
                on:LongPress={() => showRoute(true)}
                isEnabled={waypoints.length > 0}
                margin="4 10 4 10"
                visibility={loading ? 'hidden' : 'visible'} />
            <mdactivityindicator
                visibility={loading ? 'visible' : 'collapsed'}
                horizontalAlignment="right"
                busy={true}
                width="44"
                height="44"
                color="white" />
            <gridlayout
                row="1"
                colSpan="3"
                borderRadius="2"
                backgroundColor="white"
                columns=" *,auto,auto"
                height="44"
                margin="10">
                <textfield
                    bind:this={startTF}
                    col="0"
                    marginLeft="15"
                    row="0"
                    hint="start"
                    returnKeyType="search"
                    bind:text={currentStartSearchText}
                    width="100%"
                    color="black"
                    variant="none"
                    backgroundColor="transparent"
                    floating="false"
                    verticalAlignment="center" />
                <button
                    variant="text"
                    class="icon-btn"
                    visibility={currentStartSearchText && currentStartSearchText.length > 0 ? 'visible' : 'collapsed'}
                    row="0"
                    col="2"
                    text="mdi-close"
                    on:tap={clearStartSearch}
                    color="gray" />
            </gridlayout>
            <gridlayout row="2" borderRadius="2" backgroundColor="white" columns=" *,auto,auto" height="44" margin="0 10 10 10">
                <textfield
                    bind:this={stopTF}
                    variant="none"
                    col="0"
                    color="black"
                    marginLeft="15"
                    row="0"
                    hint="stop"
                    bind:text={currentStopSearchText}
                    returnKeyType="search"
                    width="100%"
                    backgroundColor="transparent"
                    floating="false"
                    verticalAlignment="center" />
                <mdactivityindicator
                    visibility={false ? 'visible' : 'collapsed'}
                    row="0"
                    col="1"
                    busy={true}
                    width={20}
                    height={20} />
                <button
                    variant="text"
                    class="icon-btn"
                    visibility={currentStopSearchText && currentStopSearchText.length > 0 ? 'visible' : 'collapsed'}
                    row="0"
                    col="2"
                    text="mdi-close"
                    on:tap={clearStopSearch}
                    color="gray" />
            </gridlayout>
            <stacklayout orientation="horizontal" row="3" visibility={showOptions ? 'visible' : 'hidden'}>
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-ferry"
                    color={valhallaSettingColor(valhallaCostingOptions, 'use_ferry')}
                    on:tap={() => switchValhallaSetting('use_ferry')} />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-road"
                    visibility={profile === 'bicycle' || profile === 'pedestrian' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor(valhallaCostingOptions, 'use_roads')}
                    on:tap={() => switchValhallaSetting('use_roads')} />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-chart-areaspline"
                    visibility={profile === 'bicycle' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor(valhallaCostingOptions, 'use_hills')}
                    on:tap={() => switchValhallaSetting('use_hills')} />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-texture-box"
                    visibility={profile === 'bicycle' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor(valhallaCostingOptions, 'avoid_bad_surface')}
                    on:tap={() => switchValhallaSetting('avoid_bad_surface')} />
            </stacklayout>
        </gridlayout>
    {/if}
</stacklayout>
