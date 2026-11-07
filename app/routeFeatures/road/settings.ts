import { derived } from 'svelte/store';
import { convertFamilyValue, formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { UNITS, UNIT_FAMILIES } from '~/helpers/units';
import { DEFAULT_BANNER_LEAD, DEFAULT_BANNER_MIN_LENGTH, DEFAULT_RISK_MIN_LENGTH, DEFAULT_RISK_THRESHOLD } from '~/routeFeatures/road/risk';
import type { RouteSettingRow } from '~/routeFeatures/registry';
import { settingsStore } from '~/stores/settingsStore';

export const routeFeatureRoad = settingsStore('route_feature_road', true);

/** km/h, the tagged limit from which a road is fast */
export const roadThreshold = settingsStore('road_threshold', DEFAULT_RISK_THRESHOLD);
/** meters, 0 keeps every section */
export const roadMinLength = settingsStore('road_min_length', DEFAULT_RISK_MIN_LENGTH);

/** A banner while following the route, when a fast section is near. */
export const roadBanner = settingsStore('road_banner', true);
/** meters, the shortest section the banner warns of: the list keeps every one over `roadMinLength` */
export const roadBannerMinLength = settingsStore('road_banner_min_length', DEFAULT_BANNER_MIN_LENGTH);
/** meters ahead of a section the banner appears at */
export const roadBannerLead = settingsStore('road_banner_lead', DEFAULT_BANNER_LEAD);

/** Changes with any of what the risk is classified with: it is read again, and the lens and the map with it. */
export const roadSettingsKey = derived([roadThreshold, roadMinLength], (values) => values.join());

const speed = (kmh: number) => convertFamilyValue(kmh, UNIT_FAMILIES.Speed, UNITS.SpeedKm).join(' ');

export function roadSettingRows(): RouteSettingRow[] {
    return [
        { type: 'slider', store: roadThreshold, title: lc('road_threshold'), description: lc('road_threshold_desc'), min: 50, max: 110, step: 5, format: speed },
        {
            type: 'slider',
            store: roadMinLength,
            title: lc('road_min_length'),
            description: lc('road_min_length_desc'),
            min: 0,
            max: 500,
            step: 10,
            format: (meters) => (meters > 0 ? formatDistance(meters) : lc('road_min_length_off'))
        },
        { type: 'switch', store: roadBanner, title: lc('road_banner'), description: lc('road_banner_desc') },
        { type: 'slider', store: roadBannerMinLength, title: lc('road_banner_min_length'), min: 30, max: 500, step: 10, format: formatDistance },
        { type: 'slider', store: roadBannerLead, title: lc('road_banner_lead'), min: 100, max: 1000, step: 50, format: formatDistance }
    ];
}
