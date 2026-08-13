import { GenericMapPos, MapPosVector, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
import { ApplicationSettings } from '@nativescript/core';
import { UNITS, convertDurationSeconds, convertValueToUnit, formatDuration, formatValue } from '~/helpers/formatter';
import { type AscentSegment, type Item, type RouteInstruction, type RouteProfile, RoutingAction } from '~/models/Item';
import { EARTH_RADIUS, TO_RAD, computeDistanceBetween } from '~/utils/geo';

export const DEFAULT_LOCATION_DISTANCE_FROM_ROUTE = 15;
/** how many segments ahead of the last known position we look for the user */
export const DEFAULT_PROJECTION_WINDOW = 200;

/** how much road past the maneuver we want in frame when we zoom onto it */
const MANEUVER_FRAME_RATIO = 1.4;

/** one row of navigation widget cards */
export const NAVWIDGET_ROW_HEIGHT = 60;
/** the estimates strip below them, shown at the same step so nothing is hidden by default */
export const NAVSTATS_HEIGHT = 32;
/** the maneuver banner at the top of the map, everything anchored up there has to clear it */
export const MANEUVER_VIEW_HEIGHT = 84;

/**
 * Height of the whole navigation view: the figures row, the previews row when there is one, and the
 * strip. Lives here rather than in the component so the map can size the navigation sheet without
 * pulling the whole navigation ui into its bundle.
 */
export function navigationViewHeight(hasPreviewWidgets: boolean) {
    // must match NavigationView's own `barRows`, which collapses the previews row to 0 when there is
    // nothing to preview. Reserving two rows unconditionally left a widget row of dead space below the
    // bar whenever previews were off.
    return NAVWIDGET_ROW_HEIGHT * (hasPreviewWidgets ? 2 : 1) + NAVSTATS_HEIGHT;
}

/** full elevation chart and route stats, same heights the item sheet gives them */
export const ROUTE_PROFILE_HEIGHT = 155;
export const ROUTE_STATS_HEIGHT = 180;

/**
 * Steps of the navigation sheet. It has no 0 step on purpose: the bar is the only way back out of
 * navigation, so it can never be dismissed. Dragging up reveals the profile then the stats.
 */
export function navigationSheetSteps({ barHeight, hasProfile, hasStats }: { barHeight: number; hasProfile: boolean; hasStats: boolean }) {
    const steps = [0, barHeight];
    if (hasProfile) {
        steps.push(steps[steps.length - 1] + ROUTE_PROFILE_HEIGHT);
    }
    if (hasStats) {
        steps.push(steps[steps.length - 1] + ROUTE_STATS_HEIGHT);
    }
    return steps;
}

/**
 * Value and unit kept apart so the UI can shrink the unit and let the number carry the emphasis.
 * The formatter's own helpers return them already joined.
 */
export function splitDistance(meters: number): [number, string] {
    return convertValueToUnit(meters, meters < 1000 ? UNITS.Meters : UNITS.Kilometers);
}
export function splitElevation(meters: number): [number, string] {
    return convertValueToUnit(meters, UNITS.Meters);
}
/** takes km/h, the unit Session stores speeds in. Goes through the unit machinery so imperial works. */
export function splitSpeed(speedKmh: number): [number, string] {
    return convertValueToUnit(speedKmh, UNITS.SpeedKm);
}
export function formatSpeed(speedKmh: number) {
    return formatValue(speedKmh, UNITS.SpeedKm);
}

export { formatDuration as formatNavigationDuration };

/** Same split as the other figures, so the unit can be drawn smaller than the value. */
export function splitDuration(seconds: number): [string, string] {
    if (seconds >= 3600) {
        return [convertDurationSeconds(seconds, 'H:mm'), 'h'];
    }
    if (seconds < 60) {
        return [convertDurationSeconds(seconds, 's'), 's'];
    }
    return [convertDurationSeconds(seconds, 'm'), 'min'];
}

export interface CurrentAscent {
    ascent: AscentSegment;
    /** index of the ascent in `profile.ascents`, so the UI can say "climb 2 of 3" */
    index: number;
    /** meters of climb left to the summit */
    remainingGain: number;
    /** meters of road left to the summit */
    remainingDistance: number;
    summitElevation: number;
}

/**
 * The climb the user is inside of right now, null when between climbs.
 * Total remaining ascent answers "how much is left overall"; on a route with several climbs what the
 * user actually wants while pedalling is how much of *this* climb is left, which is what this returns.
 */
export function getCurrentAscent(profile: RouteProfile, onPathIndex: number): CurrentAscent {
    const ascents = profile?.ascents;
    const data = profile?.data;
    if (!ascents?.length || !data?.length || onPathIndex < 0) {
        return null;
    }
    for (let index = 0; index < ascents.length; index++) {
        const ascent = ascents[index];
        // endIndex is the summit itself, so the climb is over the moment we pass it
        if (onPathIndex < ascent.startIndex || onPathIndex >= ascent.endIndex) {
            continue;
        }
        const current = data[Math.min(onPathIndex, data.length - 1)];
        const summit = data[Math.min(ascent.endIndex, data.length - 1)];
        return {
            ascent,
            index,
            remainingGain: Math.max(ascent.highestElevation - (current?.a ?? 0), 0),
            remainingDistance: Math.max((summit?.d ?? 0) - (current?.d ?? 0), 0),
            summitElevation: ascent.highestElevation
        };
    }
    return null;
}

export interface ManeuverIcon {
    icon: string;
    /** key into the `fonts` store, the alpimaps set only covers the common maneuvers */
    font: 'app' | 'mdi';
}

/** Icon for a maneuver, shared by the maneuver banner and the navigation view so they cannot diverge. */
export function getManeuverIcon(action: RoutingAction): ManeuverIcon {
    switch (action) {
        case RoutingAction.UTURN:
            return { icon: 'alpimaps-u-turn', font: 'app' };
        case RoutingAction.FINISH:
            return { icon: 'alpimaps-flag-checkered', font: 'app' };
        case RoutingAction.TURN_LEFT:
            return { icon: 'alpimaps-left-turn-1', font: 'app' };
        case RoutingAction.TURN_RIGHT:
            return { icon: 'alpimaps-right-turn-1', font: 'app' };
        case RoutingAction.ENTER_ROUNDABOUT:
        case RoutingAction.STAY_ON_ROUNDABOUT:
        case RoutingAction.LEAVE_ROUNDABOUT:
            return { icon: 'alpimaps-roundabout', font: 'app' };
        case RoutingAction.REACH_VIA_LOCATION:
            return { icon: 'mdi-map-marker', font: 'mdi' };
        case RoutingAction.GO_UP:
            return { icon: 'mdi-arrow-up-bold', font: 'mdi' };
        case RoutingAction.GO_DOWN:
            return { icon: 'mdi-arrow-down-bold', font: 'mdi' };
        case RoutingAction.WAIT:
            return { icon: 'mdi-timer-sand', font: 'mdi' };
        default:
            return { icon: 'alpimaps-up-arrow', font: 'app' };
    }
}

export interface NavigationLookAheadOptions {
    /** m/s */
    speed: number;
    distanceToNextInstruction?: number;
    distanceToFollowingInstruction?: number;
    lookAheadSeconds: number;
    denseManeuverDistance: number;
    /** past this the next maneuver is too far to be worth framing, and speed decides alone */
    maneuverVisibleDistance: number;
    minLookAhead: number;
    maxLookAhead: number;
}

/**
 * How many meters of road ahead the camera should frame.
 *
 * Speed sets the baseline, then the next maneuver adjusts it in *either* direction:
 * - it widens the view when the maneuver is further than the speed alone would show, so crawling up
 *   a long straight does not sit at maximum zoom with the turn off screen;
 * - it tightens the view on approach, so the turn is framed whatever the speed.
 *
 * Maneuver density only ever tightens: turn-after-turn on small roads must stay close even at speed,
 * which is exactly when the user has the least time to read the map.
 */
export function computeNavigationLookAhead({
    denseManeuverDistance,
    distanceToFollowingInstruction,
    distanceToNextInstruction,
    lookAheadSeconds,
    maneuverVisibleDistance,
    maxLookAhead,
    minLookAhead,
    speed
}: NavigationLookAheadOptions) {
    const hasManeuver = distanceToNextInstruction >= 0;
    // the floor keeps a slow speed from collapsing the view onto the user's own dot
    let lookAhead = Math.max(Math.max(speed, 0) * lookAheadSeconds, minLookAhead);

    if (hasManeuver && distanceToNextInstruction <= maneuverVisibleDistance) {
        // close enough to be worth showing: make sure it fits on screen, widening if we have to
        lookAhead = Math.max(lookAhead, distanceToNextInstruction * MANEUVER_FRAME_RATIO);
    }
    if (hasManeuver) {
        // never frame much more road than the maneuver itself once we are nearly on it
        lookAhead = Math.min(lookAhead, Math.max(distanceToNextInstruction * MANEUVER_FRAME_RATIO, minLookAhead));
    }
    const clustered = hasManeuver && distanceToFollowingInstruction >= 0 && distanceToFollowingInstruction < denseManeuverDistance;
    if (clustered) {
        lookAhead = Math.min(lookAhead, distanceToNextInstruction + distanceToFollowingInstruction);
    }
    return Math.min(Math.max(lookAhead, minLookAhead), maxLookAhead);
}

export interface RouteProgress {
    /** index in the route polyline the location snapped to, -1 when off route */
    onPathIndex: number;
    remainingDistance?: number;
    remainingTime?: number;
    remainingDistanceToStep?: number;
    /** the maneuver the user is heading to */
    instruction?: RouteInstruction;
    /** position of `instruction` in `item.instructions` */
    instructionIndex?: number;
    distanceToNextInstruction?: number;
    /**
     * distance between `instruction` and the one after it, ie how tightly maneuvers are packed.
     * `undefined` when `instruction` is the last one.
     */
    distanceToFollowingInstruction?: number;
}

export interface ComputeRouteProgressOptions {
    item: Item;
    location: GenericMapPos<LatLonKeys>;
    positions: MapPosVector<LatLonKeys>;
    onPathIndex: number;
    computeRemaining?: boolean;
    computeInstruction?: boolean;
    /**
     * meters from the user to `positions[onPathIndex]`, when the caller already projected the
     * location onto the route. Without it we fall back to the straight line to that vertex, which
     * overshoots whenever the user is not exactly on the polyline.
     */
    distanceToOnPathIndex?: number;
}

export interface RouteProjection {
    /** index of the vertex the user is heading to, ie the end of the segment they are on */
    index: number;
    /** meters from the user to `positions[index]`, measured along the route */
    distanceToIndex: number;
    /** how far off the route the user is, to tell a real position from a rejoin */
    distanceFromRoute: number;
}

/** Distance from a point to a segment, and how far along that segment the closest point sits. */
function projectOnSegment(lat: number, lon: number, aLat: number, aLon: number, bLat: number, bLon: number) {
    // at these distances a local flat approximation is exact enough and far cheaper than haversine
    const cosLat = Math.cos(aLat * TO_RAD);
    const bx = (bLon - aLon) * cosLat;
    const by = bLat - aLat;
    const px = (lon - aLon) * cosLat;
    const py = lat - aLat;
    const lengthSquared = bx * bx + by * by;
    const ratio = lengthSquared <= 0 ? 0 : Math.min(Math.max((px * bx + py * by) / lengthSquared, 0), 1);
    const dx = px - ratio * bx;
    const dy = py - ratio * by;
    const degreesToMeters = TO_RAD * EARTH_RADIUS;
    return {
        ratio,
        distance: Math.sqrt(dx * dx + dy * dy) * degreesToMeters,
        segmentLength: Math.sqrt(lengthSquared) * degreesToMeters
    };
}

/**
 * Projects a location onto the route, returning the closest segment rather than the first one within
 * tolerance like `isLocationOnPath` does.
 *
 * That difference matters: where a route passes near itself (a switchback, an out and back), the first
 * matching segment can belong to the other leg, the index then never advances, and the distance to the
 * next maneuver *grows* as the user drives away from a vertex they already passed. Searching a window
 * ahead of the last known index also makes progress monotonic and costs a few segments instead of all.
 */
export function projectOnRoute(
    location: GenericMapPos<LatLonKeys>,
    positions: MapPosVector<LatLonKeys>,
    { fromIndex = -1, tolerance = DEFAULT_LOCATION_DISTANCE_FROM_ROUTE, window = DEFAULT_PROJECTION_WINDOW }: { fromIndex?: number; tolerance?: number; window?: number } = {}
): RouteProjection {
    const size = positions.size();
    if (size < 2) {
        return null;
    }
    // one segment of slack behind, so a fix that lands just short of the last vertex still matches
    const start = fromIndex >= 0 ? Math.max(0, fromIndex - 2) : 0;
    const end = fromIndex >= 0 ? Math.min(size - 1, fromIndex + window) : size - 1;
    let best: RouteProjection = null;
    for (let index = start; index < end; index++) {
        const from = positions.get(index);
        const to = positions.get(index + 1);
        const projection = projectOnSegment(location.lat, location.lon, from.getY(), from.getX(), to.getY(), to.getX());
        if (!best || projection.distance < best.distanceFromRoute) {
            best = {
                index: index + 1,
                distanceToIndex: (1 - projection.ratio) * projection.segmentLength,
                distanceFromRoute: projection.distance
            };
        }
    }
    if (!best || best.distanceFromRoute > tolerance) {
        return null;
    }
    return best;
}

/** Routes coming from OSM are not navigable: they have no instructions and no consistent direction. */
export function isNavigableRoute(item: Item) {
    return !!item?.route && !item.route.osmid;
}

export function getDistanceFromRouteSetting() {
    return ApplicationSettings.getNumber('location_distance_from_route', DEFAULT_LOCATION_DISTANCE_FROM_ROUTE);
}

/** Snaps a location onto a route polyline. Returns -1 when the location is further than `distanceFromRoute` meters from it. */
export function isLocationOnRoute(location: GenericMapPos<LatLonKeys>, positions: MapPosVector<LatLonKeys>, distanceFromRoute: number = getDistanceFromRouteSetting()) {
    return isLocationOnPath(location, positions, false, true, distanceFromRoute);
}

/**
 * Everything we know about where the user is along a route.
 *
 * `computeRemaining` and `computeInstruction` are opt-in because both walk the polyline: on a long
 * imported track with no profile and no instructions there is nothing to compute and we must not pay for it.
 */
export function computeRouteProgress({ computeInstruction, computeRemaining, distanceToOnPathIndex, item, location, onPathIndex, positions }: ComputeRouteProgressOptions): RouteProgress {
    const result: RouteProgress = { onPathIndex };
    if (onPathIndex === -1) {
        return result;
    }
    const route = item.route;
    if (computeRemaining) {
        result.remainingDistance = distanceToEnd(onPathIndex, positions);
        // an imported gpx has no routing result behind it: no timings and no waypoints
        if (route.totalTime > 0 && route.totalDistance > 0) {
            result.remainingTime = (route.totalTime * result.remainingDistance) / route.totalDistance;
        }
        const stepIndex = route.waypoints?.filter((waypoint) => waypoint.properties?.showOnMap).find((waypoint) => waypoint.properties.index > onPathIndex)?.properties?.index;
        if (stepIndex >= 0) {
            result.remainingDistanceToStep = result.remainingDistance - distanceToEnd(stepIndex, positions);
        }
    }
    const instructions = item.instructions;
    if (computeInstruction && instructions?.length) {
        // the maneuver we are heading to is the first one still ahead of us
        let instructionIndex = -1;
        for (let index = instructions.length - 1; index >= 0; index--) {
            if (instructions[index].index < onPathIndex) {
                break;
            }
            instructionIndex = index;
        }
        // past the last maneuver there is nothing left to announce
        if (instructionIndex !== -1) {
            result.instructionIndex = instructionIndex;
            result.instruction = instructions[instructionIndex];
            let distanceToNextInstruction = distanceToOnPathIndex ?? computeDistanceBetween(location, fromNativeMapPos(positions.get(onPathIndex)));
            for (let index = onPathIndex; index < result.instruction.index; index++) {
                distanceToNextInstruction += computeDistanceBetween(fromNativeMapPos(positions.get(index)), fromNativeMapPos(positions.get(index + 1)));
            }
            result.distanceToNextInstruction = distanceToNextInstruction;
            if (instructionIndex < instructions.length - 1) {
                // a routing instruction's own distance is the length of the leg it opens, ie the gap to the next maneuver
                result.distanceToFollowingInstruction = result.instruction.dist;
            }
        }
    }
    return result;
}
