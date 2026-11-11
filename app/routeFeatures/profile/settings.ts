import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { RouteSettingRow } from '~/routeFeatures/registry';
import { showAscents, showGradeColors } from '~/stores/mapStore';
import { navigationChartCurrentAscent, navigationGradeLookAhead } from '~/stores/navigationStore';
import { settingsStore } from '~/stores/settingsStore';
import { DEFAULT_ELEVATION_PROFILE_FILTER_STEP, DEFAULT_ELEVATION_PROFILE_SMOOTH_WINDOW, SETTINGS_ELEVATION_PROFILE_FILTER_STEP, SETTINGS_ELEVATION_PROFILE_SMOOTH_WINDOW } from '~/utils/constants';

export const routeFeatureProfile = settingsStore('route_feature_profile', true);

// the chart and the profile computation read these keys from ApplicationSettings with the same defaults
export const chartMaxFilter = settingsStore('chart_max_filter', 50);
export const chartElevationMinRange = settingsStore('chart_elevation_min_range', 250);
export const elevationProfileSmoothWindow = settingsStore(SETTINGS_ELEVATION_PROFILE_SMOOTH_WINDOW, DEFAULT_ELEVATION_PROFILE_SMOOTH_WINDOW);
export const elevationProfileFilterStep = settingsStore(SETTINGS_ELEVATION_PROFILE_FILTER_STEP, DEFAULT_ELEVATION_PROFILE_FILTER_STEP);

export function profileSettingRows(): RouteSettingRow[] {
    return [
        { type: 'sectionheader', title: lc('elevation_profile') },
        { type: 'switch', store: showGradeColors, title: lc('show_elevation_profile_grade_colors') },
        { type: 'switch', store: showAscents, title: lc('show_elevation_profile_ascents') },
        { type: 'slider', store: chartMaxFilter, title: lc('chart_max_filter'), min: 0, max: 500, step: 10 },
        { type: 'slider', store: chartElevationMinRange, title: lc('chart_elevation_min_range'), min: 50, max: 2000, step: 50, format: formatDistance },
        { type: 'slider', store: elevationProfileSmoothWindow, title: lc('elevation_profile_smooth_window'), min: 0, max: 20, step: 1 },
        { type: 'slider', store: elevationProfileFilterStep, title: lc('elevation_profile_filter_step'), min: 1, max: 50, step: 1 },
        { type: 'sectionheader', title: lc('navigation') },
        { type: 'switch', store: navigationChartCurrentAscent, title: lc('navigation_chart_current_ascent'), description: lc('navigation_chart_current_ascent_desc') },
        {
            type: 'slider',
            store: navigationGradeLookAhead,
            title: lc('navigation_grade_look_ahead'),
            description: lc('navigation_grade_look_ahead_desc'),
            min: 20,
            max: 1000,
            step: 20,
            format: formatDistance
        }
    ];
}
