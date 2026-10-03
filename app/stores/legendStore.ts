import { writable } from 'svelte/store';
import { settingsStore } from '~/stores/settingsStore';

export const showLegend = settingsStore('showMapLegend', false);
/** bumped when the map style or one of its parameters changes: the legend is resolved again */
export const legendVersion = writable(0);
