/** The travel mode the user picked on the GPS button. Pure: nothing here may import NativeScript. */

/** `auto` follows the route profile, else the default directions profile. */
export type TravelMode = 'auto' | 'walk' | 'bike' | 'car';
export type TravelProfile = 'pedestrian' | 'bicycle' | 'auto';

function toTravelProfile(profile: string): TravelProfile {
    return profile === 'pedestrian' || profile === 'bicycle' ? profile : 'auto';
}

export function travelProfile(mode: TravelMode, routeProfile: string | undefined, fallbackProfile: string): TravelProfile {
    switch (mode) {
        case 'walk':
            return 'pedestrian';
        case 'bike':
            return 'bicycle';
        case 'car':
            return 'auto';
        default:
            return toTravelProfile(routeProfile ?? fallbackProfile);
    }
}
