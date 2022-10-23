<script lang="ts" context="module">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { ClickType } from '@nativescript-community/ui-carto/core';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
    import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
    import { VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
    import { ValhallaOfflineRoutingService, ValhallaProfile } from '@nativescript-community/ui-carto/routing';
    import { RoutingResult, RoutingService } from '@nativescript-community/ui-carto/routing';
    import { ApplicationSettings, Color, Device, GridLayout, ObservableArray, StackLayout, TextField } from '@nativescript/core';
    import type { Feature, Point } from 'geojson';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { formatDistance } from '~/helpers/formatter';
    import { getDistance } from '~/helpers/geolib';
    import { lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item, RouteInstruction } from '~/models/Item';
    import { Route, RoutingAction } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { showError } from '~/utils/error';
    import { showPopover } from '~/utils/svelte/popover';
    import { globalMarginTop, mdiFontFamily, primaryColor } from '~/variables';

    const DEFAULT_PROFILE_KEY = 'default_direction_profile';

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
    let profile = ApplicationSettings.getString(DEFAULT_PROFILE_KEY, 'pedestrian') as ValhallaProfile;
    let bicycle_type = 'Hybrid';
    let showOptions = true;
    let loading = false;
    let currentRoutes: Route[];
    let writer: GeoJSONGeometryWriter<LatLonKeys>;
    // let currentLine: Line;
    // let line: Line<LatLonKeys>;
    let loaded = false;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let topLayout: NativeViewElementNode<StackLayout>;

    const valhallaSettings = {
        use_hills: {
            min: 0,
            max: 1
        },
        use_tracks: {
            min: 0,
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
        use_highways: {
            min: 0,
            max: 1
        },
        use_tolls: {
            min: 0,
            max: 1
        },
        step_penalty: {
            min: 5,
            max: 20
        },
        bicycle_type: ['Road', 'Hybrid', 'Mountain'],
        weight: {
            min: 0,
            max: 1
        }
    };
    let computeMultiple = false;
    let costingOptions = { use_ferry: 0, shortest: false };
    let profileCostingOptions = {
        pedestrian: { use_hills: 1, max_hiking_difficulty: 6, step_penalty: 5, driveway_factor: 10, use_roads: 0, use_tracks: 1, walking_speed: 4 },
        bicycle: { bicycle_type: bicycle_type, use_hills: 0.25, avoid_bad_surfaces: 0.25, use_roads: 0.25, use_tracks: 0.5 },
        auto: { use_roads: 1, use_tracks: 0, use_tolls: 1, use_highways: 1 },
        motorcycle: { use_roads: 1, use_tracks: 0, use_tolls: 1, use_highways: 1 }
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
            case 'Hybrid':
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
                const perc = ((options[key] || settings.min) - settings.min) / (settings.max - settings.min);
                return new Color('white').setAlpha(perc * 126 + 126).hex;
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
        ApplicationSettings.setString(DEFAULT_PROFILE_KEY, p);
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
                simplifyTolerance: 1.5,
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
                    onVectorTileClicked(info: VectorTileEventData<LatLonKeys>) {
                        const feature = features.find((f) => f.properties.id === info.featureData.id);
                        if (feature) {
                            mapContext.selectItem({ item: feature as any, isFeatureInteresting: true });
                            return true;
                        }
                        return mapContext.vectorTileElementClicked(info);
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
                // if (w.properties) {
                //     w.properties.color = index === 0 ? 'green' : index === waypoints.length - 1 ? 'red' : 'blue';
                // }
            });
            updateGeoJSONLayer();
            show();
        }
    }

    function addInternalWayPoint(position: MapPos<LatLonKeys>, metaData?) {
        const id = Date.now() + '';
        const toAdd: Feature = {
            type: 'Feature',
            properties: {
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
        if (metaData.isStart) {
            waypoints.unshift(toAdd);
        } else {
            waypoints.push(toAdd);
        }
        try {
            updateWayPointLines();
        } catch (err) {
            console.error(err, err.stack);
        }
        nbWayPoints++;
    }

    function updateWayPointLines() {
        features = features.filter((f) => f.geometry.type !== 'LineString');
        let lastWp: { geometry: Point };
        waypoints.forEach((w, i) => {
            if (lastWp) {
                const id = Date.now() + '' + i;
                features.push({
                    type: 'Feature',
                    properties: {
                        id,
                        class: 'waypointline',
                        text: formatDistance(getDistance(lastWp.geometry.coordinates, w.geometry.coordinates))
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: [lastWp.geometry.coordinates, w.geometry.coordinates]
                    }
                });
            }
            lastWp = w;
        });
    }
    export function addInternalStartPoint(position: MapPos<LatLonKeys>, metaData?) {
        addInternalWayPoint(position, {
            isStart: true,
            isStop: false,
            ...metaData
        });
        updateGeoJSONLayer();
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
        const lastPoint = waypoints.getItem(waypoints.length - 1);
        if (lastPoint?.properties.isStop) {
            lastPoint.properties.isStop = false;
            waypoints.setItem(waypoints.length - 1, lastPoint);
        }

        addInternalWayPoint(position, {
            isStart: false,
            isStop: true,
            ...metaData
        });
        updateGeoJSONLayer();
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

    export function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featureLayerName, featureData, featurePosition, featureGeometry, layer } = data;
        // if (
        //     featureLayerName === 'transportation' ||
        //     featureLayerName === 'transportation_name' ||
        //     featureLayerName === 'waterway' ||
        //     featureLayerName === 'place' ||
        //     featureLayerName === 'contour' ||
        //     featureLayerName === 'hillshade' ||
        //     (featureLayerName === 'park' && !!featureGeometry['getHoles']) ||
        //     ((featureLayerName === 'building' || featureLayerName === 'landcover' || featureLayerName === 'landuse') && !featureData.name)
        // ) {
        //     return false;
        // }
        // const { clickType } = e.data;
        // console.log('onMapClicked', clickType, ClickType.LONG);
        // const duration = e.data.clickInfo.duration;

        if (clickType === ClickType.LONG) {
            mapContext.unFocusSearch();
            featureData.layer = featureLayerName;
            // executeOnMainThread(() => {
            addWayPoint(position, featureData);
            // });
            return true;
        }
    }

    export function onMapClicked(e) {
        const { clickType, position } = e.data;
        if (clickType === ClickType.LONG) {
            // executeOnMainThread(() => {
            addWayPoint(position);
            // });
            return true;
        }
    }

    function clear(unselect = true) {
        waypoints = new ObservableArray([]);
        nbWayPoints = 0;
        clearRouteDatasource();
        if (unselect) {
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

    async function computeAndAddRoute(options?) {
        if (waypoints.length <= 1) {
            return;
        }
        let route: { route: Route; instructions: RouteInstruction[] };
        let positions;
        const points = waypoints['_array'].map((r) => ({ lat: r.geometry.coordinates[1], lon: r.geometry.coordinates[0] }));
        let costing_options;
        if (profile === 'bus') {
            const positions = points['_array'].map((r) => `${r.lat.toFixed(6)},${r.lon.toFixed(6)}`);
            const result = networkService.request({
                url: 'http://data.mobilites-m.fr/otp/routers/default/plan',
                method: 'GET',
                queryParams: {
                    fromPlace: positions[0],
                    toPlace: positions[positions.length-1],
                    date: new Date(),
                    time: new Date()
                }
            });
        } else {
            costing_options = {
                [profile]: Object.assign({}, costingOptions, profileCostingOptions[profile], options || {})
            };
            if (costing_options[profile].hasOwnProperty('weight')) {
                const weight = costing_options[profile]['weight'];
                delete costing_options[profile]['weight'];
                switch (profile) {
                    case 'pedestrian':
                        costing_options[profile]['walking_speed'] = 5.1 * (weight ? 0.6 : 1);
                        break;
                    case 'bicycle':
                        costing_options[profile]['cycling_speed'] = (costing_options[profile]['bicycle_type'] === 'Road' ? 20 : 16) * (weight ? 0.6 : 1);
                        break;
                }
            }
            let service: RoutingService<any, any>;
            // if (!online) {
            service = packageService.offlineRoutingSearchService();
            // }
            if (!service) {
                service = packageService.onlineRoutingSearchService();
            }
            (service as any).profile = profile;
            const startTime = Date.now();
            const result = await service.calculateRoute<LatLonKeys>({
                projection: mapContext.getProjection(),
                points,
                customOptions: {
                    directions_options: { language: Device.language },
                    costing_options
                }
            });
            // console.log('got route', result.getTotalDistance(), result.getTotalTime(), Date.now() - startTime, 'ms');
            // if (service instanceof ValhallaOfflineRoutingService) {
            //     const matchResult = service.matchRoute({
            //         projection: mapContext.getProjection(),
            //         points: result.getPoints() as any,
            //         customOptions: {
            //             shape_match: 'edge_walk',
            //             filters: { attributes: ['edge.surface', 'edge.road_class', 'edge.weighted_grade'], action: 'include' }
            //         }
            //     });
            //     console.log('got trace attributes', result.getTotalDistance(), result.getTotalTime(), Date.now() - startTime, 'ms', matchResult);
            // }

            route = routingResultToJSON(result, costing_options);
            positions = result.getPoints();
        }

        if (route && positions) {
            const geometry = new LineGeometry<LatLonKeys>({
                poses: positions
            });
            if (!writer) {
                writer = new GeoJSONGeometryWriter<LatLonKeys>({
                    sourceProjection: mapContext.getProjection()
                });
            }
            const id = Date.now();
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
            return item;
        }
    }
    async function computeRoutes() {
        try {
            loading = true;
            clearCurrentRoutes(false);
            clearWaypointLines(false);
            let itemToFocus;
            if (computeMultiple) {
                let options = [];
                if (profile === 'bicycle') {
                    options = [
                        { shortest: true , bicycle_type: bicycle_type},
                        { shortest: false, bicycle_type: bicycle_type , avoid_bad_surfaces: 1, use_hills: 0, use_roads: 0.25 },
                        { shortest: false, bicycle_type: bicycle_type, avoid_bad_surfaces: 1, use_hills: 1, use_roads: 0 },
                        { shortest: false, bicycle_type: bicycle_type, avoid_bad_surfaces: 0, use_hills: 1, use_roads: 0 }
                    ];
                } else if (profile === 'pedestrian') {
                    options = [{ shortest: true }, { shortest: false, use_hills: 1, use_roads: 0, step_penalty: 0 }, { shortest: false, use_hills: 0, use_roads: 0, step_penalty: 1 }];
                } else {
                    options = [{ shortest: true }, { shortest: false, use_tolls: 1, use_highways: 1 }, { shortest: false, use_tolls: 0, use_highways: 1 }, { shortest: false, use_highways: 0 }];
                }
                const results: { route: Route; instructions: RouteInstruction[] }[] = await Promise.all(options.map(computeAndAddRoute));
                itemToFocus = results.reduce(function (prev, current) {
                    return prev?.route?.totalTime > current?.route?.totalTime ? current : prev;
                });
            } else {
                itemToFocus = await computeAndAddRoute();
            }
            updateGeoJSONLayer();
            mapContext.selectItem({
                item: itemToFocus,
                isFeatureInteresting: true,
                showButtons: true
            });
        } catch (error) {
            cancel();
            showError(error || 'failed to compute route');
        } finally {
            loading = false;
        }
    }
    function ensureRouteLayer() {
        return getRouteLayer() !== null;
    }
    let firstUpdate = true;
    function updateGeoJSONLayer() {
        ensureRouteLayer();
        if (__IOS__ && firstUpdate) {
            firstUpdate = false;
            return setTimeout(updateGeoJSONLayer, 10);
        }
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
            features = [];
            _routeDataSource.deleteLayer(1);
            _routeDataSource.createLayer('directions');
        }
    }
    function clearCurrentRoutes(shouldUpdateGeoJSONLayer = true) {
        const lengthBefore = features.length;
        features = features.filter((f) => !f.properties.route);
        if (lengthBefore !== features.length) {
            mapContext.unselectItem();
            if (shouldUpdateGeoJSONLayer) {
                updateGeoJSONLayer();
            }
        }
    }
    function clearWaypointLines(shouldUpdateGeoJSONLayer = true) {
        features = features.filter((f) => f.geometry.type !== 'LineString');
        if (shouldUpdateGeoJSONLayer) {
            updateGeoJSONLayer();
        }
    }
    // export function onUnselectedItem(item: Item) {
    //     if (!!item.properties?.route && item.properties?.route === currentRoute) {
    //         clearCurrentRoute();
    //     }
    // }
    // export function onSelectedItem(item: Item, oldItem: Item) {
    //     if (!!oldItem && !!oldItem.properties?.route && oldItem.properties?.route === currentRoute) {
    //         clearCurrentRoute();
    //     }
    //     if (currentRoute && item?.properties?.route !== currentRoute) {
    //         clearCurrentRoute();
    //     }
    // }

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
                waypoints.splice(index, 1);
                const fIndex = features.findIndex((f) => f.properties.id === item.properties.id);
                if (fIndex >= 0) {
                    features.splice(fIndex, 1);
                }
                if (index === waypoints.length) {
                    const lastPoint = waypoints.getItem(waypoints.length - 1);
                    if (!lastPoint?.properties.isStop) {
                        lastPoint.properties.isStop = true;
                        waypoints.setItem(waypoints.length - 1, lastPoint);
                    }
                }
                updateWayPointLines();
                clearCurrentRoutes(false);
                updateGeoJSONLayer();
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function setSliderCostingOptions(key: string, options: any, event) {
        try {
            if (options === profileCostingOptions) {
                options = profileCostingOptions[profile];
            }
            const settings = valhallaSettings[key];
            const SliderPopover = (await import('~/components/SliderPopover.svelte')).default;
            showPopover({
                view: SliderPopover,
                anchor: event.object,
                props: {
                    title: lc(key),
                    icon: event.object.text,
                    ...settings,
                    value: options[key],
                    onChange(value) {
                        options[key] = value;
                        // to trigger an update
                        profileCostingOptions = profileCostingOptions;
                    }
                }
            });
        } catch (err) {
            showError(err);
        }
    }
</script>

<stacklayout bind:this={topLayout} {...$$restProps} backgroundColor={primaryColor} paddingTop={globalMarginTop} translateY={currentTranslationY} style="z-index:1000;">
    {#if loaded}
        <gridlayout bind:this={gridLayout} on:tap={() => {}} rows="50,100,auto" columns="*,40">
            <button horizontalAlignment="left" variant="text" class="icon-btn-white" text="mdi-arrow-left" on:tap={() => cancel()} />
            <stacklayout colSpan={2} orientation="horizontal" horizontalAlignment="center">
                <button variant="text" class="icon-btn-white" text="mdi-car" on:tap={() => setProfile('auto')} color={profileColor(profile, 'auto')} />
                <button variant="text" class="icon-btn-white" text="mdi-motorbike" on:tap={() => setProfile('motorcycle')} color={profileColor(profile, 'motorcycle')} />
                <button variant="text" class="icon-btn-white" text="mdi-walk" on:tap={() => setProfile('pedestrian')} color={profileColor(profile, 'pedestrian')} />
                <button variant="text" class="icon-btn-white" text="mdi-bike" on:tap={() => setProfile('bicycle')} color={profileColor(profile, 'bicycle')} />
                <!-- <button variant="text" class="icon-btn-white" text="mdi-bus" on:tap={() => setProfile('bus')} color={profileColor(profile, 'bus')} /> -->
            </stacklayout>
            <button
                colSpan={2}
                horizontalAlignment="right"
                class="icon-btn-text"
                width={40}
                height={40}
                text="mdi-magnify"
                on:tap={() => computeRoutes()}
                isEnabled={nbWayPoints > 1}
                marginRight={10}
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
                        <gridlayout borderRadius="2" backgroundColor="white" columns=" *,auto,auto" height="40" margin="0 0 0 40">
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
            <gridlayout colSpan={2} rows="45" columns="auto,auto,auto,auto,auto,auto,auto,*,auto,auto" row={2} visibility={showOptions ? 'visible' : 'collapsed'}>
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-ferry"
                    visibility={profile === 'auto' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('use_ferry', costingOptions)}
                    on:tap={() => switchValhallaSetting('use_ferry', costingOptions)}
                    on:longPress={(event) => setSliderCostingOptions('use_ferry', profileCostingOptions, event)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    col={1}
                    text="mdi-highway"
                    visibility={profile === 'auto' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('use_highways', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('use_highways', profileCostingOptions)}
                    on:longPress={(event) => setSliderCostingOptions('use_highways', profileCostingOptions, event)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-road"
                    col={1}
                    visibility={profile === 'bicycle' || profile === 'pedestrian' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('use_roads', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('use_roads', profileCostingOptions)}
                    on:longPress={(event) => setSliderCostingOptions('use_roads', profileCostingOptions, event)}
                />
                <button
                    variant="text"
                    col={2}
                    class="icon-btn-white"
                    text="mdi-chart-areaspline"
                    visibility={profile === 'bicycle' || profile === 'pedestrian' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('use_hills', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('use_hills', profileCostingOptions)}
                    on:longPress={(event) => setSliderCostingOptions('use_hills', profileCostingOptions, event)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    text="mdi-credit-card-marker-outline"
                    visibility={profile === 'auto' ? 'visible' : 'collapsed'}
                    col={2}
                    color={valhallaSettingColor('use_tolls', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('use_tolls', profileCostingOptions)}
                    on:longPress={(event) => setSliderCostingOptions('use_tolls', profileCostingOptions, event)}
                />

                <button
                    variant="text"
                    col={3}
                    class="icon-btn-white"
                    text="mdi-weight"
                    visibility={profile === 'bicycle' || profile === 'pedestrian' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('weight', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('weight', profileCostingOptions)}
                    on:longPress={(event) => setSliderCostingOptions('weight', profileCostingOptions, event)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    col={4}
                    text="mdi-texture-box"
                    visibility={profile === 'bicycle' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('avoid_bad_surfaces', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('avoid_bad_surfaces', profileCostingOptions)}
                    on:longPress={(event) => setSliderCostingOptions('avoid_bad_surfaces', profileCostingOptions, event)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    col={5}
                    text={bicycleTypeIcon(bicycle_type)}
                    visibility={profile === 'bicycle' ? 'visible' : 'collapsed'}
                    color="white"
                    on:tap={() => switchValhallaSetting('bicycle_type', profileCostingOptions)}
                />
                <button
                    variant="text"
                    class="icon-btn-white"
                    col={6}
                    text="mdi-stairs"
                    visibility={profile === 'pedestrian' ? 'visible' : 'collapsed'}
                    color={valhallaSettingColor('step_penalty', profileCostingOptions)}
                    on:tap={() => switchValhallaSetting('step_penalty', profileCostingOptions)}
                    on:longPress={(event) => setSliderCostingOptions('step_penalty', profileCostingOptions, event)}
                />
                <button
                    variant="text"
                    col={8}
                    class="icon-btn-white"
                    text="mdi-timer-outline"
                    color={costingOptions.shortest ? 'white' : '#ffffff55'}
                    on:tap={() => (costingOptions.shortest = !costingOptions.shortest)}
                />
                <button variant="text" col={9} class="icon-btn-white" text="mdi-arrow-decision" color={computeMultiple ? 'white' : '#ffffff55'} on:tap={() => (computeMultiple = !computeMultiple)} />
            </gridlayout>
        </gridlayout>
    {/if}
</stacklayout>
