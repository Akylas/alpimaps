import { derived, get, writable } from 'svelte/store';
import type { GeoLocation } from '~/handlers/GeoHandler';
import { UNITS, formatDistance, formatDuration, formatValue } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { IItem } from '~/models/Item';
import type { NavigationDetour } from '~/services/navigation/NavigationRoute';
import { SettingsStore, settingsStore } from '~/stores/settingsStore';
import {
    DEFAULT_NAVIGATION_ARROW_MARKER,
    DEFAULT_NAVIGATION_AUTO_PAUSE,
    DEFAULT_NAVIGATION_AUTO_PAUSE_DELAY,
    DEFAULT_NAVIGATION_AUTO_PAUSE_SPEED,
    DEFAULT_NAVIGATION_AUTO_REROUTE,
    DEFAULT_NAVIGATION_AUTO_REROUTE_MAX_DISTANCE,
    DEFAULT_NAVIGATION_AUTO_ZOOM,
    DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
    DEFAULT_NAVIGATION_BEARING_REFRESH_ANGLE,
    DEFAULT_NAVIGATION_CHART_CURRENT_ASCENT,
    DEFAULT_NAVIGATION_GPS_UPDATE_DISTANCE,
    DEFAULT_NAVIGATION_GRADE_LOOK_AHEAD,
    DEFAULT_NAVIGATION_HIDE_CHROME,
    DEFAULT_NAVIGATION_MANEUVER_REFRESH_DISTANCE,
    DEFAULT_NAVIGATION_MANEUVER_WAKE_DISTANCE,
    DEFAULT_NAVIGATION_OFF_ROUTE_DISTANCE,
    DEFAULT_NAVIGATION_OFF_ROUTE_FIXES,
    DEFAULT_NAVIGATION_POSITION_OFFSET,
    DEFAULT_NAVIGATION_RECORD_STATS,
    DEFAULT_NAVIGATION_RECORD_TRACK,
    DEFAULT_NAVIGATION_SCREEN_REFRESH_INTERVAL,
    DEFAULT_NAVIGATION_SHOW_ELEVATION_CHART,
    DEFAULT_NAVIGATION_SHOW_SURFACE,
    DEFAULT_NAVIGATION_SPEED_DROP_WAKE,
    DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO,
    DEFAULT_NAVIGATION_SURFACE_SPAN,
    DEFAULT_NAVIGATION_TILT,
    DEFAULT_NAVIGATION_TURN_REFRESH_ANGLE,
    DEFAULT_NAVIGATION_TURN_REFRESH_DELAY,
    DEFAULT_NAVIGATION_UI_SCALE,
    DEFAULT_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE,
    DEFAULT_NAVIGATION_ZOOM_FACTOR,
    DEFAULT_NAVIGATION_ZOOM_LOOK_AHEAD,
    DEFAULT_NAVIGATION_ZOOM_MANEUVER_FRAME_RATIO,
    DEFAULT_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE,
    DEFAULT_NAVIGATION_ZOOM_MAX,
    DEFAULT_NAVIGATION_ZOOM_MAX_LOOK_AHEAD,
    DEFAULT_NAVIGATION_ZOOM_MIN,
    DEFAULT_NAVIGATION_ZOOM_MIN_LOOK_AHEAD,
    SETTINGS_NAVIGATION_ARROW_MARKER,
    SETTINGS_NAVIGATION_AUTO_PAUSE,
    SETTINGS_NAVIGATION_AUTO_PAUSE_DELAY,
    SETTINGS_NAVIGATION_AUTO_PAUSE_SPEED,
    SETTINGS_NAVIGATION_AUTO_REROUTE,
    SETTINGS_NAVIGATION_AUTO_REROUTE_MAX_DISTANCE,
    SETTINGS_NAVIGATION_AUTO_ZOOM,
    SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
    SETTINGS_NAVIGATION_BEARING_REFRESH_ANGLE,
    SETTINGS_NAVIGATION_CHART_CURRENT_ASCENT,
    SETTINGS_NAVIGATION_GPS_UPDATE_DISTANCE,
    SETTINGS_NAVIGATION_GRADE_LOOK_AHEAD,
    SETTINGS_NAVIGATION_HIDE_CHROME,
    SETTINGS_NAVIGATION_MANEUVER_REFRESH_DISTANCE,
    SETTINGS_NAVIGATION_MANEUVER_WAKE_DISTANCE,
    SETTINGS_NAVIGATION_OFF_ROUTE_DISTANCE,
    SETTINGS_NAVIGATION_OFF_ROUTE_FIXES,
    SETTINGS_NAVIGATION_POSITION_OFFSET,
    SETTINGS_NAVIGATION_RECORD_STATS,
    SETTINGS_NAVIGATION_RECORD_TRACK,
    SETTINGS_NAVIGATION_SCREEN_REFRESH_INTERVAL,
    SETTINGS_NAVIGATION_SHOW_ELEVATION_CHART,
    SETTINGS_NAVIGATION_SHOW_SURFACE,
    SETTINGS_NAVIGATION_SPEED_DROP_WAKE,
    SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO,
    SETTINGS_NAVIGATION_SURFACE_SPAN,
    SETTINGS_NAVIGATION_TILT,
    SETTINGS_NAVIGATION_TURN_REFRESH_ANGLE,
    SETTINGS_NAVIGATION_TURN_REFRESH_DELAY,
    SETTINGS_NAVIGATION_UI_SCALE,
    SETTINGS_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE,
    SETTINGS_NAVIGATION_ZOOM_FACTOR,
    SETTINGS_NAVIGATION_ZOOM_LOOK_AHEAD,
    SETTINGS_NAVIGATION_ZOOM_MANEUVER_FRAME_RATIO,
    SETTINGS_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE,
    SETTINGS_NAVIGATION_ZOOM_MAX,
    SETTINGS_NAVIGATION_ZOOM_MAX_LOOK_AHEAD,
    SETTINGS_NAVIGATION_ZOOM_MIN,
    SETTINGS_NAVIGATION_ZOOM_MIN_LOOK_AHEAD
} from '~/utils/constants';
import type { RejoinTarget, RouteProgress } from '~/utils/navigation';
import { fontScaleMaxed } from '~/variables';

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
/** the leg taking the user back to `navigationItem`, null unless a reroute is under way */
export const navigationDetour = writable<NavigationDetour>(null);
/** the user's own route, kept only when a full reroute replaced what is being navigated */
export const navigationOriginalItem = writable<IItem>(null);
/** where an off-route user is being pointed back to, null while on route */
export const navigationRejoinTarget = writable<RejoinTarget>(null);
/** a reroute is being computed, so the ui can say so rather than looking stuck */
export const navigationRerouting = writable(false);
/** where the user is along `navigationItem`, null when idle */
export const navigationProgress = writable<RouteProgress>(null);
/** last fix received while navigating, for the live speed and elevation readouts */
export const navigationLocation = writable<GeoLocation>(null);
/** null unless navigation_record_stats is on */
export const navigationStats = writable<NavigationStats>(null);

/** confirmed away from the route: a suspicion the detector has not confirmed does not show here */
export const navigationOffRoute = derived(navigationProgress, (progress) => !!progress?.offRoute);

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
export const navigationZoomFactor = settingsStore(SETTINGS_NAVIGATION_ZOOM_FACTOR, DEFAULT_NAVIGATION_ZOOM_FACTOR);
export const navigationZoomManeuverFrameRatio = settingsStore(SETTINGS_NAVIGATION_ZOOM_MANEUVER_FRAME_RATIO, DEFAULT_NAVIGATION_ZOOM_MANEUVER_FRAME_RATIO);
export const navigationUiScale = settingsStore(SETTINGS_NAVIGATION_UI_SCALE, DEFAULT_NAVIGATION_UI_SCALE);
export const navigationBackgroundUpdateInterval = settingsStore(SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL, DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL);
export const navigationGpsUpdateDistance = settingsStore(SETTINGS_NAVIGATION_GPS_UPDATE_DISTANCE, DEFAULT_NAVIGATION_GPS_UPDATE_DISTANCE);
export const navigationManeuverWakeDistance = settingsStore(SETTINGS_NAVIGATION_MANEUVER_WAKE_DISTANCE, DEFAULT_NAVIGATION_MANEUVER_WAKE_DISTANCE);
export const navigationScreenRefreshInterval = settingsStore(SETTINGS_NAVIGATION_SCREEN_REFRESH_INTERVAL, DEFAULT_NAVIGATION_SCREEN_REFRESH_INTERVAL);
export const navigationTurnRefreshAngle = settingsStore(SETTINGS_NAVIGATION_TURN_REFRESH_ANGLE, DEFAULT_NAVIGATION_TURN_REFRESH_ANGLE);
export const navigationManeuverRefreshDistance = settingsStore(SETTINGS_NAVIGATION_MANEUVER_REFRESH_DISTANCE, DEFAULT_NAVIGATION_MANEUVER_REFRESH_DISTANCE);
export const navigationTurnRefreshDelay = settingsStore(SETTINGS_NAVIGATION_TURN_REFRESH_DELAY, DEFAULT_NAVIGATION_TURN_REFRESH_DELAY);
export const navigationBearingRefreshAngle = settingsStore(SETTINGS_NAVIGATION_BEARING_REFRESH_ANGLE, DEFAULT_NAVIGATION_BEARING_REFRESH_ANGLE);
export const navigationSpeedDropWake = settingsStore(SETTINGS_NAVIGATION_SPEED_DROP_WAKE, DEFAULT_NAVIGATION_SPEED_DROP_WAKE);
export const navigationSpeedDropWakeRatio = settingsStore(SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO, DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO);
export const navigationOffRouteDistance = settingsStore(SETTINGS_NAVIGATION_OFF_ROUTE_DISTANCE, DEFAULT_NAVIGATION_OFF_ROUTE_DISTANCE);
export const navigationOffRouteFixes = settingsStore(SETTINGS_NAVIGATION_OFF_ROUTE_FIXES, DEFAULT_NAVIGATION_OFF_ROUTE_FIXES);
export const navigationAutoReroute = settingsStore(SETTINGS_NAVIGATION_AUTO_REROUTE, DEFAULT_NAVIGATION_AUTO_REROUTE);
export const navigationAutoRerouteMaxDistance = settingsStore(SETTINGS_NAVIGATION_AUTO_REROUTE_MAX_DISTANCE, DEFAULT_NAVIGATION_AUTO_REROUTE_MAX_DISTANCE);
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
export const navigationTilt = settingsStore(SETTINGS_NAVIGATION_TILT, DEFAULT_NAVIGATION_TILT);
export const navigationPositionOffset = settingsStore(SETTINGS_NAVIGATION_POSITION_OFFSET, DEFAULT_NAVIGATION_POSITION_OFFSET);

/**
 * What every navigation widget, button and sheet step is sized with: the system font scale the rest of
 * the app already follows, times the user's own navigation scale. One store rather than each component
 * multiplying two of them, so the bar rows and the sheet steps cannot end up disagreeing.
 */
export const navigationScale = derived([fontScaleMaxed, navigationUiScale], ([fontScale, uiScale]) => fontScale * (uiScale > 0 ? uiScale : 1));

/**
 * Whether the elevation/surface previews have anything to draw. The navigation view gives them a row
 * of their own, and that view and the bottom sheet step have to agree on whether that row exists,
 * else the sheet reserves a row of empty space above the map.
 */
export const navigationHasPreviewWidgets = derived([navigationItem, navigationShowElevationChart, navigationShowSurface], ([item, showChart, showSurface]) => {
    const stats = item?.stats;
    return (showChart && !!item?.profile?.data?.length) || (showSurface && (!!stats?.surfaceSegments?.length || !!stats?.surfaces?.length));
});

/** the settings screen groups the parameters under these, in this order */
export enum NavigationSection {
    Camera = 'camera',
    Display = 'display',
    Gps = 'gps',
    OffRoute = 'off_route',
    Recording = 'recording'
}

/** lazy so the headers follow a language change */
const NAVIGATION_SECTION_TITLES: Record<NavigationSection, () => string> = {
    [NavigationSection.Camera]: () => lc('navigation_section_camera'),
    [NavigationSection.Display]: () => lc('navigation_section_display'),
    [NavigationSection.Gps]: () => lc('navigation_section_gps'),
    [NavigationSection.OffRoute]: () => lc('navigation_section_off_route'),
    [NavigationSection.Recording]: () => lc('navigation_section_recording')
};

export interface NavigationParam {
    key: string;
    store: SettingsStore<any>;
    type: 'boolean' | 'number';
    default: any;
    section: NavigationSection;
    /** lazy so the label follows a language change */
    title: () => string;
    description?: () => string;
    min?: number;
    max?: number;
    step?: number;
    formatter?: (value: number) => string;
    /** also offered in the compact popover shown during navigation */
    quick?: boolean;
    /** a tuning knob for testing on the road, kept out of release builds rather than shipped to users */
    dev?: boolean;
}

const formatSeconds = (value: number) => formatDuration(value);
const formatMilliseconds = (value: number) => formatDuration(value / 1000);
const formatPercent = (value: number) => Math.round(value * 100) + '%';
const formatFactor = (value: number) => '×' + value.toFixed(2);
const formatAngle = (value: number) => value + '°';
// auto pause speed is stored in m/s but shown in the user's own speed unit
const formatSpeed = (value: number) => formatValue(value * 3.6, UNITS.SpeedKm);

/**
 * Single source of truth for the navigation parameters: both the settings screen and the popover
 * shown during navigation are generated from this, so they cannot drift apart.
 */
export const NAVIGATION_PARAMS: NavigationParam[] = [
    {
        key: SETTINGS_NAVIGATION_AUTO_ZOOM,
        section: NavigationSection.Camera,
        store: navigationAutoZoom,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_AUTO_ZOOM,
        title: () => lc('navigation_auto_zoom'),
        description: () => lc('navigation_auto_zoom_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_ZOOM_LOOK_AHEAD,
        section: NavigationSection.Camera,
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
        section: NavigationSection.Camera,
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
        section: NavigationSection.Camera,
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
        section: NavigationSection.Camera,
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
        section: NavigationSection.Camera,
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
        section: NavigationSection.Camera,
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
        section: NavigationSection.Camera,
        store: navigationZoomMax,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_MAX,
        title: () => lc('navigation_zoom_max'),
        min: 10,
        max: 21,
        step: 1
    },
    {
        key: SETTINGS_NAVIGATION_ZOOM_FACTOR,
        section: NavigationSection.Camera,
        store: navigationZoomFactor,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_FACTOR,
        title: () => lc('navigation_zoom_factor'),
        description: () => lc('navigation_zoom_factor_desc'),
        min: 0.5,
        max: 2,
        // step: 0.05,
        formatter: formatFactor,
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_ZOOM_MANEUVER_FRAME_RATIO,
        section: NavigationSection.Camera,
        store: navigationZoomManeuverFrameRatio,
        type: 'number',
        default: DEFAULT_NAVIGATION_ZOOM_MANEUVER_FRAME_RATIO,
        title: () => lc('navigation_zoom_maneuver_frame_ratio'),
        min: 1,
        max: 4,
        // step: 0.1,
        formatter: formatFactor,
        quick: true,
        dev: true
    },
    {
        key: SETTINGS_NAVIGATION_TILT,
        section: NavigationSection.Camera,
        store: navigationTilt,
        type: 'number',
        default: DEFAULT_NAVIGATION_TILT,
        // the older key reads as a sentence, which belongs in the description now that rows have both
        title: () => lc('navigation_map_tilt'),
        description: () => lc('navigation_tilt'),
        min: 0,
        max: 90,
        step: 1,
        formatter: formatAngle
    },
    {
        key: SETTINGS_NAVIGATION_POSITION_OFFSET,
        section: NavigationSection.Camera,
        store: navigationPositionOffset,
        type: 'number',
        default: DEFAULT_NAVIGATION_POSITION_OFFSET,
        title: () => lc('navigation_vertical_offset'),
        description: () => lc('navigation_position_offset'),
        min: 0,
        max: 0.5,
        step: 0.01,
        formatter: formatPercent
    },
    {
        key: SETTINGS_NAVIGATION_UI_SCALE,
        section: NavigationSection.Display,
        store: navigationUiScale,
        type: 'number',
        default: DEFAULT_NAVIGATION_UI_SCALE,
        title: () => lc('navigation_ui_scale'),
        description: () => lc('navigation_ui_scale_desc'),
        min: 0.8,
        max: 1.8,
        // step: 0.05,
        formatter: formatFactor,
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
        section: NavigationSection.Gps,
        store: navigationBackgroundUpdateInterval,
        type: 'number',
        default: DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL,
        title: () => lc('navigation_background_update_interval'),
        description: () => lc('navigation_background_update_interval_desc'),
        min: 0,
        max: 300000,
        step: 1000,
        formatter: (ms) => formatDuration(ms / 1000),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_GPS_UPDATE_DISTANCE,
        section: NavigationSection.Gps,
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
        section: NavigationSection.Gps,
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
        section: NavigationSection.Gps,
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
        key: SETTINGS_NAVIGATION_MANEUVER_REFRESH_DISTANCE,
        section: NavigationSection.Gps,
        store: navigationManeuverRefreshDistance,
        type: 'number',
        default: DEFAULT_NAVIGATION_MANEUVER_REFRESH_DISTANCE,
        title: () => lc('navigation_maneuver_refresh_distance'),
        description: () => lc('navigation_maneuver_refresh_distance_desc'),
        min: 0,
        max: 200,
        step: 5,
        formatter: formatDistance
    },
    {
        key: SETTINGS_NAVIGATION_TURN_REFRESH_DELAY,
        section: NavigationSection.Gps,
        store: navigationTurnRefreshDelay,
        type: 'number',
        default: DEFAULT_NAVIGATION_TURN_REFRESH_DELAY,
        title: () => lc('navigation_turn_refresh_delay'),
        description: () => lc('navigation_turn_refresh_delay_desc'),
        min: 0,
        max: 60,
        step: 1,
        formatter: formatSeconds
    },
    {
        key: SETTINGS_NAVIGATION_BEARING_REFRESH_ANGLE,
        section: NavigationSection.Gps,
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
        section: NavigationSection.Gps,
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
        section: NavigationSection.Gps,
        store: navigationSpeedDropWake,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_SPEED_DROP_WAKE,
        title: () => lc('navigation_speed_drop_wake'),
        description: () => lc('navigation_speed_drop_wake_desc')
    },
    {
        key: SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO,
        section: NavigationSection.Gps,
        store: navigationSpeedDropWakeRatio,
        type: 'number',
        default: DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO,
        title: () => lc('navigation_speed_drop_wake_ratio'),
        min: 0.1,
        max: 0.9,
        // step: 0.05,
        formatter: formatPercent
    },
    {
        key: SETTINGS_NAVIGATION_OFF_ROUTE_DISTANCE,
        section: NavigationSection.OffRoute,
        store: navigationOffRouteDistance,
        type: 'number',
        default: DEFAULT_NAVIGATION_OFF_ROUTE_DISTANCE,
        title: () => lc('navigation_off_route_distance'),
        description: () => lc('navigation_off_route_distance_desc'),
        min: 10,
        max: 200,
        step: 5,
        formatter: formatDistance,
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_AUTO_REROUTE,
        section: NavigationSection.OffRoute,
        store: navigationAutoReroute,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_AUTO_REROUTE,
        title: () => lc('navigation_auto_reroute'),
        description: () => lc('navigation_auto_reroute_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_AUTO_REROUTE_MAX_DISTANCE,
        section: NavigationSection.OffRoute,
        store: navigationAutoRerouteMaxDistance,
        type: 'number',
        default: DEFAULT_NAVIGATION_AUTO_REROUTE_MAX_DISTANCE,
        title: () => lc('navigation_auto_reroute_max_distance'),
        description: () => lc('navigation_auto_reroute_max_distance_desc'),
        min: 100,
        max: 5000,
        step: 100,
        formatter: formatDistance
    },
    {
        key: SETTINGS_NAVIGATION_OFF_ROUTE_FIXES,
        section: NavigationSection.OffRoute,
        store: navigationOffRouteFixes,
        type: 'number',
        default: DEFAULT_NAVIGATION_OFF_ROUTE_FIXES,
        title: () => lc('navigation_off_route_fixes'),
        description: () => lc('navigation_off_route_fixes_desc'),
        min: 1,
        max: 10,
        step: 1
    },
    {
        key: SETTINGS_NAVIGATION_AUTO_PAUSE,
        section: NavigationSection.Recording,
        store: navigationAutoPause,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_AUTO_PAUSE,
        title: () => lc('navigation_auto_pause'),
        description: () => lc('navigation_auto_pause_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_AUTO_PAUSE_SPEED,
        section: NavigationSection.Recording,
        store: navigationAutoPauseSpeed,
        type: 'number',
        default: DEFAULT_NAVIGATION_AUTO_PAUSE_SPEED,
        title: () => lc('navigation_auto_pause_speed'),
        min: 0.1,
        max: 5,
        // step: 0.1,
        formatter: formatSpeed
    },
    {
        key: SETTINGS_NAVIGATION_AUTO_PAUSE_DELAY,
        section: NavigationSection.Recording,
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
        section: NavigationSection.Recording,
        store: navigationRecordStats,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_RECORD_STATS,
        title: () => lc('navigation_record_stats'),
        description: () => lc('navigation_record_stats_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_RECORD_TRACK,
        section: NavigationSection.Recording,
        store: navigationRecordTrack,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_RECORD_TRACK,
        title: () => lc('navigation_record_track'),
        description: () => lc('navigation_record_track_desc')
    },
    {
        key: SETTINGS_NAVIGATION_SHOW_ELEVATION_CHART,
        section: NavigationSection.Display,
        store: navigationShowElevationChart,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_SHOW_ELEVATION_CHART,
        title: () => lc('navigation_show_elevation_chart'),
        description: () => lc('navigation_show_elevation_chart_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_CHART_CURRENT_ASCENT,
        section: NavigationSection.Display,
        store: navigationChartCurrentAscent,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_CHART_CURRENT_ASCENT,
        title: () => lc('navigation_chart_current_ascent'),
        description: () => lc('navigation_chart_current_ascent_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_GRADE_LOOK_AHEAD,
        section: NavigationSection.Display,
        store: navigationGradeLookAhead,
        type: 'number',
        default: DEFAULT_NAVIGATION_GRADE_LOOK_AHEAD,
        title: () => lc('navigation_grade_look_ahead'),
        description: () => lc('navigation_grade_look_ahead_desc'),
        min: 20,
        max: 1000,
        step: 20,
        formatter: formatDistance
    },
    {
        key: SETTINGS_NAVIGATION_ARROW_MARKER,
        section: NavigationSection.Display,
        store: navigationArrowMarker,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_ARROW_MARKER,
        title: () => lc('navigation_arrow_marker'),
        description: () => lc('navigation_arrow_marker_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_SHOW_SURFACE,
        section: NavigationSection.Display,
        store: navigationShowSurface,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_SHOW_SURFACE,
        title: () => lc('navigation_show_surface'),
        description: () => lc('navigation_show_surface_desc'),
        quick: true
    },
    {
        key: SETTINGS_NAVIGATION_SURFACE_SPAN,
        section: NavigationSection.Display,
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
        section: NavigationSection.Display,
        store: navigationHideChrome,
        type: 'boolean',
        default: DEFAULT_NAVIGATION_HIDE_CHROME,
        title: () => lc('navigation_hide_chrome'),
        description: () => lc('navigation_hide_chrome_desc'),
        quick: true
    }
];

/** Tuning knobs are for testing on the road: `PRODUCTION` is a compile time global, so they drop out. */
function visibleParams() {
    return NAVIGATION_PARAMS.filter((param) => !param.dev || !PRODUCTION);
}

/** Entries for the settings screen (see the `navigation` case in Settings.svelte), grouped by section. */
export function getNavigationSettingsOptions() {
    const params = visibleParams();
    return Object.keys(NAVIGATION_SECTION_TITLES).reduce((options, section: NavigationSection) => {
        const sectionParams = params.filter((param) => param.section === section);
        if (!sectionParams.length) {
            return options;
        }
        options.push({ type: 'sectionheader', title: NAVIGATION_SECTION_TITLES[section]() });
        sectionParams.forEach((param) =>
            options.push(
                param.type === 'boolean'
                    ? {
                          type: 'switch',
                          key: param.key,
                          store: param.store,
                          value: getStoreValue(param),
                          title: param.title(),
                          description: param.description?.()
                      }
                    : {
                          id: 'setting',
                          type: 'slider',
                          key: param.key,
                          store: param.store,
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
            )
        );
        return options;
    }, [] as any[]);
}

/** Entries for the compact popover shown during navigation. */
export function getNavigationQuickSettings() {
    return visibleParams()
        .filter((param) => param.quick)
        .map((param) =>
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
