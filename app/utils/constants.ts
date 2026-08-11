import { Screen } from '@nativescript/core';

export const ALERT_OPTION_MAX_HEIGHT = Screen.mainScreen.heightDIPs * 0.47;

export const SETTINGS_IMPERIAL = 'imperial';
export const SETTINGS_UNITS = 'units';
export const SETTINGS_FONTSCALE = 'fontscale';
export const SETTINGS_LANGUAGE = 'language';
export const SETTINGS_MAP_FONT_SCALE = 'map_font_scale';
export const SETTINGS_COLOR_THEME = 'color_theme';
export const SETTINGS_ENABLE_CRASH_REPORT = 'enable_crash_report';

export const DEFAULT_LOCALE = 'auto';
export const DEFAULT_COLOR_THEME = 'default';

export const MAP_FONT_SCALE = 1;

export const SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN = 'service_limits.pedestrian.max_distance';
export const SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE = 'service_limits.bicycle.max_distance';
export const SETTINGS_VALHALLA_MAX_DISTANCE_AUTO = 'service_limits.auto.max_distance';
export const SETTINGS_VALHALLA_MAX_DISTANCE_TRACE = 'service_limits.trace.max_distance';
export const SETTINGS_TILE_SERVER_AUTO_START = 'tile.server.auto.start';
export const SETTINGS_TILE_SERVER_PORT = 'tile.server.port';
export const SETTINGS_VALHALLA_ONLINE_URL = 'online_valhalla_url';
export const SETTINGS_NAVIGATION_TILT = 'navigation_tilt';
export const SETTINGS_NAVIGATION_POSITION_OFFSET = 'navigation_position_offset';

export const SETTINGS_NAVIGATION_AUTO_ZOOM = 'navigation_auto_zoom';
export const SETTINGS_NAVIGATION_ZOOM_LOOK_AHEAD = 'navigation_zoom_look_ahead';
export const SETTINGS_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE = 'navigation_zoom_dense_maneuver_distance';
export const SETTINGS_NAVIGATION_ZOOM_MIN_LOOK_AHEAD = 'navigation_zoom_min_look_ahead';
export const SETTINGS_NAVIGATION_ZOOM_MAX_LOOK_AHEAD = 'navigation_zoom_max_look_ahead';
export const SETTINGS_NAVIGATION_ZOOM_MIN = 'navigation_zoom_min';
export const SETTINGS_NAVIGATION_ZOOM_MAX = 'navigation_zoom_max';
export const SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL = 'navigation_background_update_interval';
export const SETTINGS_NAVIGATION_MANEUVER_WAKE_DISTANCE = 'navigation_maneuver_wake_distance';
export const SETTINGS_NAVIGATION_SPEED_DROP_WAKE = 'navigation_speed_drop_wake';
export const SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO = 'navigation_speed_drop_wake_ratio';
export const SETTINGS_NAVIGATION_AUTO_PAUSE = 'navigation_auto_pause';
export const SETTINGS_NAVIGATION_AUTO_PAUSE_SPEED = 'navigation_auto_pause_speed';
export const SETTINGS_NAVIGATION_AUTO_PAUSE_DELAY = 'navigation_auto_pause_delay';
export const SETTINGS_NAVIGATION_RECORD_STATS = 'navigation_record_stats';
export const SETTINGS_NAVIGATION_RECORD_TRACK = 'navigation_record_track';
export const SETTINGS_NAVIGATION_HIDE_SEARCH = 'navigation_hide_search';

export const SETTINGS_ELEVATION_PROFILE_SMOOTH_WINDOW = 'elevation_profile_smooth_window';
export const SETTINGS_ELEVATION_PROFILE_FILTER_STEP = 'elevation_profile_filter_step';
export const SETTINGS_SHOW_ELEVATION_PROFILE_ASCENTS = 'show_elevation_profile_ascents';
export const SETTINGS_SHOW_ELEVATION_PROFILE_WAYPOINTS = 'chart_show_waypoints';
export const SETTINGS_SHOW_ELEVATION_PROFILE_GRADE_COLORS = 'show_elevation_profile_grade_colors';
export const SETTINGS_ELEVATION_PROFILE_ASCENTS_MIN_GAIN = 'elevation_profile_ascents_min_gain';
export const SETTINGS_ELEVATION_PROFILE_ASCENTS_DIP_TOLERANCE = 'elevation_profile_ascents_dip_tolerance';

export const DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN = 250000;
export const DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE = 500000;
export const DEFAULT_VALHALLA_MAX_DISTANCE_AUTO = 5000000;
export const DEFAULT_TILE_SERVER_AUTO_START = false;
export const DEFAULT_TILE_SERVER_PORT = 8081;
export const DEFAULT_VALHALLA_ONLINE_URL = 'https://valhalla1.openstreetmap.de';
export const DEFAULT_NAVIGATION_TILT = 45;
export const DEFAULT_NAVIGATION_POSITION_OFFSET = 0.3;

export const DEFAULT_NAVIGATION_AUTO_ZOOM = true;
/** seconds of road ahead the camera should frame at the current speed */
export const DEFAULT_NAVIGATION_ZOOM_LOOK_AHEAD = 30;
/** below this gap two maneuvers count as clustered, and the camera stays close even at speed */
export const DEFAULT_NAVIGATION_ZOOM_DENSE_MANEUVER_DISTANCE = 250;
export const DEFAULT_NAVIGATION_ZOOM_MIN_LOOK_AHEAD = 80;
export const DEFAULT_NAVIGATION_ZOOM_MAX_LOOK_AHEAD = 4000;
export const DEFAULT_NAVIGATION_ZOOM_MIN = 12;
export const DEFAULT_NAVIGATION_ZOOM_MAX = 18;
export const DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL = 2000;
export const DEFAULT_NAVIGATION_MANEUVER_WAKE_DISTANCE = 150;
export const DEFAULT_NAVIGATION_SPEED_DROP_WAKE = true;
export const DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO = 0.5;
export const DEFAULT_NAVIGATION_AUTO_PAUSE = true;
export const DEFAULT_NAVIGATION_AUTO_PAUSE_SPEED = 0.5;
export const DEFAULT_NAVIGATION_AUTO_PAUSE_DELAY = 120;
export const DEFAULT_NAVIGATION_RECORD_STATS = true;
export const DEFAULT_NAVIGATION_RECORD_TRACK = false;
export const DEFAULT_NAVIGATION_HIDE_SEARCH = true;

export const DEFAULT_ELEVATION_PROFILE_SMOOTH_WINDOW = 3;
export const DEFAULT_ELEVATION_PROFILE_FILTER_STEP = 5;
export const DEFAULT_SHOW_ELEVATION_PROFILE_ASCENTS = true;
export const DEFAULT_SHOW_ELEVATION_PROFILE_WAYPOINTS = true;
export const DEFAULT_SHOW_ELEVATION_PROFILE_GRADE_COLORS = true;
export const DEFAULT_ELEVATION_PROFILE_ASCENTS_MIN_GAIN = 100;
export const DEFAULT_ELEVATION_PROFILE_ASCENTS_DIP_TOLERANCE = 80;
