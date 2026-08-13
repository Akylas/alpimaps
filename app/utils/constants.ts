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
export const SETTINGS_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE = 'navigation_zoom_maneuver_visible_distance';
export const SETTINGS_NAVIGATION_ZOOM_MIN_LOOK_AHEAD = 'navigation_zoom_min_look_ahead';
export const SETTINGS_NAVIGATION_ZOOM_MAX_LOOK_AHEAD = 'navigation_zoom_max_look_ahead';
export const SETTINGS_NAVIGATION_ZOOM_MIN = 'navigation_zoom_min';
export const SETTINGS_NAVIGATION_ZOOM_MAX = 'navigation_zoom_max';
export const SETTINGS_NAVIGATION_BACKGROUND_UPDATE_INTERVAL = 'navigation_background_update_interval';
export const SETTINGS_NAVIGATION_GPS_UPDATE_DISTANCE = 'navigation_gps_update_distance';
export const SETTINGS_NAVIGATION_MANEUVER_WAKE_DISTANCE = 'navigation_maneuver_wake_distance';
export const SETTINGS_NAVIGATION_SCREEN_REFRESH_INTERVAL = 'navigation_screen_refresh_interval';
export const SETTINGS_NAVIGATION_TURN_REFRESH_ANGLE = 'navigation_turn_refresh_angle';
export const SETTINGS_NAVIGATION_TURN_REFRESH_DELAY = 'navigation_turn_refresh_delay';
export const SETTINGS_NAVIGATION_BEARING_REFRESH_ANGLE = 'navigation_bearing_refresh_angle';
export const SETTINGS_NAVIGATION_SPEED_DROP_WAKE = 'navigation_speed_drop_wake';
export const SETTINGS_NAVIGATION_SPEED_DROP_WAKE_RATIO = 'navigation_speed_drop_wake_ratio';
export const SETTINGS_NAVIGATION_AUTO_PAUSE = 'navigation_auto_pause';
export const SETTINGS_NAVIGATION_AUTO_PAUSE_SPEED = 'navigation_auto_pause_speed';
export const SETTINGS_NAVIGATION_AUTO_PAUSE_DELAY = 'navigation_auto_pause_delay';
export const SETTINGS_NAVIGATION_RECORD_STATS = 'navigation_record_stats';
export const SETTINGS_NAVIGATION_RECORD_TRACK = 'navigation_record_track';
export const SETTINGS_NAVIGATION_HIDE_CHROME = 'navigation_hide_chrome';
export const SETTINGS_NAVIGATION_SHOW_ELEVATION_CHART = 'navigation_show_elevation_chart';
export const SETTINGS_NAVIGATION_SHOW_SURFACE = 'navigation_show_surface';
export const SETTINGS_NAVIGATION_SURFACE_SPAN = 'navigation_surface_span';
export const SETTINGS_NAVIGATION_GRADE_LOOK_AHEAD = 'navigation_grade_look_ahead';
export const SETTINGS_NAVIGATION_CHART_CURRENT_ASCENT = 'navigation_chart_current_ascent';
export const SETTINGS_NAVIGATION_ARROW_MARKER = 'navigation_arrow_marker';

export const SETTINGS_ELEVATION_PROFILE_SMOOTH_WINDOW = 'elevation_profile_smooth_window';
export const SETTINGS_ELEVATION_PROFILE_FILTER_STEP = 'elevation_profile_filter_step';
export const SETTINGS_SHOW_ELEVATION_PROFILE_ASCENTS = 'show_elevation_profile_ascents';
export const SETTINGS_SHOW_ELEVATION_PROFILE_WAYPOINTS = 'chart_show_waypoints';
export const SETTINGS_SHOW_ELEVATION_PROFILE_GRADE_COLORS = 'show_elevation_profile_grade_colors';
export const SETTINGS_ELEVATION_PROFILE_ASCENTS_MIN_GAIN = 'elevation_profile_ascents_min_gain';
export const SETTINGS_ELEVATION_PROFILE_ASCENTS_DIP_TOLERANCE = 'elevation_profile_ascents_dip_tolerance';
export const SETTINGS_ELEVATION_PROFILE_GRADE_STEP = 'elevation_profile_grade_step';
export const SETTINGS_ELEVATION_PROFILE_GRADE_SMOOTH = 'elevation_profile_grade_smooth';
export const SETTINGS_ELEVATION_PROFILE_GRADE_BASELINE = 'elevation_profile_grade_baseline';
export const SETTINGS_ELEVATION_PROFILE_GRADE_MIN_SECTION = 'elevation_profile_grade_min_section';

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
/** past this the next maneuver is too far to be worth framing, and speed decides the zoom alone */
export const DEFAULT_NAVIGATION_ZOOM_MANEUVER_VISIBLE_DISTANCE = 2000;
/** floor, so crawling does not collapse the view onto the user's own dot */
export const DEFAULT_NAVIGATION_ZOOM_MIN_LOOK_AHEAD = 200;
export const DEFAULT_NAVIGATION_ZOOM_MAX_LOOK_AHEAD = 4000;
export const DEFAULT_NAVIGATION_ZOOM_MIN = 12;
export const DEFAULT_NAVIGATION_ZOOM_MAX = 18;
export const DEFAULT_NAVIGATION_BACKGROUND_UPDATE_INTERVAL = 5000;
/** meters the gps must move before reporting, 0 means report every fix */
export const DEFAULT_NAVIGATION_GPS_UPDATE_DISTANCE = 0;
export const DEFAULT_NAVIGATION_MANEUVER_WAKE_DISTANCE = 150;
/** seconds between the plain background refreshes that keep the map current on a long straight, 0 disables */
export const DEFAULT_NAVIGATION_SCREEN_REFRESH_INTERVAL = 120;
/** degrees: past this turn angle the map is worth refreshing again once the maneuver is behind us */
export const DEFAULT_NAVIGATION_TURN_REFRESH_ANGLE = 45;
/** seconds to wait after a sharp maneuver before refreshing, so the heading has settled first */
export const DEFAULT_NAVIGATION_TURN_REFRESH_DELAY = 2;
/** degrees of heading change since the last refresh that make the map worth redrawing, 0 disables */
export const DEFAULT_NAVIGATION_BEARING_REFRESH_ANGLE = 90;
export const DEFAULT_NAVIGATION_SPEED_DROP_WAKE = true;
export const DEFAULT_NAVIGATION_SPEED_DROP_WAKE_RATIO = 0.5;
export const DEFAULT_NAVIGATION_AUTO_PAUSE = true;
export const DEFAULT_NAVIGATION_AUTO_PAUSE_SPEED = 0.5;
export const DEFAULT_NAVIGATION_AUTO_PAUSE_DELAY = 120;
export const DEFAULT_NAVIGATION_RECORD_STATS = true;
export const DEFAULT_NAVIGATION_RECORD_TRACK = false;
export const DEFAULT_NAVIGATION_HIDE_CHROME = true;
export const DEFAULT_NAVIGATION_SHOW_ELEVATION_CHART = true;
export const DEFAULT_NAVIGATION_SHOW_SURFACE = true;
/** meters of road ahead the surface widget covers, so the bar has a readable scale */
export const DEFAULT_NAVIGATION_SURFACE_SPAN = 2000;
/** meters of road the live grade averages over: the single point value is too twitchy to read */
export const DEFAULT_NAVIGATION_GRADE_LOOK_AHEAD = 100;
/** while climbing, scope the mini chart to the ascent being climbed rather than the whole route */
export const DEFAULT_NAVIGATION_CHART_CURRENT_ASCENT = true;
export const DEFAULT_NAVIGATION_ARROW_MARKER = true;

export const DEFAULT_ELEVATION_PROFILE_SMOOTH_WINDOW = 3;
export const DEFAULT_ELEVATION_PROFILE_FILTER_STEP = 5;
export const DEFAULT_SHOW_ELEVATION_PROFILE_ASCENTS = true;
export const DEFAULT_SHOW_ELEVATION_PROFILE_WAYPOINTS = true;
export const DEFAULT_SHOW_ELEVATION_PROFILE_GRADE_COLORS = true;
export const DEFAULT_ELEVATION_PROFILE_ASCENTS_MIN_GAIN = 100;
export const DEFAULT_ELEVATION_PROFILE_ASCENTS_DIP_TOLERANCE = 80;
/**
 * Grade windows, all in meters. They are what decides how sharp the profile reads: the DEM resolves
 * around 30 m, so differentiating over less than that returns terrain noise, not slope.
 */
export const DEFAULT_ELEVATION_PROFILE_GRADE_STEP = 10;
export const DEFAULT_ELEVATION_PROFILE_GRADE_SMOOTH = 60;
export const DEFAULT_ELEVATION_PROFILE_GRADE_BASELINE = 100;
export const DEFAULT_ELEVATION_PROFILE_GRADE_MIN_SECTION = 150;
