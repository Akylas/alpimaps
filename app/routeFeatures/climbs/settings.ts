import { settingsStore } from '~/stores/settingsStore';

/** The steep list is folded away until asked for: the climbs come first. */
export const climbsSteepOpen = settingsStore('climbs_steep_open', false);
