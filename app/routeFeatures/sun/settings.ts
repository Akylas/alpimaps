import { derived } from 'svelte/store';
import { lc } from '~/helpers/locale';
import type { RouteSettingRow } from '~/routeFeatures/registry';
import { settingsStore } from '~/stores/settingsStore';

export const routeFeatureSun = settingsStore('route_feature_sun', true);

/** The sun blinds under this altitude, degrees. 0: the activity's own, 12 on foot and 15 on wheels. */
export const sunGlareAngle = settingsStore('sun_glare_angle', 0);

/** The moon lights the night from this share of it lit, %. */
export const sunMoonMin = settingsStore('sun_moon_min', 30);

/** Where the terrain hides the sun is read from the elevation data, and counted in the lens and the card. */
export const sunTerrain = settingsStore('sun_terrain', true);

/** Changes with any of what the sun is read with: it is read again, and the lens and the map with it. */
export const sunSettingsKey = derived([sunGlareAngle, sunMoonMin, sunTerrain], (values) => values.join());

const degrees = (value: number) => (value > 0 ? value + '°' : lc('sun_glare_preset'));

export function sunSettingRows(): RouteSettingRow[] {
    return [
        { type: 'switch', store: sunTerrain, title: lc('sun_terrain'), description: lc('sun_terrain_desc') },
        { type: 'slider', store: sunGlareAngle, title: lc('sun_glare_angle'), description: lc('sun_glare_angle_desc'), min: 0, max: 25, step: 1, format: degrees },
        { type: 'slider', store: sunMoonMin, title: lc('sun_moon_min'), description: lc('sun_moon_min_desc'), min: 0, max: 100, step: 5, format: (value: number) => value + ' %' }
    ];
}
