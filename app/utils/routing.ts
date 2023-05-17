import { Color } from '@nativescript/core';

export const valhallaSettingIcon = {
    driveway_factor: 'mdi-road',
    use_roads: 'mdi-road',
    use_hills: 'mdi-chart-areaspline',
    use_highways: 'mdi-highway',
    use_tolls: 'mdi-credit-card-marker-outline',
    non_network_penalty: 'mdi-sign-direction',
    weight: 'mdi-weight',
    avoid_bad_surfaces: 'mdi-texture-box',
    step_penalty: 'mdi-stairs',
    use_tracks: 'mdi-shoe-print'
};

export function valhallaSettingColor(key: string, profile: string, options: any, baseColor = 'white') {
    try {
        if (options[profile]) {
            options = options[profile];
        }
        const settings = getValhallaSettings(key);
        if (Array.isArray(settings)) {
            const index = Math.max(settings.indexOf(options[key]), 0);
            return new Color(baseColor).setAlpha(((index + 1) / settings.length) * 255).hex;
        } else {
            let perc = ((options[key] || settings.min) - settings.min) / (settings.max - settings.min);
            if (key.endsWith('_factor') || key.endsWith('_penalty')) {
                perc = 1 - perc;
            }
            return new Color(baseColor).setAlpha(perc * 126 + 126).hex;
        }
    } catch (error) {
        console.error(key, error);
    }
}

export const valhallaSettings = {
    max_hiking_difficulty: {
        min: 1,
        max: 6
    },
    // bicycle_type: ['Road', 'Hybrid', 'Mountain'],
    // pedestrian_type: ['normal', 'mountaineer'],
    walking_speed: {
        min: 1,
        max: 20
    }
};
export function getValhallaSettings(key) {
    let settings = valhallaSettings[key];
    if (!settings) {
        if (key.endsWith('_factor') || key.endsWith('_penalty')) {
            settings = {
                min: 0,
                max: 200
            };
        } else {
            settings = {
                min: 0,
                max: 1
            };
        }
    }
    return settings;
}
