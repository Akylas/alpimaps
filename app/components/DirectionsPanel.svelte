<script lang="ts" context="module">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { ClickType } from '@nativescript-community/ui-carto/core';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
    import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
    import { VectorTileEventData, VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
    import { MultiValhallaOfflineRoutingService, RoutingResult, ValhallaOnlineRoutingService, ValhallaProfile } from '@nativescript-community/ui-carto/routing';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';
    import { ApplicationSettings, Color, ContentView, Device, GridLayout, ObservableArray, StackLayout, TextField, Utils, View } from '@nativescript/core';
    import type { Feature, Point } from 'geojson';
    import { createEventDispatcher, onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, showModal } from 'svelte-native/dom';
    import { formatDistance } from '~/helpers/formatter';
    import { getDistance } from '~/helpers/geolib';
    import { lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem, IItem as Item, RouteInstruction, RouteProfile, RouteStats, DirectionWayPoint as WayPoint } from '~/models/Item';
    import { Route, RoutingAction } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { MOBILITY_URL } from '~/services/TransitService';
    import { showError } from '~/utils/error';
    import { accentColor, alpimapsFontFamily, globalMarginTop, mdiFontFamily, primaryColor } from '~/variables';
    import IconButton from './IconButton.svelte';
    import { defaultProfileCostingOptions, getSavedProfile, getValhallaSettings, removeSavedProfile, savedProfile, valhallaSettingColor, valhallaSettingIcon } from '~/utils/routing';
    import { debounce } from '@nativescript/core/utils';

    const DEFAULT_PROFILE_KEY = 'default_direction_profile';

    interface ItemFeature extends Feature {
        route?: Route;
        profile?: RouteProfile;
        instructions?: RouteInstruction[];
        stats?: RouteStats;
    }

    function routingResultToJSON(result: RoutingResult<LatLonKeys>, costing_options, waypoints) {
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
            waypoints,
            totalTime: result.getTotalTime(),
            totalDistance: result.getTotalDistance()
        } as Route;

        return { route, instructions };
    }
</script>

<script lang="ts">
    const mapContext = getMapContext();
    const dispatch = createEventDispatcher();
    let _routeDataSource: GeoJSONVectorTileDataSource;
    let _routeLayer: VectorTileLayer;
    let waypoints: ObservableArray<WayPoint> = new ObservableArray([]);
    let nbWayPoints = 0;
    let features: ItemFeature[] = [];
    let profile = ApplicationSettings.getString(DEFAULT_PROFILE_KEY, 'pedestrian') as ValhallaProfile;
    let bicycle_type: 'enduro' | 'road' | 'normal' | 'gravel' | 'mountain' = ApplicationSettings.getString('bicycle_type', 'normal') as any;
    let pedestrian_type: 'normal' | 'mountainairing' | 'running' = ApplicationSettings.getString('pedestrian_type', 'normal') as any;
    let showOptions = true;
    let loading = false;
    let writer: GeoJSONGeometryWriter<LatLonKeys>;
    let loaded = false;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let topLayout: NativeViewElementNode<StackLayout>;
    let loadedListeners = [];
    let currentTranslationY = -440;
    let computeMultiple = false;
    let costingOptions = { use_ferry: 0, shortest: false };
    let shouldSaveSettings = true;
    let pedestrianIcon = 'alpimaps-directions_walk';
    let bicycleIcon = 'alpimaps-touring';
    let requestProfile = ApplicationSettings.getBoolean('auto_fetch_profile', false);
    let requestStats = ApplicationSettings.getBoolean('auto_fetch_stats', false);

    export let editingItem: IItem = null;
    export let translationY = 0;
    export let translationFunction: Function = null;

    const used_settings = {
        common: ['service_factor', 'service_penalty', 'use_living_streets', 'use_tracks'],
        pedestrian: ['walking_speed', 'weight', 'use_hills', 'max_hiking_difficulty', 'step_penalty', 'driveway_factor', 'walkway_factor', 'sidewalk_factor', 'alley_factor'],
        bicycle: ['use_hills', 'avoid_bad_surfaces', 'use_roads', 'cycling_speed', 'non_network_penalty'],
        auto: ['use_highways', 'use_distance', 'use_tolls', 'alley_factor'],
        motorcycle: ['use_highways', 'use_tolls', 'use_trails']
    };

    export let profileCostingOptions = {
        pedestrian: getSavedProfile('pedestrian', 'default', { ...defaultProfileCostingOptions.pedestrian }),
        bicycle: getSavedProfile('bicycle', 'default', { ...defaultProfileCostingOptions.bicycle }),
        auto: getSavedProfile('auto', 'default', { ...defaultProfileCostingOptions.auto }),
        motorcycle: getSavedProfile('motorcycle', 'default', { ...defaultProfileCostingOptions.motorcycle })
    };
    DEV_LOG && console.log('profileCostingOptions', JSON.stringify(profileCostingOptions));
    const saveProfileSettings = debounce(
        (profile: ValhallaProfile) => {
            if (shouldSaveSettings) {
                profileCostingOptions = profileCostingOptions;
                savedProfile(profile, 'default', profileCostingOptions[profile]);
            }
        },
        500,
        { leading: true }
    );

    function resetProfileSettings(profile: ValhallaProfile) {
        profileCostingOptions[profile] = { ...defaultProfileCostingOptions[profile] };
        removeSavedProfile(profile, 'default');
    }

    function valhallaSettingsDefaultValue(profile: ValhallaProfile, key, currentOptions?) {
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
                return pedestrian_type === 'mountainairing' ? 6 : 3;
            case 'step_penalty':
                return getPedestrianStepPenalty();
            case 'driveway_factor':
                return 5;
            case 'use_ferry':
                return 1;
            case 'walkway_factor':
                return 1;
            case 'walking_speed':
                if (currentOptions?.hasOwnProperty('weight')) {
                    return walkingSpeed() * (1 - currentOptions['weight'] * 0.4);
                }
                return walkingSpeed();
            case 'sidewalk_factor':
                return 1;
            case 'avoid_bad_surfaces':
                return profile === 'bicycle' ? getBicycleAvoidSurface() : 0.25;
            case 'use_roads':
                return 0.25;
            case 'non_network_penalty':
                return 0;
            case 'cycling_speed':
                if (currentOptions?.hasOwnProperty('weight')) {
                    return getBicycleSpeed() * (1 - currentOptions['weight'] * 0.4);
                }
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
            case 'bicycle_type':
                switch (bicycle_type) {
                    case 'enduro':
                    case 'mountain':
                        return 'Mountain';
                    case 'gravel':
                        return 'Cross';
                    case 'road':
                        return 'Road';
                    default:
                        return 'Hybrid';
                }
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
            saveProfileSettings(profile);
        } catch (error) {
            console.error(key, error);
        }
    }
    // function valhallaSettingColor(key: string, options: any = profileCostingOptions) {
    //     try {
    //         if (options === profileCostingOptions) {
    //             options = profileCostingOptions[profile];
    //         }
    //         let settings = getValhallaSettings(key);
    //         if (Array.isArray(settings)) {
    //             const index = Math.max(settings.indexOf(options[key]), 0);
    //             return new Color('white').setAlpha(((index + 1) / settings.length) * 255).hex;
    //         } else {
    //             let perc = ((options[key] || settings.min) - settings.min) / (settings.max - settings.min);
    //             if (key.endsWith('_factor') || key.endsWith('_penalty')) {
    //                 perc = 1 - perc;
    //             }
    //             return new Color('white').setAlpha(perc * 126 + 126).hex;
    //         }
    //     } catch (error) {
    //         console.error(key, error);
    //     }
    // }
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
    //     return Math.round(Utils.layout.toDeviceIndependentPixels(nativeView.getMeasuredHeight()));
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
            _routeLayer = new VectorTileLayer({
                dataSource: getRouteDataSource(),
                decoder: mapContext.innerDecoder,
                labelRenderOrder: VectorTileRenderOrder.LAST,
                clickRadius: 6,
                layerBlendingSpeed: 0,
                labelBlendingSpeed: 0
            });
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
            setLayerGeoJSONString();
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
        if (metaData.isStart) {
            features.unshift(toAdd);
            waypoints.unshift(toAdd as any);
        } else {
            features.push(toAdd);
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
        DEV_LOG && console.log('addInternalStartPoint');
        const firstPoint = waypoints.getItem(0);
        if (firstPoint?.properties.isStart) {
            firstPoint.properties.isStart = false;
            firstPoint.properties.isStop = waypoints.length === 1;
            waypoints.setItem(0, firstPoint);
        }
        addInternalWayPoint(position, {
            isStart: true,
            isStop: false,
            ...metaData
        });
        setLayerGeoJSONString();
        show();
    }
    async function loadView() {
        if (!loaded) {
            await new Promise((resolve) => {
                loadedListeners.push(resolve);
                loaded = true;
            });
        }
    }
    $: gridLayout && loadedListeners.forEach((l) => l());
    $: editingItem && show(editingItem);
    $: pedestrianIcon = formatter.getRouteIcon('pedestrian', pedestrian_type);
    $: bicycleIcon = formatter.getRouteIcon('bicycle', bicycle_type);

    function addInternalStopPoint(position: MapPos<LatLonKeys>, metaData?) {
        const lastPoint = waypoints.getItem(waypoints.length - 1);
        DEV_LOG && console.log('addInternalStopPoint', position, lastPoint?.properties);
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
        setLayerGeoJSONString();
        show();
    }
    async function show(editingItem?: IItem) {
        try {
            if (editingItem) {
                waypoints.splice(0, waypoints.length);
                waypoints.push(...editingItem.route.waypoints);
                features.splice(0, features.length);
                features.push(...(editingItem.route.waypoints as any));
                updateWayPointLines();
                setLayerGeoJSONString();
            }
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
        } catch (error) {
            showError(error);
        }
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
    export const START_DIRECTION_DEST = 'startDirDest';
    export async function addStartOrStopPoint(position: MapPos<LatLonKeys>, metaData?) {
        const startDirectionWithDestination = ApplicationSettings.getBoolean(START_DIRECTION_DEST, false); // if (waypoints.length === 0 ) {
        if (waypoints.length === 0) {
            if (startDirectionWithDestination) {
                addInternalStopPoint(position, metaData);
            } else {
                addInternalStartPoint(position, metaData);
            }
        } else {
            if (startDirectionWithDestination) {
                addInternalStartPoint(position, metaData);
            } else {
                addInternalStopPoint(position, metaData);
            }
        }
    }
    export async function addStopPoint(position: MapPos<LatLonKeys>, metaData?) {
        addInternalStopPoint(position, metaData);
    }
    export async function addWayPoint(position: MapPos<LatLonKeys>, metaData?, canBeStartStop = true) {
        const startDirectionWithDestination = ApplicationSettings.getBoolean(START_DIRECTION_DEST, false); // if (waypoints.length === 0 ) {
        // mapContext.getMap().getOptions().setClickTypeDetection(true);
        // }
        if (startDirectionWithDestination) {
            if (waypoints.length === 0 || (canBeStartStop && waypoints.getItem(waypoints.length - 1).properties.isStop === false)) {
                addInternalStopPoint(position, metaData);
            } else {
                addInternalStartPoint(position, metaData);
            }
        } else {
            if (waypoints.length === 0 || (canBeStartStop && waypoints.getItem(0).properties.isStart === false)) {
                addInternalStartPoint(position, metaData);
            } else {
                addInternalStopPoint(position, metaData);
            }
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

    export function getFeatures() {
        return features;
    }
    export function cancel(unselect = true) {
        waypoints = new ObservableArray([]);
        nbWayPoints = 0;
        clearRouteDatasource();
        if (unselect) {
            mapContext.unselectItem();
        }
        hide();
        dispatch('cancel');
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

    async function computeAndAddRoute(optionsWithStyle: { [k: string]: any; style?: any } = {}) {
        if (waypoints.length <= 1) {
            return;
        }
        let route: { route: Route; instructions: RouteInstruction[]; stats?: RouteStats; profile?: RouteProfile };
        let positions;
        const { style, ...options } = optionsWithStyle;
        const points = waypoints['_array'].map((r) => ({ lat: r.geometry.coordinates[1], lon: r.geometry.coordinates[0] }));
        let costing_options;
        if (WITH_BUS_SUPPORT && profile === 'bus') {
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
            }
            const profile_used_settings = used_settings[profile].concat(used_settings.common);
            profile_used_settings.forEach((key) => {
                if (!costing_options[profile].hasOwnProperty(key)) {
                    costing_options[profile][key] = valhallaSettingsDefaultValue(profile, key, costing_options[profile]);
                }
            });

            let service: MultiValhallaOfflineRoutingService | ValhallaOnlineRoutingService;
            service = packageService.offlineRoutingSearchService() || packageService.onlineRoutingSearchService();
            let startTime = Date.now();
            const projection = mapContext.getProjection();
            const customOptions = {
                directions_options: { language: Device.language },
                costing_options
            };
            DEV_LOG && console.log('calculateRoute', profile, JSON.stringify(points), JSON.stringify(customOptions));
            try {
                const result = await service.calculateRoute<LatLonKeys>(
                    {
                        projection,
                        points,
                        customOptions
                    },
                    profile
                );
                DEV_LOG && console.log('got route', result.getTotalDistance(), result.getTotalTime(), Date.now() - startTime, 'ms');
                positions = result.getPoints();
                startTime = Date.now();
                route = routingResultToJSON(result, costing_options, waypoints.toJSON().slice(0));
                DEV_LOG && console.log('parsed route', requestStats, Date.now() - startTime, 'ms');
                if (requestStats) {
                    route.stats = await packageService.fetchStats({ positions, projection, route: route.route, profile });
                }
                if (requestProfile) {
                    route.profile = await packageService.getElevationProfile(null, positions);
                }
            } catch (error) {
                console.error('error computing route', profile, JSON.stringify(points), JSON.stringify(customOptions));
                return;
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
                _parsedProfile: route.profile,
                get stats() {
                    return this._parsedStats;
                },
                get instructions() {
                    return this._parsedInstructions;
                },
                get route() {
                    return this._parsedRoute;
                },
                get profile() {
                    return this._parsedProfile;
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
                    ...(style ? { style: { color: style.color } } : {}),
                    ...(route.profile ? { profile: { dplus: route.profile.dplus, dmin: route.profile.dmin } } : {})
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
            if (editingItem) {
                item.properties.editingId = editingItem.id;
                // item.properties.id = editingItem.propertiesid;
            }
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
                        { avoid_bad_surfaces: 1, use_hills: 1, use_roads: 1, non_network_penalty: 0, style: { color: '#AD5FC4' } },
                        { avoid_bad_surfaces: 1, use_hills: 0, use_roads: 1, non_network_penalty: 25, style: { color: '#5FC476' } },
                        { avoid_bad_surfaces: 1, use_hills: 1, use_roads: 1, non_network_penalty: 50, style: { color: '#C49F5F' } }
                    ];
                } else if (profile === 'pedestrian') {
                    options = [
                        //shortest
                        { shortest: true },
                        // very steep
                        { use_hills: 1, style: { color: '#AD5FC4' } },
                        // least steep
                        { use_hills: 0.4, step_penalty: 60, style: { color: '#5FC476' } }
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
            setLayerGeoJSONString();
            if (itemToFocus) {
                mapContext.selectItem({
                    item: itemToFocus as Item,
                    isFeatureInteresting: true,
                    showButtons: true
                });
            }
        } catch (error) {
            // cancel();
            showError(error || 'failed to compute route');
        } finally {
            loading = false;
        }
    }
    function ensureRouteLayer() {
        return getRouteLayer() !== null;
    }
    function setLayerGeoJSONString() {
        ensureRouteLayer();
        // if (__IOS__ && firstUpdate) {
        //     firstUpdate = false;
        //     return setTimeout(setLayerGeoJSONString, 10);
        // }
        _routeDataSource.setLayerGeoJSONString(
            1,
            JSON.stringify({
                type: 'FeatureCollection',
                features
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
                setLayerGeoJSONString();
            }
        }
    }
    function clearWaypointLines(shouldUpdateGeoJSONLayer = true) {
        features = features.filter((f) => f.geometry.type !== 'LineString');
        if (shouldUpdateGeoJSONLayer) {
            setLayerGeoJSONString();
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
                if (waypoints.length) {
                    if (index === waypoints.length) {
                        const lastPoint = waypoints.getItem(waypoints.length - 1);
                        if (lastPoint.properties?.isStop) {
                            lastPoint.properties.isStop = true;
                            waypoints.setItem(waypoints.length - 1, lastPoint);
                        }
                    }
                    updateWayPointLines();
                    clearCurrentRoutes(false);
                    setLayerGeoJSONString();
                } else {
                    cancel(true);
                }
            }
        } catch (error) {
            console.error(error, error.stack);
            showError(error);
        }
    }

    async function showProfileSettings(profile: ValhallaProfile, event) {
        try {
            const profile_used_settings = used_settings[profile].concat(used_settings.common);

            function generateSettings() {
                return profile_used_settings.map((key) => ({
                    title: lc(key),
                    defaultValue: valhallaSettingsDefaultValue(profile, key),
                    value: profileCostingOptions[profile][key],
                    ...getValhallaSettings(key),
                    onChange(value) {
                        profileCostingOptions[profile][key] = value;
                        saveProfileSettings(profile);
                    }
                }));
            }
            const SliderPopover = (await import('~/components/DirectionsSettingsPopover.svelte')).default as any;
            await showPopover({
                view: SliderPopover,
                anchor: event.object,
                vertPos: VerticalPosition.ALIGN_TOP,
                props: {
                    currentOption: profile === 'bicycle' ? bicycle_type : pedestrian_type,
                    onOptionChange: (value) => {
                        if (profile === 'bicycle') {
                            bicycle_type = value;
                            ApplicationSettings.setString('bicycle_type', bicycle_type);
                            // in valhalla bicycle_type only changes speed, surface speed and worse quality surface allowed

                            // we reapply default we want to change per activity
                            // ['cycling_speed', 'use_hills', 'avoid_bad_surfaces'].forEach((k) => (profileCostingOptions[profile][k] = valhallaSettingsDefaultValue(profile, k)));
                        } else {
                            pedestrian_type = value;
                            ApplicationSettings.setString('pedestrian_type', pedestrian_type);
                            // we reapply default we want to change per activity
                            // ['walking_speed', 'use_hills', 'step_penalty', 'max_hiking_difficulty'].forEach((k) => (profileCostingOptions[profile][k] = valhallaSettingsDefaultValue(profile, k)));
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
            const SliderPopover = (await import('~/components/SliderPopover.svelte')).default as any;
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
                        saveProfileSettings(profile);
                    }
                }
            });
        } catch (err) {
            showError(err);
        }
    }

    function onItemReordered(e) {
        (e.view as ContentView).content.animate({ opacity: 1, duration: 150 });
        // we need to reset waypoints isStart / isStop
        const oldIndex = e.index;
        const newIndex = e.data.targetIndex;
        const length = waypoints.length;
        waypoints.forEach((item, index) => {
            item.properties.isStart = index === 0;
            item.properties.isStop = index === length - 1;
            waypoints.setItem(index, item);
        });
        DEV_LOG && console.log('onItemReordered', oldIndex, newIndex);
        updateWayPointLines();
        setLayerGeoJSONString();
    }
    function onItemReorderStarting(e) {
        (e.view as ContentView).content.animate({ opacity: 0.8, duration: 150 });
    }

    async function showMoreOptions(event) {
        try {
            const SliderPopover = (await import('~/components/DirectionsSettingsPopover.svelte')).default as any;
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

    async function openSearchFromItem(event, item: WayPoint) {
        try {
            const SearchModal = (await import('~/components/SearchModal.svelte')).default as any;
            const position = mapContext.getMap().focusPos;
            // const result: any = await showModal({ page: Settings, fullscreen: true, props: { position } });
            const anchorView = event.object as View;
            const result: any = await showPopover({
                vertPos: VerticalPosition.ALIGN_TOP,
                horizPos: HorizontalPosition.ALIGN_LEFT,
                view: SearchModal,
                anchor: anchorView,
                props: {
                    width: Utils.layout.toDeviceIndependentPixels(anchorView.getMeasuredWidth()),
                    position
                }
            });
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
                    setLayerGeoJSONString();
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
                selectedColor={accentColor}
            />
            <mdactivityindicator colSpan={2} visibility={loading ? 'visible' : 'hidden'} horizontalAlignment="right" busy={true} width={40} height={40} color="white" />
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
                    <canvaslabel color="white" fontSize={15} paddingLeft={10} fontFamily={mdiFontFamily}>
                        <cspan text="mdi-dots-vertical" verticalAlignment="top" visibility={item.properties.isStart ? 'hidden' : 'visible'} fontSize={14} paddingTop={-2} />
                        <cspan text="mdi-dots-vertical" verticalAlignment="bottom" visibility={item.properties.isStop ? 'hidden' : 'visible'} fontSize={14} paddingBottom={-2} />
                        <cspan text={item.properties.isStop ? 'mdi-map-marker' : 'mdi-checkbox-blank-circle-outline'} verticalAlignment="middle" />

                        <gridlayout borderRadius={8} backgroundColor={primaryColor.darken(20).hex} columns=" *,auto" height={30} margin="0 0 0 30" on:tap={(event) => openSearchFromItem(event, item)}>
                            <label color="white" marginLeft={15} fontSize={15} verticalTextAlignment="center" text={item.properties.name} maxLines={1} lineBreak="end" />
                            <IconButton color="white" small={true} isVisible={item.properties.name && item.properties.name.length > 0} col={1} text="mdi-delete" on:tap={() => clearWayPoint(item)} />
                        </gridlayout>
                    </canvaslabel>
                </Template>
            </collectionview>
            <IconButton isSelected={true} white={true} row={1} col={1} text="mdi-swap-vertical" on:tap={() => reversePoints()} isEnabled={nbWayPoints > 1} />
            <stacklayout colSpan={2} row={2} orientation="horizontal" visibility={showOptions ? 'visible' : 'collapsed'} id="directionsbuttons">
                {#if profile === 'auto'}
                    <IconButton
                        text={valhallaSettingIcon['use_highways']}
                        size={40}
                        color={valhallaSettingColor('use_highways', profile, profileCostingOptions)}
                        on:tap={() => switchValhallaSetting('use_highways')}
                        onLongPress={(event) => setSliderCostingOptions('use_highways', event)}
                    />

                    <IconButton
                        text={valhallaSettingIcon['use_tolls']}
                        size={40}
                        color={valhallaSettingColor('use_tolls', profile, profileCostingOptions)}
                        on:tap={() => switchValhallaSetting('use_tolls')}
                        onLongPress={(event) => setSliderCostingOptions('use_tolls', event)}
                    />
                {/if}
                {#if profile === 'bicycle'}
                    <IconButton
                        text={valhallaSettingIcon['use_roads']}
                        size={40}
                        color={valhallaSettingColor('use_roads', profile, profileCostingOptions)}
                        on:tap={() => switchValhallaSetting('use_roads')}
                        onLongPress={(event) => setSliderCostingOptions('use_roads', event)}
                    />
                    <IconButton
                        text={valhallaSettingIcon['use_hills']}
                        size={40}
                        color={valhallaSettingColor('use_hills', profile, profileCostingOptions)}
                        on:tap={() => switchValhallaSetting('use_hills')}
                        onLongPress={(event) => setSliderCostingOptions('use_hills', event)}
                    />
                    <IconButton
                        text={valhallaSettingIcon['non_network_penalty']}
                        size={40}
                        color={valhallaSettingColor('non_network_penalty', profile, profileCostingOptions)}
                        on:tap={() => switchValhallaSetting('non_network_penalty')}
                        onLongPress={(event) => setSliderCostingOptions('non_network_penalty', event)}
                    />
                    <IconButton
                        text={valhallaSettingIcon['weight']}
                        size={40}
                        color={valhallaSettingColor('weight', profile, profileCostingOptions)}
                        on:tap={() => switchValhallaSetting('weight')}
                        onLongPress={(event) => setSliderCostingOptions('weight', event)}
                    />
                    <IconButton
                        text={valhallaSettingIcon['avoid_bad_surfaces']}
                        size={40}
                        color={valhallaSettingColor('avoid_bad_surfaces', profile, profileCostingOptions)}
                        on:tap={() => switchValhallaSetting('avoid_bad_surfaces')}
                        onLongPress={(event) => setSliderCostingOptions('avoid_bad_surfaces', event)}
                    />
                    <!-- <IconButton col={5} text={bicycleTypeIcon(bicycle_type)} isVisible={profile === 'bicycle'} color="white" on:tap={() => switchValhallaSetting('bicycle_type')} /> -->
                {/if}
                {#if profile === 'pedestrian'}
                    <IconButton
                        text={valhallaSettingIcon['driveway_factor']}
                        size={40}
                        color={valhallaSettingColor('driveway_factor', profile, profileCostingOptions)}
                        on:tap={() => switchValhallaSetting('driveway_factor')}
                        onLongPress={(event) => setSliderCostingOptions('driveway_factor', event)}
                    />
                    <IconButton
                        text={valhallaSettingIcon['use_hills']}
                        size={40}
                        color={valhallaSettingColor('use_hills', profile, profileCostingOptions)}
                        on:tap={() => switchValhallaSetting('use_hills')}
                        onLongPress={(event) => setSliderCostingOptions('use_hills', event)}
                    />
                    <IconButton
                        text={valhallaSettingIcon['weight']}
                        color={valhallaSettingColor('weight', profile, profileCostingOptions)}
                        size={40}
                        on:tap={() => switchValhallaSetting('weight')}
                        onLongPress={(event) => setSliderCostingOptions('weight', event)}
                    />
                    <IconButton
                        text={valhallaSettingIcon['step_penalty']}
                        color={valhallaSettingColor('step_penalty', profile, profileCostingOptions)}
                        size={40}
                        on:tap={() => switchValhallaSetting('step_penalty')}
                        onLongPress={(event) => setSliderCostingOptions('step_penalty', event)}
                    />
                {/if}
            </stacklayout>

            <stacklayout colSpan={3} row={2} orientation="horizontal" visibility={showOptions ? 'visible' : 'collapsed'} horizontalAlignment="right" id="directionsbuttons2">
                <IconButton size={40} text="mdi-timer-outline" color={costingOptions.shortest ? 'white' : '#ffffff55'} on:tap={() => (costingOptions.shortest = !costingOptions.shortest)} />
                <IconButton size={40} text="mdi-arrow-decision" color={computeMultiple ? 'white' : '#ffffff55'} on:tap={() => (computeMultiple = !computeMultiple)} />
                <IconButton color="white" text="mdi-dots-vertical" size={40} on:tap={showMoreOptions} />
            </stacklayout>
        </gridlayout>
    {/if}
</stacklayout>
