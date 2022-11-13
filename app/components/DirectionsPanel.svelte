<script lang="ts" context="module">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { ClickType } from '@nativescript-community/ui-carto/core';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
    import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
    import { VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
    import { RoutingResult, RoutingService, ValhallaProfile } from '@nativescript-community/ui-carto/routing';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';
    import { ApplicationSettings, Color, ContentView, Device, GridLayout, ObservableArray, StackLayout, TextField } from '@nativescript/core';
    import type { Feature, Point } from 'geojson';
    import { debounce } from 'push-it-to-the-limit/target/es6';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, showModal } from 'svelte-native/dom';
    import { formatDistance } from '~/helpers/formatter';
    import { getDistance } from '~/helpers/geolib';
    import { lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item, RouteInstruction, RouteProfile, RouteStats } from '~/models/Item';
    import { Route, RoutingAction } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { MOBILITY_URL } from '~/services/TransitService';
    import { showError } from '~/utils/error';
    import { alpimapsFontFamily, globalMarginTop, mdiFontFamily, primaryColor } from '~/variables';
    import IconButton from './IconButton.svelte';

    const DEFAULT_PROFILE_KEY = 'default_direction_profile';

    interface ItemFeature extends Feature {
        route?: Route;
        profile?: RouteProfile;
        instructions?: RouteInstruction[];
        stats?: RouteStats;
    }

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

    interface WayPoint {
        geometry: Point;
        properties: {
            id: string;
            color: string;
            isStart: boolean;
            isStop: boolean;
            metaData: any;
            text: string;
        };
    }
</script>

<script lang="ts">
    const mapContext = getMapContext();
    export let translationFunction: Function = null;
    let _routeDataSource: GeoJSONVectorTileDataSource;
    let _routeLayer: VectorTileLayer;
    let waypoints: ObservableArray<WayPoint> = new ObservableArray([]);
    let nbWayPoints = 0;
    let features: ItemFeature[] = [];
    let profile = ApplicationSettings.getString(DEFAULT_PROFILE_KEY, 'pedestrian') as ValhallaProfile;
    let bicycle_type: 'enduro' | 'road' | 'normal' | 'gravel' | 'mountain' = 'normal';
    let pedestrian_type: 'normal' | 'mountainairing' | 'running' = 'normal';
    let showOptions = true;
    let loading = false;
    let writer: GeoJSONGeometryWriter<LatLonKeys>;
    let loaded = false;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let topLayout: NativeViewElementNode<StackLayout>;

    let requestProfile = ApplicationSettings.getBoolean('auto_fetch_profile', false);
    let requestStats = ApplicationSettings.getBoolean('auto_fetch_stats', false);

    const used_settings = {
        common: ['service_factor', 'service_penalty', 'use_living_streets', 'use_tracks'],
        pedestrian: ['walking_speed', 'weight', 'use_hills', 'max_hiking_difficulty', 'step_penalty', 'driveway_factor', 'walkway_factor', 'sidewalk_factor', 'alley_factor'],
        bicycle: ['use_hills', 'avoid_bad_surfaces', 'use_roads', 'cycling_speed'],
        auto: ['use_highways', 'use_distance', 'use_tolls', 'alley_factor'],
        motorcycle: ['use_highways', 'use_tolls', 'use_trails']
    };
    const valhallaSettings = {
        max_hiking_difficulty: {
            min: 1,
            max: 6
        },
        // bicycle_type: ['Road', 'Hybrid', 'Mountain'],
        // pedestrian_type: ['normal', 'mountaineer'],
        walking_speed: {
            min: 1,
            max: 20
        }
    };
    let computeMultiple = false;
    let costingOptions = { use_ferry: 0, shortest: false };

    const defaultProfileCostingOptions = {
        pedestrian: {
            driveway_factor: 200,
            walkway_factor: 0.8,
            use_tracks: 1,
            sidewalk_factor: 10
        },
        bicycle: { use_roads: 0.25, use_tracks: 0.5 },
        auto: { use_tolls: 1, use_highways: 1 },
        motorcycle: { use_tolls: 1, use_trails: 0 }
    };

    export let profileCostingOptions = JSON.parse(ApplicationSettings.getString('profileCostingOptions', 'false')) || {
        pedestrian: { ...defaultProfileCostingOptions.pedestrian },
        bicycle: { ...defaultProfileCostingOptions.bicycle },
        auto: { ...defaultProfileCostingOptions.auto },
        motorcycle: { ...defaultProfileCostingOptions.motorcycle }
    };

    const saveProfileSettings = debounce(() => {
        profileCostingOptions = profileCostingOptions;
        ApplicationSettings.setString('profileCostingOptions', JSON.stringify(profileCostingOptions));
    }, 500);

    function resetProfileSettings(profile: ValhallaProfile) {
        profileCostingOptions[profile] = { ...defaultProfileCostingOptions[profile] };
        saveProfileSettings();
    }
    function getValhallaSettings(key) {
        let settings = valhallaSettings[key];
        if (!settings) {
            if (key.endsWith('_factor') || key.endsWith('_penalty')) {
                settings = {
                    min: 0,
                    max: 200
                };
            } else {
                settings = {
                    min: 0,
                    max: 1
                };
            }
        }
        return settings;
    }

    function valhallaSettingsDefaultValue(profile: ValhallaProfile, key) {
        //TODO: implement
        switch (key) {
            case 'service_factor':
                return 1;
            case 'service_penalty':
                return 15;
            case 'use_living_streets':
                return 0.1;
            case 'use_tracks':
                return 0.5;
            case 'use_hills':
                return profile === 'bicycle' ? getBicycleUseHills() : getPedestrianUseHills();
            case 'max_hiking_difficulty':
                return 6;
            case 'step_penalty':
                return getPedestrianStepPenalty();
            case 'driveway_factor':
                return 5;
            case 'use_ferry':
                return 1;
            case 'walkway_factor':
                return 1;
            case 'walking_speed':
                return walkingSpeed();
            case 'sidewalk_factor':
                return 1;
            case 'avoid_bad_surfaces':
                return profile === 'bicycle' ? getBicycleAvoidSurface() : 0.25;
            case 'use_roads':
                return 0.25;
            case 'cycling_speed':
                return getBicycleSpeed();
            case 'use_highways':
                return 0.5;
            case 'use_distance':
                return 0;
            case 'use_tolls':
                return 0.5;
            case 'alley_factor':
                return profile === 'auto' ? 1 : 2;
            case 'use_trails':
                return 0;
            case 'weight':
                return 0;
        }
    }
    function switchValhallaSetting(key: string, options: any = profileCostingOptions) {
        try {
            if (options === profileCostingOptions) {
                options = profileCostingOptions[profile];
            }
            let settings = getValhallaSettings(key);
            if (Array.isArray(settings)) {
                const index = settings.indexOf(options[key]);
                options[key] = settings[(index + 1) % settings.length];
            } else {
                if (options[key] === settings.max) {
                    options[key] = settings.min;
                } else {
                    options[key] = settings.max;
                }
            }

            // to trigger an update
            profileCostingOptions = profileCostingOptions;
            saveProfileSettings();
        } catch (error) {
            console.error(key, error);
        }
    }
    function valhallaSettingColor(key: string, options: any = profileCostingOptions) {
        try {
            if (options === profileCostingOptions) {
                options = profileCostingOptions[profile];
            }
            let settings = getValhallaSettings(key);
            if (Array.isArray(settings)) {
                const index = Math.max(settings.indexOf(options[key]), 0);
                return new Color('white').setAlpha(((index + 1) / settings.length) * 255).hex;
            } else {
                let perc = ((options[key] || settings.min) - settings.min) / (settings.max - settings.min);
                if (key.endsWith('_factor') || key.endsWith('_penalty')) {
                    perc = 1 - perc;
                }
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
                simplifyTolerance: 2,
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
        const toAdd: ItemFeature = {
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
        toAdd.properties.name = metaData.title || formatter.getItemTitle(toAdd as Item);
        features.push(toAdd);
        if (metaData.isStart) {
            waypoints.unshift(toAdd as any);
        } else {
            waypoints.push(toAdd as any);
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
        DEV_LOG && console.log('addInternalStopPoint', position);
        const lastPoint = waypoints.getItem(waypoints.length - 1);
        if (lastPoint?.properties.isStop) {
            lastPoint.properties.isStop = false;
            lastPoint.properties.isStart = waypoints.length === 1;
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
        translationY = 0;
        await nView.animate(params);
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
    export async function addWayPoint(position: MapPos<LatLonKeys>, metaData?, canBeStart = true) {
        // if (waypoints.length === 0 ) {
        // mapContext.getMap().getOptions().setClickTypeDetection(true);
        // }
        if (waypoints.length === 0 || (canBeStart && waypoints.getItem(0).properties.isStart === false)) {
            addInternalStartPoint(position, metaData);
        } else {
            addInternalStopPoint(position, metaData);
        }
    }

    export function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featureLayerName, featureData } = data;
        if (clickType === ClickType.LONG && waypoints.length > 0) {
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
        if (clickType === ClickType.LONG && waypoints.length > 0) {
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
    }
    export function cancel(unselect = true) {
        clear(unselect);
        hide();
    }
    function secondsToHours(sec: number) {
        const hours = sec / 3600;
        const remainder = sec % 3600;
        const minutes = remainder / 60;
        const seconds = remainder % 60;
        return (hours < 10 ? '0' : '') + hours + 'h' + (minutes < 10 ? '0' : '') + minutes + 'm' + (seconds < 10 ? '0' : '') + seconds + 's';
    }
    function walkingSpeed() {
        switch (pedestrian_type) {
            case 'running':
                return 12;
            default:
                return 4;
        }
    }
    function getBicycleSpeed() {
        switch (bicycle_type) {
            case 'enduro':
                return 10;
            case 'mountain':
                return 12;
            case 'gravel':
                return 18;
            case 'road':
                return 20;
            default:
                return 15;
        }
    }
    function getBicycleUseHills() {
        switch (bicycle_type) {
            case 'enduro':
            case 'mountain':
                return 1;
            case 'gravel':
            case 'road':
                return 0.5;
            default:
                return 0.25;
        }
    }
    function getPedestrianUseHills() {
        switch (pedestrian_type) {
            case 'mountainairing':
                return 1;
            default:
                return 0.5;
        }
    }
    function getPedestrianStepPenalty() {
        switch (pedestrian_type) {
            case 'running':
                return 130;
            default:
                return 10;
        }
    }

    function getBicycleAvoidSurface() {
        switch (bicycle_type) {
            case 'enduro':
                return 0;
            case 'mountain':
                return 0.25;
            case 'gravel':
                return 0.25;
            case 'road':
                return 0.75;
            default:
                return 0.5;
        }
    }
    function getWalkingSpeed() {
        switch (pedestrian_type) {
            case 'running':
                return 10;
            default:
                return 4;
        }
    }

    async function computeAndAddRoute(options?) {
        if (waypoints.length <= 1) {
            return;
        }
        let route: { route: Route; instructions: RouteInstruction[]; stats?: RouteStats; profile?: RouteProfile };
        let positions;
        const points = waypoints['_array'].map((r) => ({ lat: r.geometry.coordinates[1], lon: r.geometry.coordinates[0] }));
        let costing_options;
        if (profile === 'bus') {
            const positions = points['_array'].map((r) => `${r.lat.toFixed(6)},${r.lon.toFixed(6)}`);
            const result = networkService.request({
                url: MOBILITY_URL + '/otp/routers/default/plan',
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
                [profile]: Object.assign({}, costingOptions, profileCostingOptions[profile], options || {})
            };
            if (profile === 'pedestrian') {
                if (!costing_options[profile].hasOwnProperty('max_hiking_difficulty')) {
                    costing_options[profile]['max_hiking_difficulty'] = pedestrian_type === 'mountainairing' ? 6 : 3;
                }
                if (costing_options[profile].hasOwnProperty('weight') && !costing_options[profile]['walking_speed']) {
                    costing_options[profile]['walking_speed'] = getWalkingSpeed() * (1 - costing_options[profile].hasOwnProperty('weight') * 0.4);
                }
            }
            if (profile === 'bicycle') {
                switch (bicycle_type) {
                    case 'enduro':
                    case 'mountain':
                        costing_options[profile]['bicycle_type'] = 'Mountain';
                        break;
                    case 'gravel':
                        costing_options[profile]['bicycle_type'] = 'Cross';
                        break;
                    case 'road':
                        costing_options[profile]['bicycle_type'] = 'Road';
                        break;
                    default:
                        costing_options[profile]['bicycle_type'] = 'Hybrid';
                        break;
                }
                if (costing_options[profile].hasOwnProperty('weight') && !costing_options[profile]['cycling_speed']) {
                    costing_options[profile]['cycling_speed'] = getBicycleSpeed() * (1 - costing_options[profile].hasOwnProperty('weight') * 0.4);
                }
            }

            let service: RoutingService<any, any>;
            service = packageService.offlineRoutingSearchService() || packageService.onlineRoutingSearchService();
            (service as any).profile = profile;
            let startTime = Date.now();
            const projection = mapContext.getProjection();
            const customOptions = {
                directions_options: { language: Device.language },
                costing_options
            };
            DEV_LOG && console.log('calculateRoute', profile, points, customOptions);
            const result = await service.calculateRoute<LatLonKeys>({
                projection,
                points,
                customOptions
            });
            DEV_LOG && console.log('got route', result.getTotalDistance(), result.getTotalTime(), Date.now() - startTime, 'ms');
            positions = result.getPoints();
            startTime = Date.now();
            route = routingResultToJSON(result, costing_options);
            DEV_LOG && console.log('parsed route', Date.now() - startTime, 'ms');
            if (requestStats) {
                route.stats = await packageService.fetchStats({ positions, projection, route: route.route });
            }
            if (requestProfile) {
                route.profile = await packageService.getElevationProfile(null, positions);
            }
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
            const startTime = Date.now();
            const id = Date.now();
            const item: any = {
                type: 'Feature',
                _parsedRoute: route.route,
                _parsedInstructions: route.instructions,
                _parsedStats: route.stats,
                get stats() {
                    return this._parsedStats;
                },
                get instructions() {
                    return this._parsedInstructions;
                },
                get route() {
                    return this._parsedRoute;
                },
                properties: {
                    name: formatter.getItemName(waypoints.getItem(0)) + ' - ' + formatter.getItemName(waypoints.getItem(waypoints.length - 1)),
                    class: profile,
                    id,
                    zoomBounds: geometry.getBounds(),
                    route: {
                        ...route.route,
                        type: profile,
                        subtype: profile === 'pedestrian' ? pedestrian_type : profile === 'bicycle' ? bicycle_type : undefined
                    },
                    profile: route.profile
                        ? {
                              dplus: route.profile.dplus,
                              dmin: route.profile.dmin
                          }
                        : undefined
                },
                _geometry: writer.writeGeometry(geometry),
                get geometry() {
                    if (!this._parsedGeometry) {
                        this._parsedGeometry = JSON.parse(this._geometry);
                    }
                    return this._parsedGeometry;
                },
                toJSON() {
                    return { type: this.type, id: this.id, properties: this.properties, geometry: this.geometry, stats: this.stats, route: this.route, instructions: this.instructions };
                }
            };
            features.push(item);
            DEV_LOG && console.log('prepared route item', Date.now() - startTime, 'ms');
            return item as ItemFeature;
        }
    }
    async function computeRoutes() {
        try {
            loading = true;
            clearCurrentRoutes(false);
            clearWaypointLines(false);
            let itemToFocus: ItemFeature;
            if (computeMultiple) {
                let options = [];
                if (profile === 'bicycle') {
                    options = [
                        { shortest: true },
                        { shortest: false, avoid_bad_surfaces: 1, use_hills: 0, use_roads: 0.5 },
                        { shortest: false, avoid_bad_surfaces: 1, use_hills: 1, use_roads: 0 },
                        { shortest: false, avoid_bad_surfaces: 0, use_hills: 1, use_roads: 0 }
                    ];
                } else if (profile === 'pedestrian') {
                    options = [
                        //shortest
                        { shortest: true },
                        // very steep
                        {},
                        // least steep
                        { use_hills: 0 }
                    ];
                } else {
                    options = [{ shortest: true }, { shortest: false, use_tolls: 1, use_highways: 1 }, { shortest: false, use_tolls: 0, use_highways: 1 }, { shortest: false, use_highways: 0 }];
                }
                const results = await Promise.all(options.map(computeAndAddRoute));
                itemToFocus = results.reduce(function (prev, current) {
                    return prev?.route?.totalTime > current?.route?.totalTime ? current : prev;
                });
            } else {
                itemToFocus = await computeAndAddRoute();
            }
            updateGeoJSONLayer();
            mapContext.selectItem({
                item: itemToFocus as Item,
                isFeatureInteresting: true,
                showButtons: true
            });
        } catch (error) {
            console.error(error);
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
        features = features.filter((f) => !f.route);
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

    async function showProfileSettings(profile: ValhallaProfile, event) {
        try {
            const profile_used_settings = used_settings[profile].concat(used_settings.common);

            function generateSettings() {
                return profile_used_settings.map((key) => ({
                    title: lc(key),
                    value: profileCostingOptions[profile][key] || valhallaSettingsDefaultValue(profile, key),
                    ...getValhallaSettings(key),
                    onChange(value) {
                        profileCostingOptions[profile][key] = value;
                        // to trigger an update
                        profileCostingOptions = profileCostingOptions;
                        saveProfileSettings();
                    }
                }));
            }
            const SliderPopover = (await import('~/components/DirectionsSettingsPopover.svelte')).default;
            await showPopover({
                view: SliderPopover,
                anchor: event.object,
                vertPos: VerticalPosition.ALIGN_TOP,
                props: {
                    currentOption: profile === 'bicycle' ? bicycle_type : pedestrian_type,
                    onOptionChange: (value) => {
                        if (profile === 'bicycle') {
                            bicycle_type = value;
                            // in valhalla bicycle_type only changes speed, surface speed and worse quality surface allowed

                            // we reapply default we want to change per activity
                            ['cycling_speed', 'use_hills', 'avoid_bad_surfaces'].forEach((k) => (profileCostingOptions[profile][k] = valhallaSettingsDefaultValue(profile, k)));
                        } else {
                            pedestrian_type = value;
                            // we reapply default we want to change per activity
                            ['walking_speed', 'use_hills', 'step_penalty', 'max_hiking_difficulty'].forEach((k) => (profileCostingOptions[profile][k] = valhallaSettingsDefaultValue(profile, k)));
                        }
                        return generateSettings();
                    },
                    onReset: () => {
                        resetProfileSettings(profile);
                        return generateSettings();
                    },
                    settings: generateSettings(),
                    options: (profile === 'bicycle' ? ['enduro', 'road', 'normal', 'gravel', 'mountain'] : ['normal', 'mountainairing', 'running']).map((key) => ({
                        value: key,
                        text: formatter.getRouteIcon(profile, key)
                    }))
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    async function setSliderCostingOptions(key: string, event, options: any = profileCostingOptions) {
        DEV_LOG && console.log('setSliderCostingOptions', key);
        try {
            if (options === profileCostingOptions) {
                options = profileCostingOptions[profile];
            }
            let settings = getValhallaSettings(key);
            const SliderPopover = (await import('~/components/SliderPopover.svelte')).default;
            await showPopover({
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
                        saveProfileSettings();
                    }
                }
            });
        } catch (err) {
            showError(err);
        }
    }

    function onItemReordered(e) {
        (e.view as ContentView).content.opacity = 1;
    }
    function onItemReorderStarting(e) {
        (e.view as ContentView).content.opacity = 0.8;
    }
    let pedestrianIcon = 'alpimaps-directions_walk';
    $: pedestrianIcon = formatter.getRouteIcon('pedestrian', pedestrian_type);
    let bicycleIcon = 'alpimaps-touring';
    $: bicycleIcon = formatter.getRouteIcon('bicycle', bicycle_type);

    async function showMoreOptions(event) {
        try {
            const SliderPopover = (await import('~/components/DirectionsSettingsPopover.svelte')).default;
            await showPopover({
                view: SliderPopover,
                anchor: event.object,
                vertPos: VerticalPosition.ALIGN_TOP,
                props: {
                    onCheckBox(item, value) {
                        ApplicationSettings.setBoolean(item.id, value);
                        switch (item.id) {
                            case 'auto_fetch_profile':
                                requestProfile = value;
                                break;
                            case 'auto_fetch_stats':
                                requestStats = value;
                                break;
                        }
                    },
                    settings: [
                        {
                            type: 'switch',
                            id: 'auto_fetch_profile',
                            title: lc('auto_fetch_profile'),
                            subtitle: lc('auto_fetch_profile_desc'),
                            value: requestProfile
                        },
                        {
                            type: 'switch',
                            id: 'auto_fetch_stats',
                            title: lc('auto_fetch_stats'),
                            subtitle: lc('auto_fetch_stats_desc'),
                            value: requestStats
                        }
                    ]
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    async function openSearchFromItem(item: WayPoint) {
        try {
            const Settings = (await import('~/components/SearchModal.svelte')).default;
            const position = mapContext.getMap().focusPos;
            const result: any = await showModal({ page: Settings, fullscreen: true, props: { position } });
            console.log('result', result);
            if (result) {
                const id = Date.now() + '';
                const toAdd: ItemFeature = {
                    type: 'Feature',
                    properties: {
                        id,
                        ...result,
                        name: result.title || formatter.getItemTitle(result as Item)
                    },
                    geometry: result.geometry
                };
                const index = waypoints.findIndex((d) => d.properties.id === item.properties.id);
                if (index >= 0) {
                    const index2 = features.findIndex((d) => d.properties.id === item.properties.id);
                    toAdd.properties.isStart = features[index2].properties.isStart;
                    toAdd.properties.isStop = features[index2].properties.isStop;

                    features.splice(index2, 1, toAdd as any);
                    waypoints.splice(index, 1, toAdd as any);
                    updateWayPointLines();
                    updateGeoJSONLayer();
                }
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<stacklayout bind:this={topLayout} {...$$restProps} backgroundColor={primaryColor} paddingTop={globalMarginTop} translateY={currentTranslationY} style="z-index:1000;">
    {#if loaded}
        <gridlayout bind:this={gridLayout} on:tap={() => {}} rows="50,70,auto" columns="*,40">
            <IconButton isSelected={true} white={true} horizontalAlignment="left" text="mdi-arrow-left" on:tap={() => cancel()} />
            <stacklayout colSpan={2} orientation="horizontal" horizontalAlignment="center">
                <IconButton text="mdi-car" on:tap={() => setProfile('auto')} color={profileColor(profile, 'auto')} />
                <IconButton text="mdi-motorbike" on:tap={() => setProfile('motorcycle')} color={profileColor(profile, 'motorcycle')} />
                <IconButton
                    text={pedestrianIcon}
                    fontFamily={alpimapsFontFamily}
                    on:tap={() => setProfile('pedestrian')}
                    color={profileColor(profile, 'pedestrian')}
                    onLongPress={(event) => showProfileSettings('pedestrian', event)}
                />
                <IconButton
                    text={bicycleIcon}
                    fontFamily={alpimapsFontFamily}
                    on:tap={() => setProfile('bicycle')}
                    color={profileColor(profile, 'bicycle')}
                    onLongPress={(event) => showProfileSettings('bicycle', event)}
                />
                <!-- <IconButton white={true} text="mdi-bus" on:tap={() => setProfile('bus')} color={profileColor(profile, 'bus')} /> -->
            </stacklayout>
            <IconButton
                colSpan={2}
                gray={true}
                horizontalAlignment="right"
                text="mdi-magnify"
                on:tap={() => computeRoutes()}
                isSelected={nbWayPoints > 1}
                marginRight={10}
                isVisible={!loading}
                backgroundColor="white"
                size={40}
                selectedColor={primaryColor}
            />
            <mdactivityindicator colSpan={2} visibility={loading ? 'visible' : 'collapsed'} horizontalAlignment="right" busy={true} width={40} height={40} color="white" />
            <collectionview
                row={1}
                items={waypoints}
                rowHeight={36}
                itemIdGenerator={(item, i) => item.properties.id}
                animateItemUpdate={true}
                reorderLongPressEnabled={true}
                reorderEnabled={true}
                on:itemReorderStarting={onItemReorderStarting}
                on:itemReordered={onItemReordered}
            >
                <Template let:item>
                    <gridlayout>
                        <canvaslabel color="white" fontSize={15} paddingLeft={10} fontFamily={mdiFontFamily}>
                            <cspan text="mdi-dots-vertical" verticalAlignment="top" visibility={item.properties.isStart ? 'hidden' : 'visible'} fontSize={14} paddingTop={-2} />
                            <cspan text="mdi-dots-vertical" verticalAlignment="bottom" visibility={item.properties.isStop ? 'hidden' : 'visible'} fontSize={14} paddingBottom={-2} />
                            <cspan text={item.properties.isStop ? 'mdi-map-marker' : 'mdi-checkbox-blank-circle-outline'} verticalAlignment="middle" />
                        </canvaslabel>
                        <gridlayout borderRadius={8} backgroundColor={primaryColor.darken(20).hex} columns=" *,auto" height={30} margin="0 0 0 30" on:tap={() => openSearchFromItem(item)}>
                            <label color="white" marginLeft={15} fontSize={15} verticalTextAlignment="center" text={item.properties.name} />
                            <IconButton gray={true} isVisible={item.properties.name && item.properties.name.length > 0} col={1} text="mdi-close" on:tap={() => clearWayPoint(item)} />
                        </gridlayout>
                    </gridlayout>
                </Template>
            </collectionview>
            <IconButton isSelected={true} white={true} row={1} col={1} text="mdi-swap-vertical" on:tap={() => reversePoints()} isEnabled={nbWayPoints > 1} />
            <stacklayout colSpan={2} row={2} orientation="horizontal" visibility={showOptions ? 'visible' : 'collapsed'}>
                {#if profile === 'auto'}
                    <IconButton
                        text="mdi-highway"
                        size={40}
                        color={valhallaSettingColor('use_highways')}
                        on:tap={() => switchValhallaSetting('use_highways')}
                        onLongPress={(event) => setSliderCostingOptions('use_highways', event)}
                    />

                    <IconButton
                        text="mdi-credit-card-marker-outline"
                        size={40}
                        color={valhallaSettingColor('use_tolls')}
                        on:tap={() => switchValhallaSetting('use_tolls')}
                        onLongPress={(event) => setSliderCostingOptions('use_tolls', event)}
                    />
                {/if}
                {#if profile === 'bicycle'}
                    <IconButton
                        text="mdi-road"
                        size={40}
                        color={valhallaSettingColor('use_roads')}
                        on:tap={() => switchValhallaSetting('use_roads')}
                        onLongPress={(event) => setSliderCostingOptions('use_roads', event)}
                    />
                    <IconButton
                        text="mdi-chart-areaspline"
                        size={40}
                        color={valhallaSettingColor('use_hills')}
                        on:tap={() => switchValhallaSetting('use_hills')}
                        onLongPress={(event) => setSliderCostingOptions('use_hills', event)}
                    />
                    <IconButton
                        text="mdi-weight"
                        size={40}
                        color={valhallaSettingColor('weight')}
                        on:tap={() => switchValhallaSetting('weight')}
                        onLongPress={(event) => setSliderCostingOptions('weight', event)}
                    />
                    <IconButton
                        text="mdi-texture-box"
                        size={40}
                        color={valhallaSettingColor('avoid_bad_surfaces')}
                        on:tap={() => switchValhallaSetting('avoid_bad_surfaces')}
                        onLongPress={(event) => setSliderCostingOptions('avoid_bad_surfaces', event)}
                    />
                    <!-- <IconButton col={5} text={bicycleTypeIcon(bicycle_type)} isVisible={profile === 'bicycle'} color="white" on:tap={() => switchValhallaSetting('bicycle_type')} /> -->
                {/if}
                {#if profile === 'pedestrian'}
                    <IconButton
                        text="mdi-road"
                        size={40}
                        color={valhallaSettingColor('driveway_factor')}
                        on:tap={() => switchValhallaSetting('driveway_factor')}
                        onLongPress={(event) => setSliderCostingOptions('driveway_factor', event)}
                    />
                    <IconButton
                        text="mdi-chart-areaspline"
                        size={40}
                        color={valhallaSettingColor('use_hills')}
                        on:tap={() => switchValhallaSetting('use_hills')}
                        onLongPress={(event) => setSliderCostingOptions('use_hills', event)}
                    />
                    <IconButton
                        text="mdi-weight"
                        color={valhallaSettingColor('weight')}
                        size={40}
                        on:tap={() => switchValhallaSetting('weight')}
                        onLongPress={(event) => setSliderCostingOptions('weight', event)}
                    />
                    <IconButton
                        text="mdi-stairs"
                        color={valhallaSettingColor('step_penalty')}
                        size={40}
                        on:tap={() => switchValhallaSetting('step_penalty')}
                        onLongPress={(event) => setSliderCostingOptions('step_penalty', event)}
                    />
                {/if}
            </stacklayout>

            <stacklayout colSpan={3} row={2} orientation="horizontal" visibility={showOptions ? 'visible' : 'collapsed'} horizontalAlignment="right">
                <IconButton size={40} text="mdi-timer-outline" color={costingOptions.shortest ? 'white' : '#ffffff55'} on:tap={() => (costingOptions.shortest = !costingOptions.shortest)} />
                <IconButton size={40} text="mdi-arrow-decision" color={computeMultiple ? 'white' : '#ffffff55'} on:tap={() => (computeMultiple = !computeMultiple)} />
                <IconButton color="white" text="mdi-dots-vertical" size={40} on:tap={showMoreOptions} />
            </stacklayout>
        </gridlayout>
    {/if}
</stacklayout>
