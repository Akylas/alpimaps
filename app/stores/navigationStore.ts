import { derived, get, writable } from 'svelte/store';
import type { GeoLocation } from '~/handlers/GeoHandler';
import { UNITS, formatDistance, formatDuration, formatValue } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { IItem } from '~/models/Item';
import { SettingsStore, settingsStore } from '~/stores/settingsStore';
import {
    DEFAULT_NAVIGATION_ARROW_MARKER,
    DEFAULT_NAVIGATION_AUTO_PAUSE,
    DEFAULT_NAVIGATION_AUTO_PAUSE_DELAY,
    DEFAULT_NAVIGATION_AUTO_PAUSE_SPEED,
    DEFAULT_NAVIGATION_AUTO_ZOOM,
    DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
    DEFAULT_NAVIGATION_BEARING_REFRESH_ANGLE,
    DEFAULT_NAVIGATION_CHART_CURRENT_ASCENT,
    DEFAULT_NAVIGATION_GPS_UPDATE_DISTANCE,
    DEFAULT_NAVIGATION_GRADE_LOOK_AHEAD,
    DEFAULT_NAVIGATION_HIDE_CHROME,
    DEFAULT_NAVIGATION_MANEUVER_WAKE_DISTANCE,
    DEFAULT_NAVIGATION_RECORD_STATS,
    DEFAULT_NAVIGATION_RECORD_TRACK,
    DEFAULT_NAVIGATION_SCREEN_REFRESH_INTERVAL,
    DEFAULT_NAVIGATION_SHOW_ELEVATION_CHART,
    DEFAULT_NAVIGATION_SHOW_SURFACE,
    DEFAULT_NAVIGATION_SPEED_DROP_WAKE,
    DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO,
    DEFAULT_NAVIGATION_SURFACE_SPAN,
    DEFAULT_NAVIGATION_TURN_REFRESH_ANGLE,
    DEFAULT_NAVIGATION_TURN_REFRESH_DELAY,
    DEFAULT_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE,
    DEFAULT_NAVIGATION_ZOOM_LOOK_AHEAD,
    DEFAULT_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE,
    DEFAULT_NAVIGATION_ZOOM_MAX,
    DEFAULT_NAVIGATION_ZOOM_MAX_LOOK_AHEAD,
    DEFAULT_NAVIGATION_ZOOM_MIN,
    DEFAULT_NAVIGATION_ZOOM_MIN_LOOK_AHEAD,
    SETTINGS_NAVIGATION_ARROW_MARKER,
    SETTINGS_NAVIGATION_AUTO_PAUSE,
    SETTINGS_NAVIGATION_AUTO_PAUSE_DELAY,
    SETTINGS_NAVIGATION_AUTO_PAUSE_SPEED,
    SETTINGS_NAVIGATION_AUTO_ZOOM,
    SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
    SETTINGS_NAVIGATION_BEARING_REFRESH_ANGLE,
    SETTINGS_NAVIGATION_CHART_CURRENT_ASCENT,
    SETTINGS_NAVIGATION_GPS_UPDATE_DISTANCE,
    SETTINGS_NAVIGATION_GRADE_LOOK_AHEAD,
    SETTINGS_NAVIGATION_HIDE_CHROME,
    SETTINGS_NAVIGATION_MANEUVER_WAKE_DISTANCE,
    SETTINGS_NAVIGATION_RECORD_STATS,
    SETTINGS_NAVIGATION_RECORD_TRACK,
    SETTINGS_NAVIGATION_SCREEN_REFRESH_INTERVAL,
    SETTINGS_NAVIGATION_SHOW_ELEVATION_CHART,
    SETTINGS_NAVIGATION_SHOW_SURFACE,
    SETTINGS_NAVIGATION_SPEED_DROP_WAKE,
    SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO,
    SETTINGS_NAVIGATION_SURFACE_SPAN,
    SETTINGS_NAVIGATION_TURN_REFRESH_ANGLE,
    SETTINGS_NAVIGATION_TURN_REFRESH_DELAY,
    SETTINGS_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE,
    SETTINGS_NAVIGATION_ZOOM_LOOK_AHEAD,
    SETTINGS_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE,
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
/** last fix received while navigating, for the live speed and elevation readouts */
export const navigationLocation = writable<GeoLocation>(null);
/** null unless navigation_record_stats is on */
export const navigationStats = writable<NavigationStats>(null);

export const isNavigating = derived(navigationState, (state) => state !== NavigationState.IDLE);
export const isNavigationRunning = derived(navigationState, (state) => state === NavigationState.RUNNING);

export const navigationAutoZoom = settingsStore(SETTINGS_NAVIGATION_AUTO_ZOOM, DEFAULT_NAVIGATION_AUTO_ZOOM);
export const navigationArrowMarker = settingsStore(SETTINGS_NAVIGATION_ARROW_MARKER, DEFAULT_NAVIGATION_ARROW_MARKER);
export const navigationZoomLookAhead = settingsStore(SETTINGS_NAVIGATION_ZOOM_LOOK_AHEAD, DEFAULT_NAVIGATION_ZOOM_LOOK_AHEAD);
export const navigationZoomDenseManeuverDistance = settingsStore(SETTINGS_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE, DEFAULT_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE);
export const navigationZoomManeuverVisibleDistance = settingsStore(SETTINGS_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE, DEFAULT_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE);
export const navigationZoomMinLookAhead = settingsStore(SETTINGS_NAVIGATION_ZOOM_MIN_LOOK_AHEAD, DEFAULT_NAVIGATION_ZOOM_MIN_LOOK_AHEAD);
export const navigationZoomMaxLookAhead = settingsStore(SETTINGS_NAVIGATION_ZOOM_MAX_LOOK_AHEAD, DEFAULT_NAVIGATION_ZOOM_MAX_LOOK_AHEAD);
export const navigationZoomMin = settingsStore(SETTINGS_NAVIGATION_ZOOM_MIN, DEFAULT_NAVIGATION_ZOOM_MIN);
export const navigationZoomMax = settingsStore(SETTINGS_NAVIGATION_ZOOM_MAX, DEFAULT_NAVIGATION_ZOOM_MAX);
export const navigationBackgroundUpdateInterval = settingsStore(SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL, DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL);
export const navigationGpsUpdateDistance = settingsStore(SETTINGS_NAVIGATION_GPS_UPDATE_DISTANCE, DEFAULT_NAVIGATION_GPS_UPDATE_DISTANCE);
export const navigationManeuverWakeDistance = settingsStore(SETTINGS_NAVIGATION_MANEUVER_WAKE_DISTANCE, DEFAULT_NAVIGATION_MANEUVER_WAKE_DISTANCE);
export const navigationScreenRefreshInterval = settingsStore(SETTINGS_NAVIGATION_SCREEN_REFRESH_INTERVAL, DEFAULT_NAVIGATION_SCREEN_REFRESH_INTERVAL);
export const navigationTurnRefreshAngle = settingsStore(SETTINGS_NAVIGATION_TURN_REFRESH_ANGLE, DEFAULT_NAVIGATION_TURN_REFRESH_ANGLE);
export const navigationTurnRefreshDelay = settingsStore(SETTINGS_NAVIGATION_TURN_REFRESH_DELAY, DEFAULT_NAVIGATION_TURN_REFRESH_DELAY);
export const navigationBearingRefreshAngle = settingsStore(SETTINGS_NAVIGATION_BEARING_REFRESH_ANGLE, DEFAULT_NAVIGATION_BEARING_REFRESH_ANGLE);
export const navigationSpeedDropWake = settingsStore(SETTINGS_NAVIGATION_SPEED_DROP_WAKE, DEFAULT_NAVIGATION_SPEED_DROP_WAKE);
export const navigationSpeedDropWakeRatio = settingsStore(SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO, DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO);
export const navigationAutoPause = settingsStore(SETTINGS_NAVIGATION_AUTO_PAUSE, DEFAULT_NAVIGATION_AUTO_PAUSE);
export const navigationAutoPauseSpeed = settingsStore(SETTINGS_NAVIGATION_AUTO_PAUSE_SPEED, DEFAULT_NAVIGATION_AUTO_PAUSE_SPEED);
export const navigationAutoPauseDelay = settingsStore(SETTINGS_NAVIGATION_AUTO_PAUSE_DELAY, DEFAULT_NAVIGATION_AUTO_PAUSE_DELAY);
export const navigationRecordStats = settingsStore(SETTINGS_NAVIGATION_RECORD_STATS, DEFAULT_NAVIGATION_RECORD_STATS);
export const navigationRecordTrack = settingsStore(SETTINGS_NAVIGATION_RECORD_TRACK, DEFAULT_NAVIGATION_RECORD_TRACK);
export const navigationHideChrome = settingsStore(SETTINGS_NAVIGATION_HIDE_CHROME, DEFAULT_NAVIGATION_HIDE_CHROME);
export const navigationShowElevationChart = settingsStore(SETTINGS_NAVIGATION_SHOW_ELEVATION_CHART, DEFAULT_NAVIGATION_SHOW_ELEVATION_CHART);
export const navigationShowSurface = settingsStore(SETTINGS_NAVIGATION_SHOW_SURFACE, DEFAULT_NAVIGATION_SHOW_SURFACE);
export const navigationSurfaceSpan = settingsStore(SETTINGS_NAVIGATION_SURFACE_SPAN, DEFAULT_NAVIGATION_SURFACE_SPAN);
export const navigationGradeLookAhead = settingsStore(SETTINGS_NAVIGATION_GRADE_LOOK_AHEAD, DEFAULT_NAVIGATION_GRADE_LOOK_AHEAD);
export const navigationChartCurrentAscent = settingsStore(SETTINGS_NAVIGATION_CHART_CURRENT_ASCENT, DEFAULT_NAVIGATION_CHART_CURRENT_ASCENT);

/**
 * Whether the elevation/surface previews have anything to draw. The navigation view gives them a row
 * of their own, and that view and the bottom sheet step have to agree on whether that row exists,
 * else the sheet reserves a row of empty space above the map.
 */
export const navigationHasPreviewWidgets = derived([navigationItem, navigationShowElevationChart, navigationShowSurface], ([item, showChart, showSurface]) => {
    const stats = item?.stats;
    return (showChart && !!item?.profile?.data?.length) || (showSurface && (!!stats?.surfaceSegments?.length || !!stats?.surfaces?.length));
});

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

const formatSeconds = (value: number) => formatDuration(value);
const formatMilliseconds = (value: number) => formatDuration(value / 1000);
const formatPercent = (value: number) => Math.round(value * 100) + '%';
// auto pause speed is stored in m/s but shown in the user's own speed unit
const formatSpeed = (value: number) => formatValue(value * 3.6, UNITS.SpeedKm);

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
        key: SETTINGS_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE,
        store: navigationZoomManeuverVisibleDistance,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE,
        title: () => lc('navigation_zoom_maneuver_visible_distance'),
        description: () => lc('navigation_zoom_maneuver_visible_distance_desc'),
        min: 200,
        max: 10000,
        step: 100,
        formatter: formatDistance,
        quick: true
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
        key: SETTINGS_NAVIGATION_GPS_UPDATE_DISTANCE,
        store: navigationGpsUpdateDistance,
        type: 'number',
        default: DEFAULT_NAVIGATION_GPS_UPDATE_DISTANCE,
        title: () => lc('navigation_gps_update_distance'),
        description: () => lc('navigation_gps_update_distance_desc'),
        min: 0,
        max: 500,
        step: 5,
        formatter: formatDistance,
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_SCREEN_REFRESH_INTERVAL,
        store: navigationScreenRefreshInterval,
        type: 'number',
        default: DEFAULT_NAVIGATION_SCREEN_REFRESH_INTERVAL,
        title: () => lc('navigation_screen_refresh_interval'),
        description: () => lc('navigation_screen_refresh_interval_desc'),
        min: 0,
        max: 900,
        step: 15,
        formatter: formatDuration,
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_TURN_REFRESH_ANGLE,
        store: navigationTurnRefreshAngle,
        type: 'number',
        default: DEFAULT_NAVIGATION_TURN_REFRESH_ANGLE,
        title: () => lc('navigation_turn_refresh_angle'),
        description: () => lc('navigation_turn_refresh_angle_desc'),
        min: 0,
        max: 180,
        step: 5,
        formatter: (value) => value + '°'
    },
    {
        key: SETTINGS_NAVIGATION_TURN_REFRESH_DELAY,
        store: navigationTurnRefreshDelay,
        type: 'number',
        default: DEFAULT_NAVIGATION_TURN_REFRESH_DELAY,
        title: () => lc('navigation_turn_refresh_delay'),
        description: () => lc('navigation_turn_refresh_delay_desc'),
        min: 0,
        max: 15,
        step: 1,
        formatter: formatSeconds
    },
    {
        key: SETTINGS_NAVIGATION_BEARING_REFRESH_ANGLE,
        store: navigationBearingRefreshAngle,
        type: 'number',
        default: DEFAULT_NAVIGATION_BEARING_REFRESH_ANGLE,
        title: () => lc('navigation_bearing_refresh_angle'),
        description: () => lc('navigation_bearing_refresh_angle_desc'),
        min: 0,
        max: 180,
        step: 5,
        formatter: (value) => (value > 0 ? value + '°' : lc('disabled')),
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
        key: SETTINGS_NAVIGATION_SHOW_ELEVATION_CHART,
        store: navigationShowElevationChart,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_SHOW_ELEVATION_CHART,
        title: () => lc('navigation_show_elevation_chart'),
        description: () => lc('navigation_show_elevation_chart_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_CHART_CURRENT_ASCENT,
        store: navigationChartCurrentAscent,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_CHART_CURRENT_ASCENT,
        title: () => lc('navigation_chart_current_ascent'),
        description: () => lc('navigation_chart_current_ascent_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_ARROW_MARKER,
        store: navigationArrowMarker,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_ARROW_MARKER,
        title: () => lc('navigation_arrow_marker'),
        description: () => lc('navigation_arrow_marker_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_SHOW_SURFACE,
        store: navigationShowSurface,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_SHOW_SURFACE,
        title: () => lc('navigation_show_surface'),
        description: () => lc('navigation_show_surface_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_SURFACE_SPAN,
        store: navigationSurfaceSpan,
        type: 'number',
        default: DEFAULT_NAVIGATION_SURFACE_SPAN,
        title: () => lc('navigation_surface_span'),
        description: () => lc('navigation_surface_span_desc'),
        min: 500,
        max: 20000,
        step: 500,
        formatter: formatDistance,
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_HIDE_CHROME,
        store: navigationHideChrome,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_HIDE_CHROME,
        title: () => lc('navigation_hide_chrome'),
        description: () => lc('navigation_hide_chrome_desc'),
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
                  rightValue: () => formatParamValue(param),
                  // without this the slider popover shows the raw number while being dragged
                  valueFormatter: (value: number) => (param.formatter ? param.formatter(value) : value + '')
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
                  // formats the value the slider is being dragged to, which the store does not hold yet
                  valueFormatter: (value: number) => (param.formatter ? param.formatter(value) : value + '')
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
