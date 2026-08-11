import { derived, get, writable } from 'svelte/store';
import { convertDurationSeconds, formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { IItem } from '~/models/Item';
import { SettingsStore, settingsStore } from '~/stores/settingsStore';
import {
    DEFAULT_NAVIGATION_AUTO_PAUSE,
    DEFAULT_NAVIGATION_AUTO_PAUSE_DELAY,
    DEFAULT_NAVIGATION_AUTO_PAUSE_SPEED,
    DEFAULT_NAVIGATION_AUTO_ZOOM,
    DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
    DEFAULT_NAVIGATION_HIDE_SEARCH,
    DEFAULT_NAVIGATION_MANEUVER_WAKE_DISTANCE,
    DEFAULT_NAVIGATION_RECORD_STATS,
    DEFAULT_NAVIGATION_RECORD_TRACK,
    DEFAULT_NAVIGATION_SPEED_DROP_WAKE,
    DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO,
    DEFAULT_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE,
    DEFAULT_NAVIGATION_ZOOM_LOOK_AHEAD,
    DEFAULT_NAVIGATION_ZOOM_MAX,
    DEFAULT_NAVIGATION_ZOOM_MAX_LOOK_AHEAD,
    DEFAULT_NAVIGATION_ZOOM_MIN,
    DEFAULT_NAVIGATION_ZOOM_MIN_LOOK_AHEAD,
    SETTINGS_NAVIGATION_AUTO_PAUSE,
    SETTINGS_NAVIGATION_AUTO_PAUSE_DELAY,
    SETTINGS_NAVIGATION_AUTO_PAUSE_SPEED,
    SETTINGS_NAVIGATION_AUTO_ZOOM,
    SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
    SETTINGS_NAVIGATION_HIDE_SEARCH,
    SETTINGS_NAVIGATION_MANEUVER_WAKE_DISTANCE,
    SETTINGS_NAVIGATION_RECORD_STATS,
    SETTINGS_NAVIGATION_RECORD_TRACK,
    SETTINGS_NAVIGATION_SPEED_DROP_WAKE,
    SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO,
    SETTINGS_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE,
    SETTINGS_NAVIGATION_ZOOM_LOOK_AHEAD,
    SETTINGS_NAVIGATION_ZOOM_MAX,
    SETTINGS_NAVIGATION_ZOOM_MAX_LOOK_AHEAD,
    SETTINGS_NAVIGATION_ZOOM_MIN,
    SETTINGS_NAVIGATION_ZOOM_MIN_LOOK_AHEAD
} from '~/utils/constants';
import type { RouteProgress } from '~/utils/navigation';

export enum NavigationState {
    IDLE = 'idle',
    RUNNING = 'running',
    PAUSED = 'paused'
}

export interface NavigationStats {
    /** milliseconds since the navigation started, pauses excluded */
    duration: number;
    /** meters travelled */
    distance: number;
    /** km/h, same unit as Session */
    currentSpeed: number;
    /** km/h */
    averageSpeed: number;
    altitudeGain: number;
    altitudeNegative: number;
}

export const navigationState = writable<NavigationState>(NavigationState.IDLE);
/** the route being navigated, null when idle */
export const navigationItem = writable<IItem>(null);
/** where the user is along `navigationItem`, null when off route or idle */
export const navigationProgress = writable<RouteProgress>(null);
/** null unless navigation_record_stats is on */
export const navigationStats = writable<NavigationStats>(null);

export const isNavigating = derived(navigationState, (state) => state !== NavigationState.IDLE);
export const isNavigationRunning = derived(navigationState, (state) => state === NavigationState.RUNNING);

export const navigationAutoZoom = settingsStore(SETTINGS_NAVIGATION_AUTO_ZOOM, DEFAULT_NAVIGATION_AUTO_ZOOM);
export const navigationZoomLookAhead = settingsStore(SETTINGS_NAVIGATION_ZOOM_LOOK_AHEAD, DEFAULT_NAVIGATION_ZOOM_LOOK_AHEAD);
export const navigationZoomDenseManeuverDistance = settingsStore(SETTINGS_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE, DEFAULT_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE);
export const navigationZoomMinLookAhead = settingsStore(SETTINGS_NAVIGATION_ZOOM_MIN_LOOK_AHEAD, DEFAULT_NAVIGATION_ZOOM_MIN_LOOK_AHEAD);
export const navigationZoomMaxLookAhead = settingsStore(SETTINGS_NAVIGATION_ZOOM_MAX_LOOK_AHEAD, DEFAULT_NAVIGATION_ZOOM_MAX_LOOK_AHEAD);
export const navigationZoomMin = settingsStore(SETTINGS_NAVIGATION_ZOOM_MIN, DEFAULT_NAVIGATION_ZOOM_MIN);
export const navigationZoomMax = settingsStore(SETTINGS_NAVIGATION_ZOOM_MAX, DEFAULT_NAVIGATION_ZOOM_MAX);
export const navigationBackgroundUpdateInterval = settingsStore(SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL, DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL);
export const navigationManeuverWakeDistance = settingsStore(SETTINGS_NAVIGATION_MANEUVER_WAKE_DISTANCE, DEFAULT_NAVIGATION_MANEUVER_WAKE_DISTANCE);
export const navigationSpeedDropWake = settingsStore(SETTINGS_NAVIGATION_SPEED_DROP_WAKE, DEFAULT_NAVIGATION_SPEED_DROP_WAKE);
export const navigationSpeedDropWakeRatio = settingsStore(SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO, DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO);
export const navigationAutoPause = settingsStore(SETTINGS_NAVIGATION_AUTO_PAUSE, DEFAULT_NAVIGATION_AUTO_PAUSE);
export const navigationAutoPauseSpeed = settingsStore(SETTINGS_NAVIGATION_AUTO_PAUSE_SPEED, DEFAULT_NAVIGATION_AUTO_PAUSE_SPEED);
export const navigationAutoPauseDelay = settingsStore(SETTINGS_NAVIGATION_AUTO_PAUSE_DELAY, DEFAULT_NAVIGATION_AUTO_PAUSE_DELAY);
export const navigationRecordStats = settingsStore(SETTINGS_NAVIGATION_RECORD_STATS, DEFAULT_NAVIGATION_RECORD_STATS);
export const navigationRecordTrack = settingsStore(SETTINGS_NAVIGATION_RECORD_TRACK, DEFAULT_NAVIGATION_RECORD_TRACK);
export const navigationHideSearch = settingsStore(SETTINGS_NAVIGATION_HIDE_SEARCH, DEFAULT_NAVIGATION_HIDE_SEARCH);

export interface NavigationParam {
    key: string;
    store: SettingsStore<any>;
    type: 'boolean' | 'number';
    default: any;
    /** lazy so the label follows a language change */
    title: () => string;
    description?: () => string;
    min?: number;
    max?: number;
    step?: number;
    formatter?: (value: number) => string;
    /** also offered in the compact popover shown during navigation */
    quick?: boolean;
}

const formatSeconds = (value: number) => convertDurationSeconds(value);
const formatMilliseconds = (value: number) => convertDurationSeconds(value / 1000);
const formatPercent = (value: number) => Math.round(value * 100) + '%';
const formatSpeed = (value: number) => value.toFixed(1) + ' m/s';

/**
 * Single source of truth for the navigation parameters: both the settings screen and the popover
 * shown during navigation are generated from this, so they cannot drift apart.
 */
export const NAVIGATION_PARAMS: NavigationParam[] = [
    {
        key: SETTINGS_NAVIGATION_AUTO_ZOOM,
        store: navigationAutoZoom,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_AUTO_ZOOM,
        title: () => lc('navigation_auto_zoom'),
        description: () => lc('navigation_auto_zoom_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_ZOOM_LOOK_AHEAD,
        store: navigationZoomLookAhead,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_LOOK_AHEAD,
        title: () => lc('navigation_zoom_look_ahead'),
        description: () => lc('navigation_zoom_look_ahead_desc'),
        min: 5,
        max: 120,
        step: 5,
        formatter: formatSeconds,
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE,
        store: navigationZoomDenseManeuverDistance,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE,
        title: () => lc('navigation_zoom_dense_maneuver_distance'),
        description: () => lc('navigation_zoom_dense_maneuver_distance_desc'),
        min: 50,
        max: 1000,
        step: 50,
        formatter: formatDistance
    },
    {
        key: SETTINGS_NAVIGATION_ZOOM_MIN_LOOK_AHEAD,
        store: navigationZoomMinLookAhead,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_MIN_LOOK_AHEAD,
        title: () => lc('navigation_zoom_min_look_ahead'),
        min: 30,
        max: 500,
        step: 10,
        formatter: formatDistance
    },
    {
        key: SETTINGS_NAVIGATION_ZOOM_MAX_LOOK_AHEAD,
        store: navigationZoomMaxLookAhead,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_MAX_LOOK_AHEAD,
        title: () => lc('navigation_zoom_max_look_ahead'),
        min: 500,
        max: 10000,
        step: 500,
        formatter: formatDistance
    },
    {
        key: SETTINGS_NAVIGATION_ZOOM_MIN,
        store: navigationZoomMin,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_MIN,
        title: () => lc('navigation_zoom_min'),
        min: 8,
        max: 18,
        step: 1
    },
    {
        key: SETTINGS_NAVIGATION_ZOOM_MAX,
        store: navigationZoomMax,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_MAX,
        title: () => lc('navigation_zoom_max'),
        min: 10,
        max: 21,
        step: 1
    },
    {
        key: SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
        store: navigationBackgroundUpdateInterval,
        type: 'number',
        default: DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
        title: () => lc('navigation_background_update_interval'),
        description: () => lc('navigation_background_update_interval_desc'),
        min: 0,
        max: 30000,
        step: 500,
        formatter: formatMilliseconds,
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_MANEUVER_WAKE_DISTANCE,
        store: navigationManeuverWakeDistance,
        type: 'number',
        default: DEFAULT_NAVIGATION_MANEUVER_WAKE_DISTANCE,
        title: () => lc('navigation_maneuver_wake_distance'),
        description: () => lc('navigation_maneuver_wake_distance_desc'),
        min: 50,
        max: 1000,
        step: 25,
        formatter: formatDistance,
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_SPEED_DROP_WAKE,
        store: navigationSpeedDropWake,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_SPEED_DROP_WAKE,
        title: () => lc('navigation_speed_drop_wake'),
        description: () => lc('navigation_speed_drop_wake_desc')
    },
    {
        key: SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO,
        store: navigationSpeedDropWakeRatio,
        type: 'number',
        default: DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO,
        title: () => lc('navigation_speed_drop_wake_ratio'),
        min: 0.1,
        max: 0.9,
        step: 0.05,
        formatter: formatPercent
    },
    {
        key: SETTINGS_NAVIGATION_AUTO_PAUSE,
        store: navigationAutoPause,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_AUTO_PAUSE,
        title: () => lc('navigation_auto_pause'),
        description: () => lc('navigation_auto_pause_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_AUTO_PAUSE_SPEED,
        store: navigationAutoPauseSpeed,
        type: 'number',
        default: DEFAULT_NAVIGATION_AUTO_PAUSE_SPEED,
        title: () => lc('navigation_auto_pause_speed'),
        min: 0.1,
        max: 5,
        step: 0.1,
        formatter: formatSpeed
    },
    {
        key: SETTINGS_NAVIGATION_AUTO_PAUSE_DELAY,
        store: navigationAutoPauseDelay,
        type: 'number',
        default: DEFAULT_NAVIGATION_AUTO_PAUSE_DELAY,
        title: () => lc('navigation_auto_pause_delay'),
        min: 10,
        max: 600,
        step: 10,
        formatter: formatSeconds
    },
    {
        key: SETTINGS_NAVIGATION_RECORD_STATS,
        store: navigationRecordStats,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_RECORD_STATS,
        title: () => lc('navigation_record_stats'),
        description: () => lc('navigation_record_stats_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_RECORD_TRACK,
        store: navigationRecordTrack,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_RECORD_TRACK,
        title: () => lc('navigation_record_track'),
        description: () => lc('navigation_record_track_desc')
    },
    {
        key: SETTINGS_NAVIGATION_HIDE_SEARCH,
        store: navigationHideSearch,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_HIDE_SEARCH,
        title: () => lc('navigation_hide_search'),
        description: () => lc('navigation_hide_search_desc'),
        quick: true
    }
];

/** Entries for the settings screen (see the `navigation` case in Settings.svelte). */
export function getNavigationSettingsOptions() {
    return NAVIGATION_PARAMS.map((param) =>
        param.type === 'boolean'
            ? {
                  type: 'switch',
                  key: param.key,
                  mapStore: param.store,
                  value: getStoreValue(param),
                  title: param.title(),
                  description: param.description?.()
              }
            : {
                  id: 'setting',
                  type: 'slider',
                  key: param.key,
                  mapStore: param.store,
                  title: param.title(),
                  description: param.description?.(),
                  min: param.min,
                  max: param.max,
                  step: param.step,
                  default: param.default,
                  currentValue: () => getStoreValue(param),
                  rightValue: () => formatParamValue(param)
              }
    );
}

/** Entries for the compact popover shown during navigation. */
export function getNavigationQuickSettings() {
    return NAVIGATION_PARAMS.filter((param) => param.quick).map((param) =>
        param.type === 'boolean'
            ? {
                  type: 'switch',
                  key: param.key,
                  store: param.store,
                  value: getStoreValue(param),
                  title: param.title(),
                  subtitle: param.description?.()
              }
            : {
                  key: param.key,
                  store: param.store,
                  title: param.title(),
                  subtitle: param.description?.(),
                  min: param.min,
                  max: param.max,
                  step: param.step,
                  value: getStoreValue(param),
                  defaultValue: param.default,
                  onChange: (value) => param.store.set(value),
                  valueFormatter: () => formatParamValue(param)
              }
    );
}

function getStoreValue(param: NavigationParam) {
    return get(param.store);
}

function formatParamValue(param: NavigationParam) {
    const value = getStoreValue(param);
    return param.formatter ? param.formatter(value) : value + '';
}
