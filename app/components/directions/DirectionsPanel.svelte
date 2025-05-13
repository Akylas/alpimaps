<script context="module" lang="ts">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { ClickType } from '@nativescript-community/ui-carto/core';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
    import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
    import { VectorTileEventData, VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
    import { MultiValhallaOfflineRoutingService, RoutingResult, ValhallaOnlineRoutingService, ValhallaProfile } from '@nativescript-community/ui-carto/routing';
    import { showSliderPopover, showSnack } from '~/utils/ui';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';
    import { ApplicationSettings, Color, ContentView, Device, GridLayout, ObservableArray, StackLayout, TextField, Utils, View } from '@nativescript/core';
    import { debounce } from '@nativescript/core/utils';
    import type { Feature, Point } from 'geojson';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import IconButton from '~/components/common/IconButton.svelte';
    import { GeoLocation } from '~/handlers/GeoHandler';
    import { formatDistance } from '~/helpers/formatter';
    import { getDistance } from '~/helpers/geolib';
    import { fullLangStore, lang, lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem, IItem as Item, RouteInstruction, RouteProfile, RouteStats, DirectionWayPoint as WayPoint } from '~/models/Item';
    import { Route, RoutingAction } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { MOBILITY_URL } from '~/services/TransitService';
    import { showError } from '@shared/utils/showError';
    import { defaultProfileCostingOptions, getSavedProfile, getValhallaSettings, removeSavedProfile, savedProfile, valhallaSettingColor, valhallaSettingIcon } from '~/utils/routing';
    import { colors, fonts, windowInset } from '~/variables';
    import { Themes, colorTheme, isEInk, onThemeChanged, theme } from '~/helpers/theme';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { MapClickInfo } from '@nativescript-community/ui-carto/ui';
    import { promiseSeq } from '~/utils/utils';

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

    const COLLECTIONVIEW_HEIGHT = 70;
</script>

<script lang="ts">
    let { colorOnPrimary, colorPrimary, colorSurfaceTint } = $colors;
    $: ({ colorOnPrimary, colorPrimary, colorSurfaceTint } = $colors);
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
    const showOptions = true;
    let loading = false;
    let writer: GeoJSONGeometryWriter<LatLonKeys>;
    let loaded = false;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let topLayout: NativeViewElementNode<StackLayout>;
    const loadedListeners = [];
    let currentTranslationY = -440;
    let computeMultiple = false;
    const costingOptions = { use_ferry: 0, shortest: false };
    const shouldSaveSettings = true;
    let pedestrianIcon = 'alpimaps-directions_walk';
    let bicycleIcon = 'alpimaps-touring';
    let requestProfile = ApplicationSettings.getBoolean('auto_fetch_profile', false);
    let requestStats = ApplicationSettings.getBoolean('auto_fetch_stats', false);

    let buttonsColor = isEInk ? 'black' : 'white';
    const buttonsColorAlpha = new Color(buttonsColor).setAlpha(50);

    export let editingItem: IItem = null;
    export let translationY = 0;
    export let translationFunction: Function = null;

    const used_settings = {
        common: ['service_factor', 'service_penalty', 'use_living_streets', 'use_tracks', 'use_ferry'],
        pedestrian: ['walking_speed', 'weight', 'use_hills', 'max_hiking_difficulty', 'step_penalty', 'driveway_factor', 'walkway_factor', 'sidewalk_factor', 'alley_factor', 'use_roads'],
        bicycle: ['use_hills', 'weight', 'avoid_bad_surfaces', 'use_roads', 'cycling_speed', 'non_network_penalty', 'exclude_unpaved'],
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
                // return pedestrian_type === 'mountainairing' ? 6 : 3;
                // always return 6 to ensure we use all available paths
                return 6;
            case 'step_penalty':
                return getPedestrianStepPenalty();
            case 'driveway_factor':
                return 5;
            case 'use_ferry':
                return 0;
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
            case 'exclude_unpaved':
                return false;
        }
    }
    function switchValhallaSetting(key: string, options: any = profileCostingOptions) {
        try {
            if (options === profileCostingOptions) {
                options = profileCostingOptions[profile];
            }
            const settings = getValhallaSettings(key, options[key]);
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
            profileCostingOptions = profileCostingOptions; // for svelte to see the update
            saveProfileSettings(profile);
        } catch (error) {
            console.error(key, error, error.stack);
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
        return currentP === p ? buttonsColor : buttonsColorAlpha;
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

    function updateRouteLayer() {
        cancel();
        const oldLayer = _routeLayer;
        _routeLayer = null;
        getRouteLayer(false);
        mapContext.replaceLayer(oldLayer, _routeLayer);
    }
    function getRouteLayer(add = true) {
        if (!_routeLayer) {
            _routeLayer = new VectorTileLayer({
                dataSource: getRouteDataSource(),
                decoder: mapContext.innerDecoder,
                labelRenderOrder: VectorTileRenderOrder.LAST,
                clickRadius: ApplicationSettings.getNumber('route_click_radius', 16),
                layerBlendingSpeed: 0,
                labelBlendingSpeed: 0
            });
            mapContext.innerDecoder.once('change', updateRouteLayer);
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
            if (add) {
                mapContext.addLayer(_routeLayer, 'directions');
            }
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
        toAdd.properties.name = metaData.title || metadata.name;
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
        // DEV_LOG && console.log('addInternalStopPoint', position, lastPoint?.properties);
        if (lastPoint.geometry.coordinates[0] === position.lon && lastPoint.geometry.coordinates[1] === position.lat) {
            return;
        }
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
                const actualWaypoints = JSON.parse(JSON.stringify(editingItem.route.waypoints));
                waypoints.splice(0, waypoints.length);
                waypoints.push(...actualWaypoints);
                nbWayPoints = waypoints.length;
                features.splice(0, features.length);
                features.push(...(actualWaypoints as any));
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
            translationY = Utils.layout.toDeviceIndependentPixels(nView.getMeasuredHeight()) + 10;
        } catch (error) {
            showError(error);
        }
    }
    let expanded = false;
    async function expand() {
        try {
            if (expanded) {
                return;
            }
            expanded = true;
            const nView = collectionView.nativeView;
            const params = {
                target: nView,
                height: COLLECTIONVIEW_HEIGHT * 2,
                duration: 100
            };
            await nView.animate(params);
        } catch (error) {
            expanded = false;
            showError(error);
        }
    }
    async function collapse() {
        try {
            if (!expanded) {
                return;
            }
            expanded = false;
            const nView = collectionView.nativeView;
            const params = {
                target: nView,
                height: COLLECTIONVIEW_HEIGHT,
                duration: 100
            };
            await nView.animate(params);
        } catch (error) {
            expanded = true;
            showError(error);
        }
    }
    async function onExpandedChevron() {
        if (expanded) {
            collapse();
        } else {
            expand();
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
        return nView.animate(params);
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

        mapContext.selectItem({ item: { geometry: { type: 'Point', coordinates: [position.lon, position.lat] }, properties: {} }, isFeatureInteresting: true, setSelected: true });
    }

    export function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, featureData, featureLayerName, position } = data;
        if (clickType === ClickType.LONG && waypoints.length > 0) {
            mapContext.unFocusSearch();
            featureData.layer = featureLayerName;
            // executeOnMainThread(() => {
            addWayPoint(position, featureData);
            // });
            return true;
        }
    }

    export function onMapClicked(e: { data: MapClickInfo<MapPos<LatLonKeys>> }) {
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
        dispatch('cancel');
        return hide();
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

    async function computeAndAddRoute(service: MultiValhallaOfflineRoutingService | ValhallaOnlineRoutingService, optionsWithStyle: { [k: string]: any; style?: any } = {}) {
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

            let startTime = Date.now();
            const projection = mapContext.getProjection();
            const customOptions = {
                language: $fullLangStore,
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
                showError(error, { forcedMessage: 'error computing route: ' + error, showAsSnack: true });
                console.error('error computing route', profile, error, JSON.stringify(points), JSON.stringify(customOptions));
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
                    hasRealName: false,
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
    async function computeRoutes(forceOnline = false) {
        try {
            loading = true;
            clearCurrentRoutes(false);
            clearWaypointLines(false);
            let itemToFocus: ItemFeature;
            const service: MultiValhallaOfflineRoutingService | ValhallaOnlineRoutingService = forceOnline
                ? packageService.onlineRoutingSearchService()
                : packageService.offlineRoutingSearchService() || packageService.onlineRoutingSearchService();
            const usingOnline = service instanceof ValhallaOnlineRoutingService;
            DEV_LOG && console.log('usingOnline', usingOnline);
            if (computeMultiple) {
                let options = [];
                if (profile === 'bicycle') {
                    options = [
                        {},
                        { shortest: true, style: { color: '#5994e0' } },
                        { avoid_bad_surfaces: 1, use_hills: 1, use_roads: 1, non_network_penalty: 0, style: { color: '#AD5FC4' } },
                        { avoid_bad_surfaces: 1, use_hills: 0, use_roads: 1, non_network_penalty: 25, style: { color: '#5FC476' } },
                        { avoid_bad_surfaces: 1, use_hills: 1, use_roads: 0, non_network_penalty: 50, style: { color: '#C49F5F' } }
                    ];
                } else if (profile === 'pedestrian') {
                    options = [
                        {},
                        //shortest
                        { shortest: true, style: { color: '#5994e0' } },
                        // very steep
                        { use_roads: 0, use_hills: 1, style: { color: '#AD5FC4' } },
                        // least steep
                        { use_roads: 0, use_hills: 0.4, step_penalty: 60, style: { color: '#5FC476' } }
                    ];
                } else {
                    options = [
                        {},
                        { shortest: true, style: { color: '#5994e0' } },
                        { shortest: false, use_tolls: 1, use_highways: 1, style: { color: '#AD5FC4' } },
                        { shortest: false, use_tolls: 0, use_highways: 1, style: { color: '#5FC476' } },
                        { shortest: false, use_highways: 0, style: { color: '#C49F5F' } }
                    ];
                }
                const results = usingOnline
                    ? await promiseSeq(
                          options.map((opts) => () => computeAndAddRoute(service, opts)),
                          500 // we add a delay or we will get a Too Many requests error
                      )
                    : await Promise.all(options.map((opts) => computeAndAddRoute(service, opts)));
                itemToFocus = results.reduce(function (prev, current) {
                    return prev?.route?.totalTime > current?.route?.totalTime ? current : prev;
                });
            } else {
                itemToFocus = await computeAndAddRoute(service);
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
        _routeDataSource.setLayerGeoJSONString(1, {
            type: 'FeatureCollection',
            features
        });
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
                nbWayPoints--;
                const fIndex = features.findIndex((f) => f.properties.id === item.properties.id);
                if (fIndex >= 0) {
                    features.splice(fIndex, 1);
                }
                if (waypoints.length) {
                    if (waypoints.length > 1 && index === waypoints.length) {
                        const lastPoint = waypoints.getItem(waypoints.length - 1);
                        if (!lastPoint.properties?.isStop) {
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
                    ...getValhallaSettings(key, profileCostingOptions[profile][key]),
                    onChange(value) {
                        profileCostingOptions[profile][key] = value;
                        profileCostingOptions = profileCostingOptions; // for svelte to see the update
                        saveProfileSettings(profile);
                    }
                }));
            }
            const SliderPopover = (await import('~/components/directions/DirectionsSettingsPopover.svelte')).default;
            await showPopover({
                view: SliderPopover,
                anchor: event.object,
                vertPos: VerticalPosition.ALIGN_TOP,
                props: {
                    currentOption: profile === 'bicycle' ? bicycle_type : pedestrian_type,
                    onCheckBox: (item, value) => {
                        item.onChange(value);
                    },
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
            const settings = getValhallaSettings(key, options[key]);
            await showSliderPopover({
                debounceDuration: 0,
                anchor: event.object,
                vertPos: VerticalPosition.BELOW,
                ...settings,
                value: options[key],
                onChange(value) {
                    options[key] = value;
                    profileCostingOptions = profileCostingOptions; // for svelte to see the update
                    saveProfileSettings(profile);
                },
                step: null,
                title: lc(key),
                icon: event.object.text
            });
            // const SliderPopover = (await import('~/components/common/SliderPopover.svelte')).default;
            // await showPopover({
            //     view: SliderPopover,
            //     anchor: event.object,
            //     props: {
            //         title: lc(key),
            //         icon: event.object.text,
            //         ...settings,
            //         value: options[key],
            //         onChange(value) {
            //             options[key] = value;
            //             saveProfileSettings(profile);
            //         }
            //     }
            // });
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
            const SliderPopover = (await import('~/components/directions/DirectionsSettingsPopover.svelte')).default;
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
            const SearchModal = (await import('~/components/search/SearchModal.svelte')).default;
            const position = mapContext.getMap().focusPos as GeoLocation;
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
                        name: result.title
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
    let collectionView: NativeViewElementNode<CollectionView>;
    function refreshCollectionView() {
        collectionView?.nativeView.refreshVisibleItems();
    }
    onThemeChanged((theme: Themes) => {
        buttonsColor = isEInk ? 'black' : 'white';
        refreshCollectionView();
    });
</script>

<stacklayout bind:this={topLayout} {...$$restProps} style="z-index:1000;" class="directionsPanel" translateY={currentTranslationY} ios:iosIgnoreSafeArea={false}>
    {#if loaded}
        <gridlayout bind:this={gridLayout} columns="*,40" rows="50,auto,auto" on:tap={() => {}}>
            <IconButton color={buttonsColor} horizontalAlignment="left" text="mdi-arrow-left" on:tap={() => cancel()} />
            <stacklayout colSpan={2} horizontalAlignment="center" orientation="horizontal">
                <IconButton color={profileColor(profile, 'auto')} text="mdi-car" on:tap={() => setProfile('auto')} />
                <IconButton color={profileColor(profile, 'motorcycle')} text="mdi-motorbike" on:tap={() => setProfile('motorcycle')} />
                <IconButton
                    color={profileColor(profile, 'pedestrian')}
                    fontFamily={$fonts.app}
                    onLongPress={(event) => showProfileSettings('pedestrian', event)}
                    text={pedestrianIcon}
                    on:tap={() => setProfile('pedestrian')} />
                <IconButton
                    color={profileColor(profile, 'bicycle')}
                    fontFamily={$fonts.app}
                    onLongPress={(event) => showProfileSettings('bicycle', event)}
                    text={bicycleIcon}
                    on:tap={() => setProfile('bicycle')} />
                <!-- <IconButton white={true} text="mdi-bus" on:tap={() => setProfile('bus')} color={profileColor(profile, 'bus')} /> -->
            </stacklayout>
            <IconButton
                backgroundColor="white"
                colSpan={2}
                color="black"
                horizontalAlignment="right"
                isSelected={nbWayPoints > 1}
                isVisible={!loading}
                marginRight={10}
                rippleColor="black"
                selectedColor={colorPrimary}
                text="mdi-magnify"
                on:tap={() => computeRoutes()}
                on:longPress={() => computeRoutes(true)} />
            <activityindicator busy={true} colSpan={2} color={buttonsColor} height={40} horizontalAlignment="right" visibility={loading ? 'visible' : 'hidden'} width={40} />
            <collectionview
                bind:this={collectionView}
                animateItemUpdate={true}
                height={COLLECTIONVIEW_HEIGHT}
                itemIdGenerator={(item, i) => item.properties.id}
                items={waypoints}
                reorderEnabled={true}
                reorderLongPressEnabled={true}
                row={1}
                rowHeight={36}
                on:itemReorderStarting={onItemReorderStarting}
                on:itemReordered={onItemReordered}>
                <Template let:item>
                    <canvaslabel color={buttonsColor} fontSize={15} paddingLeft={10}>
                        <cspan fontFamily={$fonts.mdi} fontSize={14} paddingTop={-2} text="mdi-dots-vertical" verticalAlignment="top" visibility={item.properties.isStart ? 'hidden' : 'visible'} />
                        <cspan
                            fontFamily={$fonts.mdi}
                            fontSize={14}
                            paddingBottom={-2}
                            text="mdi-dots-vertical"
                            verticalAlignment="bottom"
                            visibility={item.properties.isStop ? 'hidden' : 'visible'} />
                        <cspan
                            fontFamily={$fonts.mdi}
                            text={item.properties.isStop ? 'mdi-flag-checkered' : item.properties.isStart ? 'mdi-map-marker' : 'mdi-checkbox-blank-circle-outline'}
                            verticalAlignment="middle" />

                        <gridlayout
                            backgroundColor={isEInk ? 'white' : colorSurfaceTint}
                            borderColor="black"
                            borderRadius={8}
                            borderWidth={isEInk ? 1 : 0}
                            columns=" *,auto"
                            height={30}
                            margin="0 0 0 30"
                            on:tap={(event) => openSearchFromItem(event, item)}>
                            <label color={buttonsColor} fontSize={15} lineBreak="end" marginLeft={15} maxLines={1} text={item.properties.name} verticalTextAlignment="center" />

                            <IconButton
                                col={1}
                                color={buttonsColor}
                                isVisible={item.properties.name && item.properties.name.length > 0}
                                small={true}
                                text="mdi-delete"
                                on:tap={() => clearWayPoint(item)} />
                        </gridlayout>
                    </canvaslabel>
                </Template>
            </collectionview>
            <IconButton col={1} color={buttonsColor} height={40} isEnabled={nbWayPoints > 1} row={1} text="mdi-swap-vertical" on:tap={() => reversePoints()} />
            <stacklayout id="directionsbuttons" colSpan={2} orientation="horizontal" row={2} visibility={showOptions ? 'visible' : 'collapse'}>
                {#if profile === 'auto' || profile === 'motorcycle'}
                    <IconButton
                        color={valhallaSettingColor('use_highways', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('use_highways', event)}
                        size={40}
                        text={valhallaSettingIcon['use_highways']}
                        on:tap={() => switchValhallaSetting('use_highways')} />

                    <IconButton
                        color={valhallaSettingColor('use_tolls', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('use_tolls', event)}
                        size={40}
                        text={valhallaSettingIcon['use_tolls']}
                        on:tap={() => switchValhallaSetting('use_tolls')} />
                {/if}
                {#if profile === 'bicycle'}
                    <IconButton
                        color={valhallaSettingColor('use_roads', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('use_roads', event)}
                        size={40}
                        text={valhallaSettingIcon['use_roads']}
                        on:tap={() => switchValhallaSetting('use_roads')} />
                    <IconButton
                        color={valhallaSettingColor('use_hills', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('use_hills', event)}
                        size={40}
                        text={valhallaSettingIcon['use_hills']}
                        on:tap={() => switchValhallaSetting('use_hills')} />
                    <IconButton
                        color={valhallaSettingColor('non_network_penalty', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('non_network_penalty', event)}
                        size={40}
                        text={valhallaSettingIcon['non_network_penalty']}
                        on:tap={() => switchValhallaSetting('non_network_penalty')} />
                    <IconButton
                        color={valhallaSettingColor('weight', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('weight', event)}
                        size={40}
                        text={valhallaSettingIcon['weight']}
                        on:tap={() => switchValhallaSetting('weight')} />
                    <IconButton
                        color={valhallaSettingColor('avoid_bad_surfaces', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('avoid_bad_surfaces', event)}
                        size={40}
                        text={valhallaSettingIcon['avoid_bad_surfaces']}
                        on:tap={() => switchValhallaSetting('avoid_bad_surfaces')} />
                    <!-- <IconButton col={5} text={bicycleTypeIcon(bicycle_type)} isVisible={profile === 'bicycle'} color="white" on:tap={() => switchValhallaSetting('bicycle_type')} /> -->
                {/if}
                {#if profile === 'pedestrian'}
                    <IconButton
                        color={valhallaSettingColor('driveway_factor', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('driveway_factor', event)}
                        size={40}
                        text={valhallaSettingIcon['driveway_factor']}
                        on:tap={() => switchValhallaSetting('driveway_factor')} />
                    <IconButton
                        color={valhallaSettingColor('use_hills', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('use_hills', event)}
                        size={40}
                        text={valhallaSettingIcon['use_hills']}
                        on:tap={() => switchValhallaSetting('use_hills')} />
                    <IconButton
                        color={valhallaSettingColor('weight', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('weight', event)}
                        size={40}
                        text={valhallaSettingIcon['weight']}
                        on:tap={() => switchValhallaSetting('weight')} />
                    <IconButton
                        color={valhallaSettingColor('step_penalty', profile, profileCostingOptions, buttonsColor)}
                        onLongPress={(event) => setSliderCostingOptions('step_penalty', event)}
                        size={40}
                        text={valhallaSettingIcon['step_penalty']}
                        on:tap={() => switchValhallaSetting('step_penalty')} />
                {/if}
            </stacklayout>

            <stacklayout id="directionsbuttons2" colSpan={3} horizontalAlignment="right" orientation="horizontal" row={2} visibility={showOptions ? 'visible' : 'collapse'}>
                <IconButton color={costingOptions.shortest ? buttonsColor : buttonsColorAlpha} size={40} text="mdi-timer-outline" on:tap={() => (costingOptions.shortest = !costingOptions.shortest)} />
                <IconButton color={computeMultiple ? buttonsColor : buttonsColorAlpha} size={40} text="mdi-arrow-decision" on:tap={() => (computeMultiple = !computeMultiple)} />
                <IconButton color={buttonsColor} size={40} text="mdi-dots-vertical" on:tap={showMoreOptions} />
                <IconButton color={buttonsColor} size={40} text={expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'} on:tap={onExpandedChevron} />
            </stacklayout>
        </gridlayout>
    {/if}
</stacklayout>
