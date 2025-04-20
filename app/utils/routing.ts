import { ApplicationSettings, Color } from '@nativescript/core';

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
        const settings = getValhallaSettings(key, options[key]);
        if (Array.isArray(settings)) {
            const index = Math.max(settings.indexOf(options[key]), 0);
            return new Color(baseColor).setAlpha(((index + 1) / settings.length) * 255).hex;
        } else {
            let perc = ((options[key] || settings.min) - settings.min) / (settings.max - settings.min);
            if (key.endsWith('_factor') || key.endsWith('_penalty')) {
                perc = 1 - perc;
            }
            return new Color(baseColor).setAlpha(perc * 200 + 55).hex;
        }
    } catch (error) {
        console.error(key, error, error.stack);
    }
}

export const valhallaSettings = {
    max_hiking_difficulty: {
        min: 1,
        max: 6
    },
    exclude_unpaved: {
        type: 'switch'
    },
    // bicycle_type: ['Road', 'Hybrid', 'Mountain'],
    // pedestrian_type: ['normal', 'mountaineer'],
    walking_speed: {
        min: 1,
        max: 20
    }
};
export function getValhallaSettings(key, value) {
    let settings = valhallaSettings[key];
    if (!settings) {
        if (key.endsWith('_factor') || key.endsWith('_penalty')) {
            settings = {
                min: 0,
                max: 200
            };
        } else if (key === 'use_tracks' || key === 'use_hills') {
            settings = {
                min: -100,
                max: 1
            };
        } else if (key === 'avoid_bad_surfaces') {
            settings = {
                min: 0,
                max: 100
            };
        } else {
            settings = {
                min: 0,
                max: 1
            };
        }
    }
    if (settings.type === 'switch') {
        settings = JSON.parse(JSON.stringify(settings));
        settings.value = value || false;
    }
    DEV_LOG && console.log('getValhallaSettings', key, value, JSON.stringify(settings)); 
    return settings;
}

export function getSavedProfile(profile: string, key: string, defaultValue?: any) {
    return JSON.parse(ApplicationSettings.getString(`profile_${profile}_${key}`, 'false')) || defaultValue;
}
export function removeSavedProfile(profile: string, key: string) {
    return ApplicationSettings.remove(`profile_${profile}_${key}`);
}
export function savedProfile(profile: string, key: string, value) {
    return ApplicationSettings.setString(`profile_${profile}_${key}`, JSON.stringify(value));
}
export const defaultProfileCostingOptions = {
    pedestrian: {
        driveway_factor: 200,
        walkway_factor: 0.8,
        use_tracks: 1,
        sidewalk_factor: 10
    },
    bicycle: { use_roads: 0.4, use_tracks: 0, non_network_penalty: 15 l, exclude_unpaved: false },
    auto: { use_tolls: 1, use_highways: 1 },
    motorcycle: { use_tolls: 1, use_trails: 0 }
};
