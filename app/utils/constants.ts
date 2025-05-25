import { Screen } from '@nativescript/core';

export const ALERT_OPTION_MAX_HEIGHT = Screen.mainScreen.heightDIPs * 0.47;

export const SETTINGS_LANGUAGE = 'language';
export const SETTINGS_MAP_FONT_SCALE = 'map_font_scale';
export const SETTINGS_COLOR_THEME = 'color_theme';

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

export const DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN = 250000;
export const DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE = 500000;
export const DEFAULT_VALHALLA_MAX_DISTANCE_AUTO = 5000000;
export const DEFAULT_TILE_SERVER_AUTO_START = false;
export const DEFAULT_TILE_SERVER_PORT = 8081;
export const DEFAULT_VALHALLA_ONLINE_URL = 'https://valhalla1.openstreetmap.de';
export const DEFAULT_NAVIGATION_TILT = 45;
export const DEFAULT_NAVIGATION_POSITION_OFFSET = 0.3;
