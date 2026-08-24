import { lc } from '@nativescript-community/l';
import { closePopover, showPopover } from '@nativescript-community/ui-popover/svelte';
import { ApplicationSettings, Observable } from '@nativescript/core';
import { get, writable } from 'svelte/store';
import type { RoutesType } from '~/mapModules/CustomLayersModule';
import { showError } from '@shared/utils/showError';
import { showSliderPopover, showToolTip } from '~/utils/ui';
import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
import { tryCatchFunction } from '@shared/utils/ui';
import {
    DEFAULT_SHOW_ELEVATION_PROFILE_ASCENTS,
    DEFAULT_SHOW_ELEVATION_PROFILE_GRADE_COLORS,
    DEFAULT_SHOW_ELEVATION_PROFILE_WAYPOINTS,
    SETTINGS_ELEVATION_PROFILE_ASCENTS_DIP_TOLERANCE,
    SETTINGS_ELEVATION_PROFILE_ASCENTS_MIN_GAIN,
    SETTINGS_SHOW_ELEVATION_PROFILE_ASCENTS,
    SETTINGS_SHOW_ELEVATION_PROFILE_GRADE_COLORS,
    SETTINGS_SHOW_ELEVATION_PROFILE_WAYPOINTS
} from '~/utils/constants';
import { settingsStore } from '~/stores/settingsStore';

export const watchingLocation = writable(false);
export const queryingLocation = writable(false);
export const projectionModeSpherical = settingsStore('showGlobe', false);

export const preloading = settingsStore('preloading', true);
export const rotateEnabled = settingsStore('mapRotateEnabled', false);
export const pitchEnabled = settingsStore('mapPitchEnabled', false);

export const useOfflineGeocodeAddress = settingsStore('useOfflineGeocodeAddress', true);
export const useSystemGeocodeAddress = settingsStore('useSystemGeocodeAddress', true);

export const showItemsLayer = settingsStore('showItemsLayer', true);
export const itemLock = writable(false);
export const immersive = settingsStore('immersive', false);
export const showAscents = settingsStore(SETTINGS_SHOW_ELEVATION_PROFILE_ASCENTS, DEFAULT_SHOW_ELEVATION_PROFILE_ASCENTS);
export const chartShowWaypoints = settingsStore(SETTINGS_SHOW_ELEVATION_PROFILE_WAYPOINTS, DEFAULT_SHOW_ELEVATION_PROFILE_WAYPOINTS);
export const showGradeColors = settingsStore(SETTINGS_SHOW_ELEVATION_PROFILE_GRADE_COLORS, DEFAULT_SHOW_ELEVATION_PROFILE_GRADE_COLORS);
export const clickHandlerLayerFilter = settingsStore('clickHandlerLayerFilter', '(transportation_name|route|.*::(icon|label))');

const layersParams = {
    showSlopePercentages: {
        title: lc('show_percentage_slopes'),
        settingsOptionsType: 'boolean',
        showAsIcon: true,
        defaultValue: true,
        icon: 'mdi-signal',
        visible: (capabilities) => !!capabilities?.hasTerrain,
        onLongPress: tryCatchFunction(async (event, button) => {
            if (layerProps['showSlopePercentages']) {
                const component = (await import('~/components/map/SlopesInfoPopover.svelte')).default;
                await showPopover({
                    view: component,
                    anchor: event.object,
                    vertPos: VerticalPosition.ALIGN_TOP,
                    horizPos: HorizontalPosition.RIGHT
                });
            } else {
                showToolTip(button.tooltip);
            }
        })
    },
    clickRadius: {
        title: lc('vector_element_click_radius'),
        description: lc('vector_element_click_radius_desc'),
        settingsOptionsType: 'number',
        defaultValue: 4,
        min: 1,
        step: 1,
        max: 400
    }
};
const innerNutiParams = {
    items_show_km_shields: {
        title: lc('items_show_km_shields'),
        icon: 'mdi-shield',
        settingsOptionsType: 'boolean',
        defaultValue: true,
        inner: true
    }
};
const nutiParams = {
    _fontscale: {
        title: lc('map_font_scale'),
        description: lc('map_font_scale_desc'),
        settingsOptionsType: 'number',
        icon: 'mdi-format-size',
        defaultValue: 1,
        min: 0.5,
        max: 4
    },
    contours: {
        title: lc('show_contour_lines'),
        settingsOptionsType: 'boolean',
        defaultValue: true,
        icon: 'mdi-bullseye',
        showAsIcon: true,
        visible: (capabilities) => !!capabilities?.hasLocalData,
        onLongPress: tryCatchFunction(async (event) => {
            await showSliderPopover({
                debounceDuration: 100,
                anchor: event.object,
                ...nutiProps.getSettingsOptions('contoursOpacity'),
                vertPos: VerticalPosition.ABOVE,
                value: nutiProps['contoursOpacity'],
                onChange(value) {
                    nutiProps['contoursOpacity'] = value;
                }
            });
        })
    },
    contoursOpacity: {
        title: lc('contour_lines_opacity'),
        icon: 'mdi-bullseye',
        description: lc('contour_lines_opacity_desc'),
        settingsOptionsType: 'number',
        defaultValue: 1
    },
    buildings: {
        title: lc('buildings_3d'),
        settingsOptionsType: 'boolean',
        showAsIcon: true,
        defaultValue: false,
        icon: 'mdi-domain',
        visible: (capabilities) => !!capabilities?.hasLocalData,
        nutiTransform: (value) => (!!value ? '2' : '1')
    },
    building_min_zoom: {
        icon: 'mdi-plus-minus-variant',
        title: lc('building_min_zoom'),
        description: lc('building_min_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    road_shields: {
        icon: 'mdi-shield',
        title: lc('show_road_shields'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    show_routes: {
        title: lc('show_routes'),
        settingsOptionsType: 'boolean',
        defaultValue: false,
        icon: 'mdi-routes',
        visible: (capabilities) => !!capabilities?.hasRoute,
        onLongPress: tryCatchFunction(async (event) => {
            const component = (await import('~/components/routes/RoutesTypePopover.svelte')).default;
            await showPopover({
                view: component,
                anchor: event.object,
                vertPos: VerticalPosition.ALIGN_TOP,
                horizPos: HorizontalPosition.RIGHT
            });
        })
    },
    routes_type: {
        icon: 'mdi-routes',
        settingsOptionsType: 'number',
        showAsIcon: true,
        defaultValue: 0,
        min: 0,
        max: 2,
        step: 1,
        nutiTransform: (value) => value.toFixed(0)
    },
    route_shields: {
        title: lc('show_route_shields'),
        icon: 'mdi-shield',
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    road_shield_min_dist: {
        icon: 'mdi-map-marker-distance',
        title: lc('road_shield_min_dist'),
        description: lc('road_shield_min_dist_desc'),
        settingsOptionsType: 'number',
        defaultValue: 40,
        min: 0,
        max: 200,
        step: 1
    },
    road_shield_spacing: {
        icon: 'mdi-map-marker-distance',
        title: lc('road_shield_spacing'),
        description: lc('road_shield_spacing_desc'),
        settingsOptionsType: 'number',
        defaultValue: 100,
        min: 0,
        max: 200,
        step: 1
    },
    routes_dash_min_zoom: {
        icon: 'mdi-plus-minus-variant',
        title: lc('routes_dash_min_zoom'),
        description: lc('routes_dash_min_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    polygons_border: {
        icon: 'mdi-vector-polygon',
        title: lc('show_polygone_border'),
        settingsOptionsType: 'boolean',
        defaultValue: false
    },
    sub_boundaries: {
        icon: 'mdi-vector-polygon',
        title: lc('show_sub_boundaries'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    show_underground: {
        icon: 'mdi-subway',
        title: lc('show_underground_transports'),
        settingsOptionsType: 'boolean',
        defaultValue: false
    },
    show_tram: {
        icon: 'mdi-tram',
        title: lc('show_tram_lines'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    emphasis_rails: {
        icon: 'mdi-train',
        title: lc('emphasis_rail_tracks'),
        settingsOptionsType: 'boolean',
        defaultValue: false
    },
    highlight_drinking_water: {
        icon: 'mdi-water-pump',
        title: lc('emphasis_drinking_water'),
        settingsOptionsType: 'boolean',
        defaultValue: false
    },
    campsite_allow_overlap: {
        icon: 'mdi-tent',
        title: lc('campsite_allow_overlap'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    show_caravan_site: {
        icon: 'mdi-caravan',
        title: lc('show_caravan_site'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    city_min_zoom: {
        icon: 'mdi-plus-minus-variant',
        title: lc('city_min_zoom'),
        description: lc('city_min_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    river_label_min_zoom: {
        title: lc('river_label_min_zoom'),
        icon: 'mdi-plus-minus-variant',
        description: lc('river_label_min_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },

    scrub_pattern_zoom: {
        title: lc('scrub_pattern_zoom'),
        icon: 'mdi-plus-minus-variant',
        description: lc('scrub_pattern_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    scree_pattern_zoom: {
        title: lc('scree_pattern_zoom'),
        icon: 'mdi-plus-minus-variant',
        description: lc('scree_pattern_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    rock_pattern_zoom: {
        title: lc('rock_pattern_zoom'),
        icon: 'mdi-plus-minus-variant',
        description: lc('rock_pattern_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    forest_pattern_zoom: {
        title: lc('forest_pattern_zoom'),
        icon: 'mdi-plus-minus-variant',
        description: lc('forest_pattern_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    }
};
function nutiTransformForType(type) {
    switch (type) {
        case 'boolean':
            return (value) => (!!value ? '1' : '0');
        case 'number':
            return (value) => value.toFixed(2);
        default:
            return null;
    }
}
function nutiSettings(type, key, store) {
    const defaultSettings = {
        id: 'setting',
        nutiProps: store,
        key,
        nutiTransform: nutiTransformForType(type),
        ...store.getProps(key)
    };
    switch (type) {
        case 'zoom':
            return {
                min: 0,
                max: 24,
                step: 1,
                type: 'slider',
                rightValue: () => (store[key] != null && store[key] !== -1 ? store[key] : lc('notset')),
                currentValue: () => Math.max(0, store[key] ?? -1),
                formatter: (value) => value.toFixed(),
                transformValue: (value, item) => value,
                valueFormatter: (value, item) => value.toFixed(),
                ...defaultSettings
            };
        case 'boolean':
            return {
                type: 'switch',
                value: store[key] ?? false,
                ...defaultSettings
            };
        case 'number':
            return {
                min: 0,
                max: 1,
                step: null,
                type: 'slider',
                rightValue: () => (store[key] != null ? store[key].toFixed(2) : lc('notset')),
                currentValue: () => store[key],
                formatter: (value) => value,
                transformValue: (value, item) => value,
                valueFormatter: (value, item) => value.toFixed(2),
                ...defaultSettings
            };
    }
}
function createStore(params) {
    const propsObj = new Observable();
    // stays null for the whole loop below: subscribing to a writable fires the callback
    // synchronously, and that first call is the store reporting its start value, not a change
    let notifyCallback = null;
    Object.keys(params).forEach((key) => {
        const obj = params[key];
        // resolved once here rather than re-derived on every read and every write
        const nutiTransform = (obj.nutiTransform = obj.nutiTransform ?? nutiTransformForType(obj.settingsOptionsType));
        const settingKey = obj.key || key;
        const defaultValue = obj.defaultValue ?? null;
        const tpof = obj.settingsOptionsType || typeof defaultValue;
        let updateMethod;
        let startValue;
        switch (tpof) {
            case 'boolean':
                updateMethod = ApplicationSettings.setBoolean;
                startValue = ApplicationSettings.getBoolean(settingKey, defaultValue as boolean);
                break;
            case 'number':
            case 'zoom':
                updateMethod = ApplicationSettings.setNumber;
                startValue = ApplicationSettings.getNumber(settingKey, defaultValue as number);
                break;

            default:
                updateMethod = ApplicationSettings.setString;
                startValue = ApplicationSettings.getString(settingKey, defaultValue as string);
                break;
        }
        obj.value = startValue;
        obj.store = writable(startValue);
        // true so the synchronous start-value callback does not persist what we just read
        obj.store.ignoreUpdate = true;
        obj.store.subscribe((value) => {
            if (obj.store.ignoreUpdate) {
                obj.store.ignoreUpdate = false;
                return;
            }
            obj.value = value;
            if (value === defaultValue) {
                ApplicationSettings.remove(settingKey);
            } else {
                updateMethod(settingKey, value);
            }
            notifyCallback?.({ eventName: 'change', object: propsObj, key, value, nutiValue: nutiTransform ? nutiTransform(value) : value + '' });
        });
        obj.updateMethod = updateMethod;
    });
    notifyCallback = propsObj.notify.bind(propsObj);
    Object.assign(propsObj, params);

    const keys = Object.keys(params);
    /**
     * Built once. The get trap runs on every property access, so returning a fresh closure from it —
     * as this used to for each of the ten accessors, plus a bind() for anything else — allocated on
     * reads that happen while the map is being styled.
     */
    const accessors: Record<string, Function> = {
        getTitle: (key: string) => params[key].title,
        getDescription: (key: string) => params[key].description,
        getKey: (key: string) => params[key].key || key,
        getDefaultValue: (key: string) => params[key].defaultValue,
        getProps: (key: string) => params[key],
        getNutiTransform: (key: string) => params[key].nutiTransform,
        getStore: (key: string) => params[key].store,
        getNutiValue(key: string) {
            const obj = params[key];
            if (obj.value == null) {
                return null;
            }
            return obj.nutiTransform ? obj.nutiTransform(obj.value) : obj.value + '';
        },
        getKeys: () => keys.slice()
    };
    const boundMethods = new Map<string, Function>();

    return new Proxy(propsObj, {
        set(target, key, value) {
            try {
                const obj = target[key];
                const settingKey = obj.key || key;
                const nutiTransform = obj.nutiTransform;
                DEV_LOG && console.log('set', key, value, settingKey);
                obj.value = value;
                obj.store.ignoreUpdate = true;
                obj.store.set(value);
                if (value == null || value === obj.defaultValue) {
                    ApplicationSettings.remove(settingKey);
                } else {
                    obj.updateMethod(settingKey, value);
                }
                notifyCallback?.({ eventName: 'change', object: propsObj, key, value, nutiValue: nutiTransform ? nutiTransform(value) : value + '' });
            } catch (error) {
                showError(error);
            }
            return true;
        },
        get(target, name, receiver) {
            if (target[name] && typeof target[name] === 'object') {
                return target[name].value !== target[name].defaultValue ? target[name].value : null;
            }
            const accessor = accessors[name as string];
            if (accessor) {
                return accessor;
            }
            // needs the proxy as `this` so nutiSettings reads values back through this same trap
            if (name === 'getSettingsOptions') {
                return (key: string) => nutiSettings(params[key].settingsOptionsType, key, receiver);
            }
            const orig = target[name];
            if (typeof orig === 'function') {
                let bound = boundMethods.get(name as string);
                if (!bound) {
                    bound = orig.bind(target);
                    boundMethods.set(name as string, bound);
                }
                return bound;
            }
            return Reflect.get(target, name, receiver);
        }
    }) as any;
}
export const nutiProps = createStore(nutiParams);
export const innerNutiProps = createStore(innerNutiParams);
export const layerProps = createStore(layersParams);
