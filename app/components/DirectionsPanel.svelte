<script lang="ts" context="module">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { ClickType, fromNativeMapBounds, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
    import { VectorLayer, VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
    import type { ValhallaProfile } from '@nativescript-community/ui-carto/routing';
    import { RoutingResult, RoutingService } from '@nativescript-community/ui-carto/routing';
    import { Group } from '@nativescript-community/ui-carto/vectorelements/group';
    import { Line, LineEndType, LineJointType, LineStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/line';
    import { Marker, MarkerStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/marker';
    import { Color, Device, GridLayout, ObservableArray, StackLayout, TextField } from '@nativescript/core';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { lc } from '~/helpers/locale';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import type { RouteInstruction } from '~/models/Route';
    import { Route, RoutingAction } from '~/models/Route';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { showError } from '~/utils/error';
    import { omit } from '~/utils/utils';
    import { globalMarginTop, mdiFontFamily, primaryColor } from '~/variables';
    import type { Feature, Point } from 'geojson';
    import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
    import { formatter } from '~/mapModules/ItemFormatter';

    function routingResultToJSON(result: RoutingResult<LatLonKeys>, costing_options) {
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
                name: instruction.getStreetName() !== '' ? instruction.getStreetName() : undefined,
                inst: (instruction as any).getInstruction()
            });
        }
        const route = {
            costing_options,
            totalTime: result.getTotalTime(),
            totalDistance: result.getTotalDistance()
        } as Route;

        return { route, instructions };
    }
</script>

<script lang="ts">
    const mapContext = getMapContext();
    export let translationFunction: Function = null;
    let opened = false;
    let _routeDataSource: GeoJSONVectorTileDataSource;
    let _routeLayer: VectorTileLayer;
    let waypoints: ObservableArray<{
        geometry: Point;
        properties: {
            color: string;
            isStart: boolean;
            isStop: boolean;
            metaData: any;
            text: string;
        };
    }> = new ObservableArray([]);
    let nbWayPoints = 0;
    let features: Feature[] = [];
    let profile: ValhallaProfile = 'pedestrian';
    let bicycle_type = 'Cross';
    let showOptions = true;
    let loading = false;
    let currentRoute: Route;
    let writer: GeoJSONGeometryWriter<LatLonKeys>;
    // let currentLine: Line;
    // let line: Line<LatLonKeys>;
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
            min: 0,
            max: 1
        },
        use_ferry: {
            min: 0,
            max: 1
        },
        step_penalty: {
            min: 20,
            max: 5
        },
        bicycle_type: ['Road', 'Cross', 'Mountain'],
        weight: {
            min: 0,
            max: 1
        }
    };

    let costingOptions = { use_ferry: 0, shortest: false };
    let profileCostingOptions = {
        pedestrian: { use_hills: 1, max_hiking_difficulty: 6, step_penalty: 5, driveway_factor: 10, use_roads: 0, use_tracks: 1, walking_speed: 4 },
        bicycle: { bicycle_type: bicycle_type, use_hills: 0.25, avoid_bad_surfaces: 0, use_roads: 1, use_tracks: 1 },
        auto: { use_roads: 1, use_tracks: 0 }
    };

    function switchValhallaSetting(key: string, options?: any) {
        try {
            if (options === profileCostingOptions) {
                options = profileCostingOptions[profile];
            }
            const settings = valhallaSettings[key];
            if (Array.isArray(settings)) {
                const index = settings.indexOf(options[key]);
                options[key] = settings[(index + 1) % settings.length];
                if (key === 'bicycle_type') {
                    bicycle_type = options[key];
                }
            } else {
                if (options[key] === settings.max) {
                    options[key] = settings.min;
                } else {
                    options[key] = settings.max;
                }
            }

            // to trigger an update
            profileCostingOptions = profileCostingOptions;
        } catch (error) {
            console.error(key, error);
        }
    }
    function bicycleTypeIcon(bicycle_type) {
        switch (bicycle_type) {
            case 'Mountain':
                return 'mdi-bike';
            case 'Cross':
                return 'mdi-bicycle';
            default:
                return 'mdi-bike-fast';
        }
    }
    function valhallaSettingColor(key: string, options?: any) {
        try {
            if (options === profileCostingOptions) {
                options = profileCostingOptions[profile];
            }
            const settings = valhallaSettings[key];
            if (Array.isArray(settings)) {
                const index = Math.max(settings.indexOf(options[key]), 0);
                return new Color('white').setAlpha(((index + 1) / settings.length) * 255).hex;
            } else {
                return options[key] === settings.max ? 'white' : '#ffffff55';
            }
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
            _routeDataSource = null;
        }

        if (_routeLayer) {
            // _routeLayer.setVectorElementEventListener(null);
            _routeLayer = null;
        }
    });

    function getRouteDataSource() {
        if (!_routeDataSource) {
            _routeDataSource = new GeoJSONVectorTileDataSource({
                minZoom: 0,
                maxZoom: 24
            });
            _routeDataSource.createLayer('directions');
        }
        return _routeDataSource;
    }
    function getRouteLayer() {
        if (!_routeLayer) {
            _routeLayer = new VectorTileLayer({ dataSource: getRouteDataSource(), decoder: mapContext.innerDecoder, layerBlendingSpeed: 0, labelBlendingSpeed: 0 });
            _routeLayer.setVectorTileEventListener<LatLonKeys>(
                {
                    onVectorTileClicked: (data) => {
                        console.log('directions', 'onVectorTileClicked');
                        return false;
                    }
                },
                mapContext.getProjection()
            );
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
                if (w.properties.isStart) {
                    w.properties.isStart = false;
                    w.properties.isStop = true;
                    waypoints.setItem(index, w);
                } else if (w.properties.isStop) {
                    w.properties.isStart = true;
                    w.properties.isStop = false;
                    waypoints.setItem(index, w);
                }
                if (w.properties) {
                    w.properties.color = index === 0 ? 'green' : index === waypoints.length - 1 ? 'red' : 'blue';
                }
            });
            updateWayPoints;
        }
    }
    export function addInternalStartPoint(position: MapPos<LatLonKeys>, metaData?) {
        const id = Date.now() + '';
        const toAdd: Feature = {
            // id,
            type: 'Feature',
            properties: {
                isStart: true,
                isStop: false,
                id,
                ...metaData
            },
            geometry: {
                type: 'Point',
                coordinates: [position.lon, position.lat]
            }
        };
        toAdd.properties.name = formatter.getItemTitle(toAdd as Item);
        features.push(toAdd);
        updateGeoJSONLayer();
        waypoints.unshift(toAdd);
        nbWayPoints++;
        // if (startTF) {
        //     startTF.nativeView.text = toAdd.properties.name;
        // }
        show();
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
    function addInternalStopPoint(position: MapPos<LatLonKeys>, metaData?) {
        const id = Date.now() + '';
        const toAdd: Feature = {
            // id,
            type: 'Feature',
            properties: {
                isStart: false,
                isStop: true,
                id,
                ...metaData
            },
            geometry: {
                type: 'Point',
                coordinates: [position.lon, position.lat]
            }
        };
        toAdd.properties.name = formatter.getItemTitle(toAdd as Item);
        const lastPoint = waypoints.length > 0 ? waypoints.getItem(waypoints.length - 1) : undefined;
        if (waypoints.length > 0 && lastPoint.properties.isStop === true) {
            if (lastPoint.properties.isStop === true) {
                lastPoint.properties.isStop = false;
                waypoints.setItem(waypoints.length - 1, lastPoint);
            }
            addStopPoint(position, metaData);
            return;
        }

        features.push(toAdd);
        updateGeoJSONLayer();
        waypoints.push(toAdd);
        nbWayPoints++;
        // if (stopTF) {
        //     stopTF.nativeView.text = toAdd.properties.name;
        // }
        // waypoints = waypoints;
        show();
    }
    function updateWayPoints() {
        // if (!line) {
        //     line = new Line<LatLonKeys>({
        //         styleBuilder: {
        //             color: 'gray',
        //             width: 4
        //         },
        //         positions: waypoints.map((w) => w.position)
        //     });
        //     getRouteDataSource().add(line);
        // } else {
        //     line.positions = waypoints.map((w) => w.position);
        // }
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
    export async function addStartPoint(position: MapPos<LatLonKeys>, metaData?) {
        addInternalStartPoint(position, metaData);
    }
    export async function addStopPoint(position: MapPos<LatLonKeys>, metaData?) {
        addInternalStopPoint(position, metaData);
    }
    export async function addWayPoint(position: MapPos<LatLonKeys>, metaData?, index = -1) {
        // if (waypoints.length === 0 ) {
        // mapContext.getMap().getOptions().setClickTypeDetection(true);
        // }
        if (waypoints.length === 0 || waypoints.getItem(0).properties.isStart === false) {
            addInternalStartPoint(position, metaData);
        } else {
            addInternalStopPoint(position, metaData);
        }
    }

    // function handleClickOnPos(position: MapPos<LatLonKeys>, metaData?) {
    //     addWayPoint(position);
    // }
    // function handleClickOnItem(item: Item) {
    //     handleClickOnPos(item.position, item.properties);
    // }
    //  function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
    //     const { clickType, position, featurePosition, featureData } = data;
    //     // console.log('onVectorTileClicked', clickType, ClickType.LONG);
    //     if (clickType === ClickType.LONG) {
    //         // console.log('onVectorTileClicked', data.featureLayerName);
    //         if (data.featureLayerName === 'poi' || data.featureLayerName === 'mountain_peak') {
    //             handleClickOnPos(featurePosition, featureData);
    //             return true;
    //         }
    //     }
    //     return false;
    // }
    export function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featureLayerName, featureData, featurePosition, featureGeometry, layer } = data;
        if (
            featureLayerName === 'transportation' ||
            featureLayerName === 'transportation_name' ||
            featureLayerName === 'waterway' ||
            // featureLayerName === 'place' ||
            featureLayerName === 'contour' ||
            featureLayerName === 'hillshade' ||
            (featureLayerName === 'park' && !!featureGeometry['getHoles']) ||
            ((featureLayerName === 'building' || featureLayerName === 'landcover' || featureLayerName === 'landuse') && !featureData.name)
        ) {
            return false;
        }
        console.log('diretions onVectorTileClicked');
        // const { clickType } = e.data;
        // console.log('onMapClicked', clickType, ClickType.LONG);
        // const duration = e.data.clickInfo.duration;

        if (clickType === ClickType.LONG) {
            featureData.layer = featureLayerName;
            addWayPoint(position, featureData);
            return true;
        }
    }

    export function onMapClicked(e) {
        const { clickType, position } = e.data;
        if (clickType === ClickType.LONG) {
            addWayPoint(position);
            return true;
        }
    }

    function clear(unselect = true) {
        waypoints = new ObservableArray([]);
        nbWayPoints = 0;
        features = [];
        clearRouteDatasource();
        if (currentRoute && unselect) {
            mapContext.unselectItem();
        }
        // if (startTF) {
        //     unfocus(startTF.nativeView);
        //     startTF.nativeView.text = null;
        // }
        // if (stopTF) {
        //     unfocus(stopTF.nativeView);
        //     stopTF.nativeView.text = null;
        // }
    }
    export function cancel(unselect = true) {
        // mapContext.getMap().getOptions().setClickTypeDetection(false);
        clear(unselect);
        hide();
    }

    // let _routePointStyle;

    // function routePointStyle() {
    //     if (!_routePointStyle) {
    //         _routePointStyle = new MarkerStyleBuilder({
    //             hideIfOverlapped: false,
    //             size: 10,
    //             color: 'white'
    //         }).buildStyle();
    //     }
    //     return _routePointStyle;
    // }
    // let _routeLeftPointStyle;
    // function routeLeftPointStyle() {
    //     if (!_routeLeftPointStyle) {
    //         _routeLeftPointStyle = new MarkerStyleBuilder({
    //             hideIfOverlapped: false,
    //             size: 10,
    //             color: 'yellow'
    //         }).buildStyle();
    //     }
    //     return _routeLeftPointStyle;
    // }
    // let _routeRightPointStyle;
    // function routeRightPointStyle() {
    //     if (!_routeRightPointStyle) {
    //         _routeRightPointStyle = new MarkerStyleBuilder({
    //             hideIfOverlapped: false,
    //             size: 10,
    //             color: 'purple'
    //         }).buildStyle();
    //     }
    //     return _routeRightPointStyle;
    // }
    // function createPolyline(result: Route, positions) {
    //     const styleBuilder = new LineStyleBuilder({
    //         color: 'orange',
    //         joinType: LineJointType.ROUND,
    //         endType: LineEndType.ROUND,
    //         clickWidth: 20,
    //         width: 6
    //     });
    //     return new Line({
    //         positions,
    //         metaData: { route: JSON.stringify(omit(result, 'positions')) },
    //         styleBuilder
    //     });
    // }
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
            loading = true;
            let route: { route: Route; instructions: RouteInstruction[] };
            let positions;
            const points = waypoints.map((r) => ({ lat: r.geometry.coordinates[1], lon: r.geometry.coordinates[0] }));
            let costing_options;
            if (profile === 'bus') {
                const positions = points.map((r) => `${r.lat.toFixed(6)},${r.lon.toFixed(6)}`);
                const result = networkService.request({
                    url: 'http://data.mobilites-m.fr/otp/routers/default/plan',
                    method: 'GET',
                    queryParams: {
                        fromPlace: positions[0],
                        toPlace: positions[positions.length - 1],
                        date: new Date(),
                        time: new Date()
                    }
                });
            } else {
                costing_options = {
                    [profile]: Object.assign({}, costingOptions, profileCostingOptions[profile])
                };
                if (costing_options[profile].hasOwnProperty('weight')) {
                    const weight = costing_options[profile]['weight'];
                    delete costing_options[profile]['weight'];
                    switch (profile) {
                        case 'pedestrian':
                            costing_options[profile]['walking_speed'] = 5.1 * (weight ? 0.7 : 1);
                            break;
                        case 'bicycle':
                            costing_options[profile]['cycling_speed'] = (costing_options[profile]['bicycle_type'] === 'Mountain' ? 18 : 16) * (weight ? 0.7 : 1);
                            break;
                    }
                }
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
                    points,
                    customOptions: {
                        directions_options: { language: Device.language },
                        costing_options
                    }
                });
                // console.log('got  route', result.getTotalDistance(), result.getTotalTime(), Date.now() - startTime, 'ms');

                route = routingResultToJSON(result, costing_options);
                positions = result.getPoints();
            }

            // console.log('routingResultToJSON', Date.now() - startTime, 'ms');
            if (route && positions) {
                if (currentRoute) {
                    clearCurrentRoute(false);
                }
                currentRoute = route.route;
                // clearCurrentLine();
                // currentLine = createPolyline(route, positions);
                const geometry = new LineGeometry<LatLonKeys>({
                    poses: positions
                });
                if (!writer) {
                    writer = new GeoJSONGeometryWriter<LatLonKeys>({
                        sourceProjection: mapContext.getProjection()
                    });
                }
                const id = Date.now() + '';
                const item: any = {
                    type: 'Feature',
                    // id,
                    properties: {
                        name: formatter.getItemName(waypoints.getItem(0)) + ' - ' + formatter.getItemName(waypoints.getItem(waypoints.length - 1)),
                        class: profile,
                        id,
                        ...route,
                        zoomBounds: geometry.getBounds()
                    },
                    _geometry: writer.writeGeometry(geometry),
                    get geometry() {
                        if (!this._parsedGeometry) {
                            this._parsedGeometry = JSON.parse(this._geometry);
                        }
                        return this._parsedGeometry;
                    },
                    toJSON(key) {
                        // return `{"id":${this.id}, "properties":${JSON.stringify(this.properties)}, "geometry":${this._geometry}}`;
                        return { type: this.type, id: this.id, properties: this.properties, geometry: this.geometry };
                    }
                };
                features.push(item);
                updateGeoJSONLayer();
                // ensureRouteLayer();
                // const geometry = currentLine.getGeometry();
                // console.log('selectItem', item.properties?.class, item.properties?.name);
                mapContext.selectItem({
                    item,
                    isFeatureInteresting: true,
                    showButtons: true
                });
            }

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
    function updateGeoJSONLayer() {
        ensureRouteLayer();
        _routeDataSource.setLayerGeoJSONString(
            1,
            JSON.stringify({
                type: 'FeatureCollection',
                features: features
            })
        );
    }
    function clearRouteDatasource() {
        if (_routeDataSource) {
            _routeDataSource.deleteLayer(1);
            _routeDataSource.createLayer('directions');
        }
    }
    function clearCurrentRoute(shouldUpdateGeoJSONLayer = true) {
        const index = features.findIndex((f) => f.properties.route === currentRoute);
        if (index >= 0) {
            features.splice(index, 1);
            if (shouldUpdateGeoJSONLayer) {
                updateGeoJSONLayer();
            }
        }
        currentRoute = null;
    }
    export function onUnselectedItem(item: Item) {
        if (!!item.properties?.route && item.properties?.route === currentRoute) {
            clearCurrentRoute();
        }
    }
    export function onSelectedItem(item: Item, oldItem: Item) {
        if (!!oldItem && !!oldItem.properties?.route && oldItem.properties?.route === currentRoute) {
            clearCurrentRoute();
        }
        if (currentRoute && item?.properties?.route !== currentRoute) {
            clearCurrentRoute();
        }
    }

    function unfocus(textField: TextField) {
        //@ts-ignore
        textField.clearFocus();
    }

    // let startTF: NativeViewElementNode<TextField>;
    // let stopTF: NativeViewElementNode<TextField>;

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
            if (index >= 0) {
                const toRemove = waypoints.splice(index, 1)[0];
                const fIndex = features.findIndex((f) => f.id === item.id);
                if (fIndex >= 0) {
                    features.splice(fIndex, 1);
                    updateGeoJSONLayer();
                }
                if (currentRoute) {
                    mapContext.unselectItem();
                }
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
                <button variant="text" class="icon-btn-white" text="mdi-car" on:tap={() => setProfile('auto')} color={profileColor(profile, 'auto')} />
                <button variant="text" class="icon-btn-white" text="mdi-walk" on:tap={() => setProfile('pedestrian')} color={profileColor(profile, 'pedestrian')} />
                <button variant="text" class="icon-btn-white" text="mdi-bike" on:tap={() => setProfile('bicycle')} color={profileColor(profile, 'bicycle')} />
                <button variant="text" class="icon-btn-white" text="mdi-bus" on:tap={() => setProfile('bus')} color={profileColor(profile, 'bus')} />
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
            <collectionview row={1} items={waypoints} rowHeight="50" itemIdGenerator={(item, i) => item.properties.id} animateItemUpdate={true}>
                <Template let:item>
                    <gridlayout>
                        <canvaslabel color="white" fontSize="16" paddingLeft="10" fontFamily={mdiFontFamily}>
                            <cspan text="mdi-dots-vertical" verticalAlignment="top" visibility={item.properties.isStart ? 'hidden' : 'visible'} fontSize="18" paddingTop={-3} />
                            <cspan text="mdi-dots-vertical" verticalAlignment="bottom" visibility={item.properties.isStop ? 'hidden' : 'visible'} fontSize="18" paddingBottom={-3} />
                            <cspan text={item.properties.isStop ? 'mdi-map-marker' : 'mdi-checkbox-blank-circle-outline'} verticalAlignment="center" />
                        </canvaslabel>
                        <gridlayout borderRadius="2" backgroundColor="white" columns=" *,auto,auto" height="40" margin="0 10 0 40">
                            <textfield
                                marginLeft="15"
                                hint={item.properties.isStart ? lc('start') : lc('end')}
                                returnKeyType="search"
                                width="100%"
                                fontSize={15}
                                editable={false}
                                color="black"
                                variant="none"
                                backgroundColor="transparent"
                                floating="false"
                                verticalAlignment="center"
                                text={item.properties.name}
                            />
                            <button
                                variant="text"
                                class="icon-btn"
                                visibility={item.properties.name && item.properties.name.length > 0 ? 'visible' : 'collapsed'}
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
            <!-- <gridlayout row={1} colSpan={3} borderRadius="2" backgroundColor="white" columns=" *,auto,auto" height="40" margin="5 10 5 10">
                <textfield
                    bind:this={startTF}
                    
                    marginLeft="15"
                    
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
                    
                    col={2}
                    text="mdi-close"
                    on:tap={clearStartSearch}
                    color="gray"
                />
            </gridlayout> -->
            <!-- <gridlayout row={2} borderRadius="2" backgroundColor="white" columns=" *,auto,auto" height="40" margin="0 10 0 10">
                <textfield
                    bind:this={stopTF}
                    variant="none"
                    
                    color="black"
                    marginLeft="15"
                    fontSize={15}
                    
                    hint="stop"
                    bind:text={currentStopSearchText}
                    editable={false}
                    returnKeyType="search"
                    width="100%"
                    backgroundColor="transparent"
                    floating="false"
                    verticalAlignment="center"
                />
                <mdactivityindicator visibility={false ? 'visible' : 'collapsed'}  col={1} busy={true} width={20} height={20} />
                <button
                    variant="text"
                    class="icon-btn"
                    visibility={currentStopSearchText && currentStopSearchText.length > 0 ? 'visible' : 'collapsed'}
                    
                    col={2}
                    text="mdi-close"
                    on:tap={clearStopSearch}
                    color="gray"
                />
            </gridlayout> -->
            <stacklayout colSpan={2} orientation="horizontal" row={3} visibility={showOptions ? 'visible' : 'hidden'}>
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-ferry"
                    visibility={profile === 'auto' ? 'visible' : 'collapsed'}
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
                    text="mdi-weight"
                    visibility={profile === 'bicycle' || profile === 'pedestrian' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('weight', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('weight', profileCostingOptions)}
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
                    text={bicycleTypeIcon(bicycle_type)}
                    visibility={profile === 'bicycle' ? 'visible' : 'collapsed'}
                    color="white"
                    on:tap={() => switchValhallaSetting('bicycle_type', profileCostingOptions)}
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
