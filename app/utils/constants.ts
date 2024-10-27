import { Screen } from '@nativescript/core';

export const ALERT_OPTION_MAX_HEIGHT = Screen.mainScreen.heightDIPs * 0.47;

export const SETTINGS_MAP_FONT_SCALE = 'map_font_scale';
export const SETTINGS_COLOR_THEME = 'color_theme';

export const DEFAULT_COLOR_THEME = 'default';

export const MAP_FONT_SCALE = 1;

export const SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN = 'service_limits.pedestrian.max_distance';
export const SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE = 'service_limits.bicycle.max_distance';
export const SETTINGS_VALHALLA_MAX_DISTANCE_AUTO = 'service_limits.auto.max_distance';

export const DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN = 250000;
export const DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE = 500000;
export const DEFAULT_VALHALLA_MAX_DISTANCE_AUTO = 5000000;
