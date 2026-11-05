import type { ValhallaProfile } from '~/utils/routing';
import type { Activity, RouteAnalysis } from './types';

const BIKE_SUBTYPES: Activity['subtype'][] = ['road', 'gravel', 'normal', 'mountain', 'enduro'];

/** What a computed route says about its activity. `route.type` is a Valhalla costing for a computed route, anything for a GPX. */
export function activityFromRoute(route: { type?: string; subtype?: string } | undefined): Activity | undefined {
    switch (route?.type) {
        case 'pedestrian':
            return { kind: 'hike', subtype: route.subtype === 'running' ? 'run' : 'walk', origin: 'route' };
        case 'bicycle':
            return { kind: 'bike', subtype: BIKE_SUBTYPES.find((subtype) => subtype === route.subtype) ?? 'normal', origin: 'route' };
        case 'car':
        case 'auto':
        case 'bus':
        case 'truck':
        case 'motorcycle':
            return { kind: 'motor', origin: 'route' };
        default:
            return undefined;
    }
}

/**
 * The activity to analyse a route with. A computed route is what it was routed for; an imported track has none until
 * the user says what it is, `route.type` being whatever its GPX said.
 */
export function activityOf(item: { properties?: { imported?: boolean; route?: { type?: string; subtype?: string } } }, analysis?: RouteAnalysis | null): Activity | undefined {
    return item.properties?.imported ? analysis?.inputs.activity : (activityFromRoute(item.properties?.route) ?? analysis?.inputs.activity);
}

/** True when a lens that needs an activity has to ask for it. */
export function needsActivity(item: Parameters<typeof activityOf>[0], analysis?: RouteAnalysis | null): boolean {
    return !activityOf(item, analysis);
}

const VALHALLA_PROFILES: ValhallaProfile[] = ['car', 'auto', 'bus', 'bicycle', 'pedestrian', 'truck', 'motorcycle'];

/**
 * The Valhalla profile to match a saved route with: the profile it was computed with, what the user said an imported
 * track is, else pedestrian. An imported track's `route.type` is whatever its GPX said.
 */
export function statsProfile(item: { properties?: { imported?: boolean; route?: { type?: string } } }, analysis?: RouteAnalysis | null): ValhallaProfile {
    const picked = analysis?.inputs.activity;
    if (picked?.origin === 'user' && item.properties?.imported) {
        return picked.kind === 'bike' ? 'bicycle' : picked.kind === 'motor' ? 'auto' : 'pedestrian';
    }
    const type = item.properties?.route?.type;
    return (!item.properties?.imported && VALHALLA_PROFILES.find((profile) => profile === type)) || 'pedestrian';
}
