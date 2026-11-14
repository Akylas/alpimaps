import { ApplicationSettings } from '@nativescript/core';
import { derived } from 'svelte/store';
import { type TravelMode, travelProfile } from '~/routeFeatures/junctions/travelMode';
import { nutiProps } from '~/stores/mapStore';
import { isNavigating, navigationItem } from '~/stores/navigationStore';
import { settingsStore } from '~/stores/settingsStore';
import { SETTINGS_DEFAULT_DIRECTION_PROFILE } from '~/utils/constants';

/**
 * What the user rides or drives, picked on the GPS button: `auto` follows the route while there is one. Not saved
 * as `travel_mode`: the style parameter of that name is a map option, saved under it.
 */
export const travelMode = settingsStore<TravelMode>('travel_mode_choice', 'auto');
/** The junction chips and stubs of the way ahead. */
export const showTurnOptions = settingsStore('show_turn_options', false);

/** The routing profile the travel mode comes to now. */
export const activeTravelProfile = derived([travelMode, navigationItem], ([mode, item]) =>
    travelProfile(mode, item?.properties?.route?.type, ApplicationSettings.getString(SETTINGS_DEFAULT_DIRECTION_PROFILE, 'pedestrian'))
);

/** The mode is fixed by the route while navigating: `isNavigating`. */
export const travelModeLocked = isNavigating;

// the base map draws the bike contraflow arrows only for a bike
activeTravelProfile.subscribe((profile) => {
    nutiProps['travel_mode'] = profile === 'bicycle' ? 1 : 0;
});
