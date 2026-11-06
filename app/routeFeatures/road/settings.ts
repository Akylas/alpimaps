import { derived } from 'svelte/store';
import { convertFamilyValue, formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { UNITS, UNIT_FAMILIES } from '~/helpers/units';
import { DEFAULT_RISK_MIN_LENGTH, DEFAULT_RISK_THRESHOLD } from '~/routeFeatures/road/risk';
import type { RouteSettingRow } from '~/routeFeatures/registry';
import { settingsStore } from '~/stores/settingsStore';

export const routeFeatureRoad = settingsStore('route_feature_road', true);

/** km/h, the tagged limit from which a road is fast */
export const roadThreshold = settingsStore('road_threshold', DEFAULT_RISK_THRESHOLD);
/** meters, 0 keeps every section */
export const roadMinLength = settingsStore('road_min_length', DEFAULT_RISK_MIN_LENGTH);

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
        }
    ];
}
