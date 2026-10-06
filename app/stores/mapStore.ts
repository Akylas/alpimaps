import { lc } from '@nativescript-community/l';
import { closePopover, showPopover } from '@nativescript-community/ui-popover/svelte';
import { ApplicationSettings, type EventData, Observable } from '@nativescript/core';
import { type Writable, get, writable } from 'svelte/store';
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
export const rotateEnabled = settingsStore('mapRotateEnabled', true);
export const pitchEnabled = settingsStore('mapPitchEnabled', true);

export const useOfflineGeocodeAddress = settingsStore('useOfflineGeocodeAddress', true);
export const useSystemGeocodeAddress = settingsStore('useSystemGeocodeAddress', true);

export const showItemsLayer = settingsStore('showItemsLayer', true);
export const itemLock = writable(false);
export const immersive = settingsStore('immersive', false);
export const showAscents = settingsStore(SETTINGS_SHOW_ELEVATION_PROFILE_ASCENTS, DEFAULT_SHOW_ELEVATION_PROFILE_ASCENTS);
export const chartShowWaypoints = settingsStore(SETTINGS_SHOW_ELEVATION_PROFILE_WAYPOINTS, DEFAULT_SHOW_ELEVATION_PROFILE_WAYPOINTS);
export const showGradeColors = settingsStore(SETTINGS_SHOW_ELEVATION_PROFILE_GRADE_COLORS, DEFAULT_SHOW_ELEVATION_PROFILE_GRADE_COLORS);
/** the parameters the current map style has, null before one loads: the map options list only those */
export const styleParameterKeys = writable<string[]>(null);
/** what the style draws with now, for an option left to the style (a boolean defaulting to -1) to show */
export const styleParameterValues = writable<Record<string, string>>({});
// the app's own, not the style's: listed with any style
const APP_STYLE_PARAMS = ['contours', 'contoursOpacity'];
export function styleHasParameter(keys: string[], key: string) {
    return !keys || APP_STYLE_PARAMS.includes(key) || keys.includes(key);
}
export const clickHandlerLayerFilter = settingsStore('clickHandlerLayerFilter', '(poi|mountain_peak|transportation_name|route|aerodrome_label|water_name|place|landcover_name)::.*');
// export const clickHandlerLayerFilter = settingsStore('clickHandlerLayerFilter', '(transportation_name|route|.*::(icon|label))');

const layersParams = {
    showSlopePercentages: {
        title: lc('show_percentage_slopes'),
        settingsOptionsType: 'boolean',
        showAsIcon: true,
        defaultValue: false,
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
        // hasTerrain, not hasLocalData: the lines are traced from the DEM
        visible: (capabilities) => !!capabilities?.hasTerrain,
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
        defaultValue: 0.4
    },
    buildings: {
        title: lc('buildings_3d'),
        settingsOptionsType: 'boolean',
        showAsIcon: true,
        defaultValue: false,
        icon: 'mdi-domain',
        // any vector source has buildings; whether the style can extrude them is styleHasParameter's
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
    },
    // Massif's own; a style without one is not sent it, and the map options leave it out
    lighting: {
        icon: 'mdi-white-balance-sunny',
        title: lc('style_lighting'),
        description: lc('style_lighting_desc'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    label_occlusion: {
        icon: 'mdi-eye-off-outline',
        title: lc('label_occlusion'),
        description: lc('label_occlusion_desc'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    poi_on_roof: {
        icon: 'mdi-home-roof',
        title: lc('poi_on_roof'),
        settingsOptionsType: 'boolean',
        defaultValue: -1
    },
    poiStyle: {
        icon: 'mdi-map-marker-outline',
        title: lc('poi_plain_icons'),
        settingsOptionsType: 'boolean',
        // picked in the style sheet (StylePicker), default / fill / icon only
        showAsIcon: true,
        // unset: each project keeps its own (Alpimaps OSM is plain, the variants badges)
        defaultValue: -1 as number | boolean,
        nutiTransform: (value) => (value ? 'plain' : 'badge'),
        fromNuti: (value) => value === 'plain'
    },
    building_ao: {
        icon: 'mdi-domain',
        title: lc('building_ao'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    building_opacity: {
        icon: 'mdi-domain',
        title: lc('building_opacity'),
        settingsOptionsType: 'number',
        defaultValue: 1
    },
    sac_scale_labels: {
        icon: 'mdi-hiking',
        title: lc('sac_scale_labels'),
        settingsOptionsType: 'boolean',
        defaultValue: false
    },
    mtb_markings: {
        icon: 'mdi-bike',
        title: lc('mtb_markings'),
        settingsOptionsType: 'boolean',
        showAsIcon: true,
        defaultValue: false
    },
    poi_label_color: {
        icon: 'mdi-format-color-text',
        title: lc('poi_label_color'),
        settingsOptionsType: 'boolean',
        defaultValue: true,
        nutiTransform: (value) => (value ? 'category' : 'neutral'),
        fromNuti: (value) => value !== 'neutral'
    },
    show_boundaries: {
        icon: 'mdi-vector-polyline',
        title: lc('show_boundaries'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    road_osm_low: {
        icon: 'mdi-road-variant',
        title: lc('road_osm_low'),
        description: lc('road_osm_low_desc'),
        settingsOptionsType: 'boolean',
        defaultValue: -1
    },
    path_min_zoom: {
        icon: 'mdi-plus-minus-variant',
        title: lc('path_min_zoom'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    track_min_zoom: {
        icon: 'mdi-plus-minus-variant',
        title: lc('track_min_zoom'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    tunnel_min_zoom: {
        icon: 'mdi-plus-minus-variant',
        title: lc('tunnel_min_zoom'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    water_min_zoom: {
        icon: 'mdi-plus-minus-variant',
        title: lc('water_min_zoom'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    campsite_min_zoom: {
        icon: 'mdi-plus-minus-variant',
        title: lc('campsite_min_zoom'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    wetland_pattern_zoom: {
        icon: 'mdi-plus-minus-variant',
        title: lc('wetland_pattern_zoom'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    hillshade_max_zoom: {
        icon: 'mdi-terrain',
        title: lc('hillshade_max_zoom'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    }
};
interface StoreParam {
    title?: string;
    description?: string;
    key?: string;
    icon?: string;
    settingsOptionsType?: string;
    defaultValue?: boolean | number | string;
    showAsIcon?: boolean;
    inner?: boolean;
    min?: number;
    max?: number;
    step?: number;
    visible?: (capabilities) => boolean;
    onLongPress?: (...args) => unknown;
    nutiTransform?: (value) => string;
    /** the switch state of a style's own value, for an option left to the style */
    fromNuti?: (value: string) => boolean;
}
type StoreParams = Record<string, StoreParam>;
interface RuntimeStoreParam extends StoreParam {
    value?;
    store?: Writable<any> & { ignoreUpdate?: boolean };
    updateMethod?: (key: string, value) => void;
}
type StoreValue<P extends StoreParam> = P['defaultValue'];
type StoreProps<P extends StoreParam> = P & { value: StoreValue<P>; store: Writable<StoreValue<P>>; updateMethod: (key: string, value: StoreValue<P>) => void };

export interface PropsChangeEvent extends EventData {
    key: string;
    value;
    nutiValue: string;
}
export type PropsStore<T extends StoreParams> = Observable & {
    [K in keyof T]: StoreValue<T[K]> | null;
} & {
    getTitle(key: keyof T): string;
    getDescription(key: keyof T): string;
    getKey(key: keyof T): string;
    getDefaultValue<K extends keyof T>(key: K): StoreValue<T[K]>;
    getProps<K extends keyof T>(key: K): StoreProps<T[K]>;
    getNutiTransform(key: keyof T): (value) => string;
    getStore<K extends keyof T>(key: K): Writable<StoreValue<T[K]>>;
    getNutiValue(key: keyof T): string | null;
    getKeys(): (keyof T & string)[];
    getSettingsOptions(key: keyof T): any;
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
        case 'boolean': {
            const props = store.getProps(key);
            // a default of -1: the style decides until the user overrides it, a long press resets
            const styleOwned = props.defaultValue === -1;
            const overridden = styleOwned && props.value != null && props.value !== -1;
            const live = get(styleParameterValues)[key];
            const styleValue = props.fromNuti ? props.fromNuti(live) : live != null && live !== '0' && live !== '';
            return {
                type: 'switch',
                ...defaultSettings,
                value: styleOwned && !overridden ? styleValue : !!props.value,
                styleOwned,
                overridden
            };
        }
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
function createStore<T extends StoreParams>(storeParams: T): PropsStore<T> {
    const params: Record<string, RuntimeStoreParam> = storeParams;
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
            notifyCallback?.({ eventName: 'change', object: propsObj, key, value, nutiValue: value == null ? null : nutiTransform ? nutiTransform(value) : value + '' });
        });
        obj.updateMethod = updateMethod;
    });
    notifyCallback = propsObj.notify.bind(propsObj);
    Object.assign(propsObj, params);

    const keys = Object.keys(params);
    // built once: the get trap runs on every property access, including reads while the map is
    // being styled, so it must not allocate closures
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
            // a boolean left to the style is -1 until set
            if (obj.value == null || (obj.value === -1 && obj.settingsOptionsType === 'boolean')) {
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
                notifyCallback?.({ eventName: 'change', object: propsObj, key, value, nutiValue: value == null ? null : nutiTransform ? nutiTransform(value) : value + '' });
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
export type NutiParamKey = keyof typeof nutiParams;
export const nutiProps = createStore(nutiParams);
export const innerNutiProps = createStore(innerNutiParams);
export const layerProps = createStore(layersParams);
