import { GenericMapPos, MapPosVector, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
import { ApplicationSettings } from '@nativescript/core';
import { UNITS, convertDurationSeconds, convertValueToUnit, formatDuration, formatValue } from '~/helpers/formatter';
import { type AscentSegment, type Item, type Route, type RouteInstruction, type RouteProfile, RoutingAction } from '~/models/Item';
import { EARTH_RADIUS, TO_DEG, TO_RAD, computeDistanceBetween } from '~/utils/geo';

export const DEFAULT_LOCATION_DISTANCE_FROM_ROUTE = 15;
/** degrees past which a segment counts as going the other way, rather than merely bending away */
const OPPOSITE_SEGMENT_ANGLE = 120;
/** meters a segment going the other way is scored as further, so the right leg of an out and back wins */
const OPPOSITE_SEGMENT_PENALTY = 60;
/** m/s below which the reported heading is noise: standing still, it points anywhere */
const MIN_BEARING_SPEED = 1;
/** meters of route ahead of the last known position the projection may move to in one fix */
const MAX_PROJECTION_LOOKAHEAD = 1000;
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
    // both widget rows are reserved whether or not there are previews, so the bar keeps one height for
    // the whole of a navigation: sizing it to the current content makes the sheet jump every time a
    // preview appears or drops out
    return NAVWIDGET_ROW_HEIGHT * 2 + NAVSTATS_HEIGHT;
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
    /** index in the route polyline the location snapped to, -1 when we never matched the route */
    onPathIndex: number;
    /** true once the user is confirmed away from the route, see `OffRouteDetector` */
    offRoute?: boolean;
    /** meters from the user to the closest point of the route, whatever the state */
    distanceFromRoute?: number;
    /**
     * index of the closest route vertex to the user right now, even while off route. Unlike
     * `onPathIndex` it keeps following the user, so it is what a rejoin target is picked from.
     */
    closestIndex?: number;
    /** the figures come from the last on-route fix, not from where the user actually is */
    stale?: boolean;
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
    /** the user is following a reroute leg, so `onPathIndex` is the point it rejoins the route at */
    onDetour?: boolean;
    /** index along the detour polyline, only set while `onDetour` */
    detourIndex?: number;
}

/**
 * What progress needs of a route: the timings and the maneuvers. An `Item` satisfies it, and so does a
 * detour leg, which has both but is not an item and must never be turned into one.
 */
export interface RouteProgressSource {
    route?: Route;
    instructions?: RouteInstruction[];
}

export interface ComputeRouteProgressOptions {
    item: RouteProgressSource;
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

/** Smallest angle between two headings, so 350° and 10° are 20° apart rather than 340°. */
export function angleDifference(first: number, second: number) {
    const diff = Math.abs(first - second) % 360;
    return diff > 180 ? 360 - diff : diff;
}

/** Distance from a point to a segment, how far along that segment the closest point sits, and its heading. */
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
        segmentLength: Math.sqrt(lengthSquared) * degreesToMeters,
        // the local frame is already east/north, so the heading of the segment falls out of it
        bearing: (Math.atan2(bx, by) * TO_DEG + 360) % 360
    };
}

/**
 * Closest point of the route to a location, whatever the distance.
 *
 * It returns the closest segment rather than the first one within tolerance like `isLocationOnPath`
 * does. That difference matters: where a route passes near itself (a switchback, an out and back), the
 * first matching segment can belong to the other leg, the index then never advances, and the distance
 * to the next maneuver *grows* as the user drives away from a vertex they already passed. Searching a
 * window ahead of the last known index also makes progress monotonic and costs a few segments instead
 * of all.
 *
 * Deciding whether that closest point is close *enough* is the caller's job — `projectOnRoute` for a
 * plain tolerance, `OffRouteDetector` when the answer has to survive a bad fix.
 */
export function findClosestOnRoute(
    location: GenericMapPos<LatLonKeys>,
    positions: MapPosVector<LatLonKeys>,
    { bearing, fromIndex = -1, maxAhead = Number.POSITIVE_INFINITY, window = DEFAULT_PROJECTION_WINDOW }: { fromIndex?: number; window?: number; bearing?: number; maxAhead?: number } = {}
): RouteProjection {
    const size = positions.size();
    if (size < 2) {
        return null;
    }
    // one segment of slack behind, so a fix that lands just short of the last vertex still matches
    const start = fromIndex >= 0 ? Math.max(0, fromIndex - 2) : 0;
    const end = fromIndex >= 0 ? Math.min(size - 1, fromIndex + window) : size - 1;
    const useBearing = bearing >= 0;
    // the limit is "ahead of where we were", so it means nothing without a position to be ahead of:
    // capping a search that starts at the route's own beginning would simply never reach the user
    const limitAhead = fromIndex >= 0 ? maxAhead : Number.POSITIVE_INFINITY;
    let best: RouteProjection = null;
    let bestScore = Number.POSITIVE_INFINITY;
    let ahead = 0;
    for (let index = start; index < end; index++) {
        const from = positions.get(index);
        const to = positions.get(index + 1);
        const projection = projectOnSegment(location.lat, location.lon, from.getY(), from.getX(), to.getY(), to.getX());
        // a window counted in vertices is kilometres long on a sparse track: stepping off the route
        // there would match a piece of it the user has not walked yet and read as progress
        ahead += projection.segmentLength;
        if (best && ahead > limitAhead) {
            break;
        }
        // an out and back walks the same road twice: geometrically the two legs are the same segments,
        // so distance alone cannot tell them apart and the projection lands on whichever came first.
        // Which way the user is going can, so a segment heading against them is scored as further away
        const score = useBearing && angleDifference(projection.bearing, bearing) > OPPOSITE_SEGMENT_ANGLE ? projection.distance + OPPOSITE_SEGMENT_PENALTY : projection.distance;
        if (score < bestScore) {
            bestScore = score;
            best = {
                index: index + 1,
                distanceToIndex: (1 - projection.ratio) * projection.segmentLength,
                distanceFromRoute: projection.distance
            };
        }
    }
    return best;
}

/** `findClosestOnRoute`, but null when the closest point is further than `tolerance`. */
export function projectOnRoute(
    location: GenericMapPos<LatLonKeys>,
    positions: MapPosVector<LatLonKeys>,
    { fromIndex = -1, tolerance = DEFAULT_LOCATION_DISTANCE_FROM_ROUTE, window = DEFAULT_PROJECTION_WINDOW }: { fromIndex?: number; tolerance?: number; window?: number } = {}
): RouteProjection {
    const best = findClosestOnRoute(location, positions, { fromIndex, window });
    if (!best || best.distanceFromRoute > tolerance) {
        return null;
    }
    return best;
}

/** meters: whatever the gps claims, past this a "maybe I am on the route" is not worth entertaining */
const MAX_OFF_ROUTE_TOLERANCE = 60;
/** this many times the tolerance is not a bad fix, it is somewhere else: no need to wait for a second one */
const OFF_ROUTE_OBVIOUS_RATIO = 3;
/** ms between two full polyline scans while off route */
const OFF_ROUTE_RESCAN_INTERVAL = 5000;
/** meters travelled that also earn a full scan, so a fast rider does not wait out the interval */
const OFF_ROUTE_RESCAN_DISTANCE = 100;

export interface OffRouteOptions {
    /** meters of margin over a perfect fix before it counts as off route */
    distance?: number;
    /** consecutive confirming fixes needed to believe it */
    fixes?: number;
}

export interface OffRouteState {
    /** index progress is measured from: the live one, or the last on-route one while off route */
    onPathIndex: number;
    /** meters from the user to `onPathIndex`, along the route */
    distanceToIndex: number;
    /** closest route vertex to where the user actually is, off route included */
    closestIndex: number;
    distanceFromRoute: number;
    offRoute: boolean;
    /** `onPathIndex` no longer describes where the user is */
    stale: boolean;
    /** timestamp the user was confirmed off route, 0 while on route */
    offRouteSince: number;
}

/**
 * Decides whether the user is following the route, keeping enough state to be sure about it.
 *
 * Three things a plain per-fix distance test gets wrong, and this exists to fix:
 * - a single bad fix (urban canyon, cold start, a tunnel exit) is not leaving the route, so a
 *   confirmation over several fixes is required — unless the fix is so far off there is no doubt;
 * - the gps says how much it trusts itself, so the tolerance follows the reported accuracy instead of
 *   pretending every fix is perfect;
 * - once off route the last known index is worth keeping: it is where the user *left* the route, which
 *   is both what the remaining figures are measured from and where a rejoin is computed to. Dropping
 *   it also meant every later fix rescanning the whole polyline.
 */
export class OffRouteDetector {
    private lastOnPathIndex = -1;
    private lastDistanceToIndex = 0;
    private offFixes = 0;
    private mOffRoute = false;
    private mOffRouteSince = 0;
    private lastFullScanTime = 0;
    private lastFullScanLocation: GenericMapPos<LatLonKeys> = null;

    /** read lazily so changing the setting mid navigation applies on the next fix */
    constructor(private readonly getOptions: () => OffRouteOptions = () => ({})) {}

    get offRoute() {
        return this.mOffRoute;
    }
    /** last index the user was actually on the route at, -1 before the first match */
    get onPathIndex() {
        return this.lastOnPathIndex;
    }
    get offRouteSince() {
        return this.mOffRouteSince;
    }

    reset() {
        this.lastOnPathIndex = -1;
        this.lastDistanceToIndex = 0;
        this.offFixes = 0;
        this.mOffRoute = false;
        this.mOffRouteSince = 0;
        this.lastFullScanTime = 0;
        this.lastFullScanLocation = null;
    }

    /** Restarts from a known index, for when the route itself changed under us (a reroute). */
    resetTo(onPathIndex: number) {
        this.reset();
        this.lastOnPathIndex = onPathIndex;
    }

    /** meters this fix is allowed to be from the route before it counts against us */
    toleranceFor(location: GenericMapPos<LatLonKeys> & { horizontalAccuracy?: number }) {
        const base = this.getOptions().distance ?? DEFAULT_LOCATION_DISTANCE_FROM_ROUTE;
        const accuracy = location.horizontalAccuracy > 0 ? location.horizontalAccuracy : 0;
        return Math.min(Math.max(base + accuracy, base), Math.max(MAX_OFF_ROUTE_TOLERANCE, base));
    }

    /** A full scan is the only way to notice a rejoin somewhere else, and the only expensive one. */
    private shouldFullScan(location: GenericMapPos<LatLonKeys>, now: number) {
        if (!this.lastFullScanLocation) {
            return true;
        }
        return now - this.lastFullScanTime >= OFF_ROUTE_RESCAN_INTERVAL || computeDistanceBetween(location, this.lastFullScanLocation) >= OFF_ROUTE_RESCAN_DISTANCE;
    }

    update(location: GenericMapPos<LatLonKeys> & { horizontalAccuracy?: number; bearing?: number; speed?: number }, positions: MapPosVector<LatLonKeys>, now = Date.now()): OffRouteState {
        const tolerance = this.toleranceFor(location);
        // standing still, the reported heading is noise and would score the segments at random
        const bearing = location.speed >= MIN_BEARING_SPEED && location.bearing >= 0 ? location.bearing : undefined;
        let best = findClosestOnRoute(location, positions, { fromIndex: this.lastOnPathIndex, bearing, maxAhead: MAX_PROJECTION_LOOKAHEAD });
        if ((!best || best.distanceFromRoute > tolerance) && this.lastOnPathIndex !== -1 && this.shouldFullScan(location, now)) {
            // out of the window: either we left the route, or we rejoined it somewhere else entirely
            this.lastFullScanTime = now;
            this.lastFullScanLocation = location;
            const full = findClosestOnRoute(location, positions, { bearing });
            // only a real rejoin is worth leaving the neighbourhood for. Walking away from the route
            // often ends up nearer some later part of it — a switchback above, the way back down — and
            // taking that as progress would jump the user kilometres forward for stepping aside
            if (full && full.distanceFromRoute <= tolerance && (!best || full.distanceFromRoute < best.distanceFromRoute)) {
                best = full;
            }
        }
        if (!best) {
            return {
                onPathIndex: this.lastOnPathIndex,
                distanceToIndex: this.lastDistanceToIndex,
                closestIndex: -1,
                distanceFromRoute: Number.POSITIVE_INFINITY,
                offRoute: this.mOffRoute,
                stale: this.mOffRoute,
                offRouteSince: this.mOffRouteSince
            };
        }

        if (best.distanceFromRoute <= tolerance) {
            this.offFixes = 0;
            this.mOffRoute = false;
            this.mOffRouteSince = 0;
            this.lastOnPathIndex = best.index;
            this.lastDistanceToIndex = best.distanceToIndex;
        } else {
            // every fix counts, moving or not: standing away from the route is being away from it, and
            // requiring movement meant a navigation started off route was never told so
            this.offFixes++;
            const requiredFixes = this.getOptions().fixes ?? 1;
            if (!this.mOffRoute && (this.offFixes >= requiredFixes || best.distanceFromRoute > tolerance * OFF_ROUTE_OBVIOUS_RATIO)) {
                this.mOffRoute = true;
                this.mOffRouteSince = now;
            }
            if (!this.mOffRoute) {
                // still only a suspicion: keep following the projection, so a wobbly fix on a narrow
                // path does not freeze the distance to the next maneuver every few seconds
                this.lastOnPathIndex = best.index;
                this.lastDistanceToIndex = best.distanceToIndex;
            }
        }

        return {
            onPathIndex: this.lastOnPathIndex,
            distanceToIndex: this.lastDistanceToIndex,
            closestIndex: best.index,
            distanceFromRoute: best.distanceFromRoute,
            offRoute: this.mOffRoute,
            stale: this.mOffRoute,
            offRouteSince: this.mOffRouteSince
        };
    }
}

/** meters of extra road that make a maneuver too far to be worth heading back to rather than the route itself */
const REJOIN_MANEUVER_MAX_EXTRA = 500;

export interface RejoinTarget {
    /** index in the route positions the user is being sent back to */
    index: number;
    position: GenericMapPos<LatLonKeys>;
    /** set when the target is a maneuver of the route rather than a plain point on it */
    maneuver?: RouteInstruction;
}

/**
 * meters of route between two of its vertices. `maxDistance` stops the walk as soon as the answer is
 * known to be over it, which is what every caller here actually asks — a maneuver 40 km up the track
 * would otherwise cost thousands of distances on every position.
 */
export function distanceAlong(positions: MapPosVector<LatLonKeys>, fromIndex: number, toIndex: number, maxDistance = Number.POSITIVE_INFINITY) {
    let distance = 0;
    const end = Math.min(toIndex, positions.size() - 1);
    for (let index = Math.max(fromIndex, 0); index < end; index++) {
        distance += computeDistanceBetween(fromNativeMapPos(positions.get(index)), fromNativeMapPos(positions.get(index + 1)));
        if (distance > maxDistance) {
            return distance;
        }
    }
    return distance;
}

/**
 * Where to send a user who left the route.
 *
 * The next maneuver is the useful answer — rejoining a route between two maneuvers means being told to
 * do nothing until the turn anyway — but only while it is near: on a track whose maneuvers are
 * kilometres apart, being pointed at one of them instead of the path a hundred meters away is wrong.
 * So the closest point of the route wins whenever the maneuver is much further along than it.
 */
export function chooseRejoinTarget({
    closestIndex = -1,
    fromIndex,
    instructions,
    positions
}: {
    positions: MapPosVector<LatLonKeys>;
    instructions?: RouteInstruction[];
    /** last index the user was on the route at */
    fromIndex: number;
    /** closest index to where they are now, which may be further along if they cut a corner */
    closestIndex?: number;
}): RejoinTarget {
    const size = positions?.size() ?? 0;
    if (size < 2) {
        return null;
    }
    // never send anyone backwards: the furthest along of the two is the honest starting point
    const baseIndex = Math.min(Math.max(fromIndex, closestIndex, 0), size - 1);
    const maneuver = instructions?.find((instruction) => instruction.index >= baseIndex);
    if (maneuver) {
        const maneuverIndex = Math.min(maneuver.index, size - 1);
        if (distanceAlong(positions, baseIndex, maneuverIndex, REJOIN_MANEUVER_MAX_EXTRA) <= REJOIN_MANEUVER_MAX_EXTRA) {
            return { index: maneuverIndex, position: fromNativeMapPos(positions.get(maneuverIndex)), maneuver };
        }
    }
    return { index: baseIndex, position: fromNativeMapPos(positions.get(baseIndex)) };
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
        if (route?.totalTime > 0 && route.totalDistance > 0) {
            result.remainingTime = (route.totalTime * result.remainingDistance) / route.totalDistance;
        }
        const stepIndex = route?.waypoints?.filter((waypoint) => waypoint.properties?.showOnMap).find((waypoint) => waypoint.properties.index > onPathIndex)?.properties?.index;
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
