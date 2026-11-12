import { derived } from 'svelte/store';
import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { DEFAULT_STEEP_MIN_LENGTH } from '~/routeFeatures/climbs/steep';
import { type RouteSettingRow, visitStore } from '~/routeFeatures/registry';
import { settingsStore } from '~/stores/settingsStore';

export const routeFeatureClimbs = settingsStore('route_feature_climbs', true);

/** The steep list is folded away until asked for, on every visit: the climbs come first. */
export const climbsSteepOpen = visitStore(false);

/** `auto`: the route's activity picks the preset, see `presetForActivity`. Else a `SteepPreset`. */
export const climbsPreset = settingsStore<string>('climbs_preset', 'auto');
/** The thresholds in %, over the preset's: 0 leaves the preset's value. */
export const climbsSteepUp = settingsStore('climbs_steep_up', 0);
export const climbsSteepDown = settingsStore('climbs_steep_down', 0);
/** meters */
export const climbsMinLength = settingsStore('climbs_min_length', DEFAULT_STEEP_MIN_LENGTH);
export const climbsCategories = settingsStore('climbs_categories', true);

/** Changes with any of what the climbs are read with: they are read again, and the card and the map with them. */
export const climbsSettingsKey = derived([climbsPreset, climbsSteepUp, climbsSteepDown, climbsMinLength, climbsCategories], (values) => values.join());

const percent = (value: number) => (value > 0 ? value + ' %' : lc('climbs_threshold_preset'));

export function climbsSettingRows(): RouteSettingRow[] {
    return [
        {
            type: 'segment',
            store: climbsPreset,
            title: lc('climbs_settings_preset'),
            description: lc('climbs_settings_preset_desc'),
            options: [
                { value: 'auto', title: lc('climbs_preset_auto') },
                { value: 'road', title: lc('climbs_preset_road') },
                { value: 'gravel', title: lc('climbs_preset_gravel') },
                { value: 'mtb', title: lc('climbs_preset_mtb') },
                { value: 'hiking', title: lc('climbs_preset_hiking') }
            ]
        },
        { type: 'switch', store: climbsCategories, title: lc('climbs_categories'), description: lc('climbs_categories_desc') },
        { type: 'sectionheader', title: lc('climbs_steep_sections') },
        { type: 'slider', store: climbsSteepUp, title: lc('climbs_steep_up'), min: 0, max: 30, step: 1, format: percent },
        { type: 'slider', store: climbsSteepDown, title: lc('climbs_steep_down'), min: 0, max: 40, step: 1, format: percent },
        { type: 'slider', store: climbsMinLength, title: lc('climbs_min_length'), min: 50, max: 500, step: 25, format: formatDistance }
    ];
}
