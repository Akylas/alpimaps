import { derived } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { DEFAULT_COMFORT, type DifficultyScale, SCALE_RANGE, levelLabel } from '~/routeFeatures/difficulty/scale';
import type { RouteSettingRow } from '~/routeFeatures/registry';
import { settingsStore } from '~/stores/settingsStore';

export const routeFeatureDifficulty = settingsStore('route_feature_difficulty', true);

/** The level from which a trail is hard for the user, by scale: what is above it is counted in the lens. */
export const difficultyComfortSac = settingsStore('difficulty_comfort_sac', DEFAULT_COMFORT.sac);
export const difficultyComfortMtb = settingsStore('difficulty_comfort_mtb', DEFAULT_COMFORT.mtb);

export const comfortStore = (scale: DifficultyScale) => (scale === 'sac' ? difficultyComfortSac : difficultyComfortMtb);

/** Changes with any of what the difficulty is read with: it is read again, and the lens and the map with it. */
export const difficultySettingsKey = derived([difficultyComfortSac, difficultyComfortMtb], (values) => values.join());

function comfortRow(scale: DifficultyScale): RouteSettingRow {
    const { max, min } = SCALE_RANGE[scale];
    // the hardest level has nothing above it
    return {
        type: 'slider',
        store: comfortStore(scale),
        title: lc(`difficulty_comfort_${scale}`),
        description: lc('difficulty_comfort_desc'),
        min,
        max: max - 1,
        step: 1,
        format: (level) => levelLabel(scale, level)
    };
}

export function difficultySettingRows(): RouteSettingRow[] {
    return [comfortRow('sac'), comfortRow('mtb')];
}
