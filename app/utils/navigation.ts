import { ApplicationSettings } from '@nativescript/core';
import { UNITS, convertDurationSeconds, convertValueToUnit, formatDuration, formatValue } from '~/helpers/formatter';
import { getRhumbLineBearing } from '~/helpers/geolib';
import { type AscentSegment, type Item, type Route, type RouteInstruction, type RouteProfile, RoutingAction } from '~/models/Item';
import { EARTH_RADIUS, type MapPos, TO_DEG, TO_RAD, computeDistanceBetween, distanceToEnd, isLocationOnPath } from '~/utils/geo';
import type { ValhallaProfile } from '~/utils/routing';

export const DEFAULT_LOCATION_DISTANCE_FROM_ROUTE = 15;
/** degrees past which a segment counts as going the other way, rather than merely bending away */
const OPPOSITE_SEGMENT_ANGLE = 120;
/** meters a segment going the other way is scored as further, so the right leg of an out and back wins */
const OPPOSITE_SEGMENT_PENALTY = 60;
/** m/s below which the reported heading is noise: standing still, it points anywhere */
const MIN_BEARING_SPEED = 1;
/** meters between two fixes past which the line between them is a better heading than none */
const MIN_DERIVED_BEARING_DISTANCE = 5;
/** ceiling on the meters of route ahead the projection may move to in one fix, whatever the speed */
const MAX_PROJECTION_LOOKAHEAD = 1000;
/** how much further than the plausible travel the projection is still allowed to reach, for a lost fix */
const PROJECTION_LOOKAHEAD_MARGIN = 100;
/** the projection may travel this many times the distance the speed says, so a burst is not cut off */
const PROJECTION_LOOKAHEAD_TOLERANCE = 3;
/** how many segments ahead of the last known position we look for the user */
export const DEFAULT_PROJECTION_WINDOW = 200;

/** every navigation button, so the controls and the actions row cannot end up different sizes */
export const NAVBUTTON_SIZE = 48;
/** the maneuver banner: its main line, then one line whose content depends on the state */
export const MANEUVER_VIEW_HEIGHT = 104;
/** the primary button */
export const NAVPRIMARY_SIZE = 52;
/** the buttons on the right of the map */
export const NAVRAIL_BUTTON_SIZE = 44;

/** full elevation chart and route stats, same heights the item sheet gives them */
export const ROUTE_PROFILE_HEIGHT = 155;
export const ROUTE_STATS_HEIGHT = 180;

/**
 * The sheet, top first: the bar (always), then one step per section. A section with nothing to show
 * is 0 and has no step. Lives here, not in the component, so the map can size the sheet without
 * bundling the navigation ui; both read it, so a step always ends where its section does.
 */
export function navigationSections(scale: number, { hasAhead, hasProfile, hasStats }: { hasAhead: boolean; hasProfile: boolean; hasStats: boolean }) {
    return {
        bar: Math.round(112 * scale),
        trip: Math.round(72 * scale),
        ahead: hasAhead ? Math.round(80 * scale) : 0,
        // always there (astronomy), so the profile and stats can be fetched before they are shown
        actions: Math.round((NAVBUTTON_SIZE + 8) * scale),
        profile: hasProfile ? ROUTE_PROFILE_HEIGHT + 8 : 0,
        stats: hasStats ? ROUTE_STATS_HEIGHT + 8 : 0
    };
}

/** No 0 step: the bar is the only way out of navigation, so it can never be dismissed. */
export function navigationSheetSteps(sections: ReturnType<typeof navigationSections>) {
    const steps = [0];
    let total = 0;
    [sections.bar, sections.trip, sections.ahead, sections.actions, sections.profile, sections.stats].forEach((height) => {
        if (height > 0) {
            total += height;
            steps.push(total);
        }
    });
    return steps;
}

/** Value and unit kept apart so the UI can draw the unit smaller. */
export function splitDistance(meters: number): [number, string] {
    return convertValueToUnit(meters, meters < 1000 ? UNITS.Meters : UNITS.Kilometers);
}
export function splitElevation(meters: number): [number, string] {
    return convertValueToUnit(meters, UNITS.Meters);
}
/** takes km/h, the unit Session stores speeds in */
export function splitSpeed(speedKmh: number): [number, string] {
    return convertValueToUnit(speedKmh, UNITS.SpeedKm);
}
export function formatSpeed(speedKmh: number) {
    return formatValue(speedKmh, UNITS.SpeedKm);
}

export { formatDuration as formatNavigationDuration };

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

/** The climb the user is inside of right now, null when between climbs. */
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
    /** how much road past the maneuver stays in frame when the camera zooms onto it */
    maneuverFrameRatio: number;
    /** the user's own multiplier on the framed distance, 1 leaving the computation as it comes */
    zoomFactor?: number;
}

/**
 * Meters of road ahead to frame: speed sets the baseline, the next maneuver widens or tightens it,
 * and dense maneuvers only ever tighten it.
 */
export function computeNavigationLookAhead({
    denseManeuverDistance,
    distanceToFollowingInstruction,
    distanceToNextInstruction,
    lookAheadSeconds,
    maneuverFrameRatio,
    maneuverVisibleDistance,
    maxLookAhead,
    minLookAhead,
    speed,
    zoomFactor = 1
}: NavigationLookAheadOptions) {
    const hasManeuver = distanceToNextInstruction >= 0;
    // the floor keeps a slow speed from collapsing the view onto the user's own dot
    let lookAhead = Math.max(Math.max(speed, 0) * lookAheadSeconds, minLookAhead);

    if (hasManeuver && distanceToNextInstruction <= maneuverVisibleDistance) {
        lookAhead = Math.max(lookAhead, distanceToNextInstruction * maneuverFrameRatio);
    }
    if (hasManeuver) {
        // never frame much more road than the maneuver itself once we are nearly on it
        lookAhead = Math.min(lookAhead, Math.max(distanceToNextInstruction * maneuverFrameRatio, minLookAhead));
    }
    const clustered = hasManeuver && distanceToFollowingInstruction >= 0 && distanceToFollowingInstruction < denseManeuverDistance;
    if (clustered) {
        lookAhead = Math.min(lookAhead, distanceToNextInstruction + distanceToFollowingInstruction);
    }
    // the user's factor is clamped too: it tunes the result, it does not escape the bounds
    return Math.min(Math.max(lookAhead * (zoomFactor > 0 ? zoomFactor : 1), minLookAhead), maxLookAhead);
}

/** The settings hold the pedestrian figures; this scales them per travel mode. */
export interface NavigationProfileTuning {
    /** multiplies the distance settings: min/max look ahead, maneuver visible, dense maneuver */
    distance: number;
    /** m/s under which the framing rule counts the user as going slow */
    slowSpeed: number;
    /** meters past which a leg counts as a long stretch, ie not worth framing whole while crawling */
    longStretch: number;
}

const PEDESTRIAN_TUNING: NavigationProfileTuning = { distance: 1, slowSpeed: 0.7, longStretch: 1000 };
const PROFILE_TUNINGS: { [key: string]: NavigationProfileTuning } = {
    pedestrian: PEDESTRIAN_TUNING,
    bicycle: { distance: 2.5, slowSpeed: 2.5, longStretch: 3000 },
    car: { distance: 5, slowSpeed: 8, longStretch: 8000 },
    auto: { distance: 5, slowSpeed: 8, longStretch: 8000 },
    bus: { distance: 5, slowSpeed: 8, longStretch: 8000 },
    truck: { distance: 5, slowSpeed: 8, longStretch: 8000 },
    motorcycle: { distance: 5, slowSpeed: 8, longStretch: 8000 }
};

/** Walking is the safe default: it frames the least road, so an unknown profile cannot overshoot. */
export function navigationProfileTuning(profile?: ValhallaProfile): NavigationProfileTuning {
    return PROFILE_TUNINGS[profile] ?? PEDESTRIAN_TUNING;
}

export interface RouteProgress {
    /** index in the route polyline the location snapped to, -1 when we never matched the route */
    onPathIndex: number;
    /** true once the user is confirmed away from the route, see `OffRouteDetector` */
    offRoute?: boolean;
    /** meters from the user to the closest point of the route, whatever the state */
    distanceFromRoute?: number;
    /** closest route vertex even while off route, unlike `onPathIndex`: what a rejoin target is picked from */
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
    /** gap between `instruction` and the one after it, `undefined` when it is the last one */
    distanceToFollowingInstruction?: number;
    /** the user is following a reroute leg, so `onPathIndex` is the point it rejoins the route at */
    onDetour?: boolean;
    /** index along the detour polyline, only set while `onDetour` */
    detourIndex?: number;
}

/** Satisfied by an `Item` and by a detour leg, which is not an item and must never be turned into one. */
export interface RouteProgressSource {
    route?: Route;
    instructions?: RouteInstruction[];
}

export interface ComputeRouteProgressOptions {
    item: RouteProgressSource;
    location: MapPos;
    positions: MapPos[];
    onPathIndex: number;
    computeRemaining?: boolean;
    computeInstruction?: boolean;
    /**
     * meters to `positions[onPathIndex]` when already projected; else the straight line to that
     * vertex is used, which overshoots off the polyline
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
 * Closest segment, not the first within tolerance like `isLocationOnPath`: where a route passes near
 * itself the first match can be the other leg. Searching a window ahead keeps progress monotonic.
 */
export function findClosestOnRoute(
    location: MapPos,
    positions: MapPos[],
    { bearing, fromIndex = -1, maxAhead = Number.POSITIVE_INFINITY, window = DEFAULT_PROJECTION_WINDOW }: { fromIndex?: number; window?: number; bearing?: number; maxAhead?: number } = {}
): RouteProjection {
    const size = positions.length;
    if (size < 2) {
        return null;
    }
    // one segment of slack behind, so a fix that lands just short of the last vertex still matches
    const start = fromIndex >= 0 ? Math.max(0, fromIndex - 2) : 0;
    const end = fromIndex >= 0 ? Math.min(size - 1, fromIndex + window) : size - 1;
    const useBearing = bearing >= 0;
    // the limit is "ahead of where we were": meaningless without a known position
    const limitAhead = fromIndex >= 0 ? maxAhead : Number.POSITIVE_INFINITY;
    let best: RouteProjection = null;
    let bestScore = Number.POSITIVE_INFINITY;
    let ahead = 0;
    for (let index = start; index < end; index++) {
        const from = positions[index];
        const to = positions[index + 1];
        const projection = projectOnSegment(location.lat, location.lon, from.lat, from.lon, to.lat, to.lon);
        // a window counted in vertices is kilometres long on a sparse track: stepping off the route
        // there would match a piece of it the user has not walked yet and read as progress
        ahead += projection.segmentLength;
        if (best && ahead > limitAhead) {
            break;
        }
        // the two legs of an out and back are the same segments: only the heading tells them apart,
        // so a segment heading against the user is scored as further away
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
    location: MapPos,
    positions: MapPos[],
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
 * Needs several confirming fixes unless obviously off, scales the tolerance with reported accuracy,
 * and keeps the last on-route index while off route: remaining figures and rejoin are measured from it.
 */
export class OffRouteDetector {
    private lastOnPathIndex = -1;
    private lastDistanceToIndex = 0;
    private offFixes = 0;
    /** consecutive fixes back inside the tolerance, so returning is as hysteretic as leaving */
    private onFixes = 0;
    private mOffRoute = false;
    private mOffRouteSince = 0;
    private lastFullScanTime = 0;
    private lastFullScanLocation: MapPos = null;
    private lastUpdateTime = 0;
    private lastSpeed = 0;
    /** position the derived heading is measured from, only moved once the user has left it behind */
    private bearingAnchor: MapPos = null;
    private derivedBearing = -1;

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
        this.onFixes = 0;
        this.mOffRoute = false;
        this.mOffRouteSince = 0;
        this.lastFullScanTime = 0;
        this.lastFullScanLocation = null;
        this.lastUpdateTime = 0;
        this.lastSpeed = 0;
        this.bearingAnchor = null;
        this.derivedBearing = -1;
    }

    /** Restarts from a known index, for when the route itself changed under us (a reroute). */
    resetTo(onPathIndex: number) {
        this.reset();
        this.lastOnPathIndex = onPathIndex;
    }

    /** meters this fix is allowed to be from the route before it counts against us */
    toleranceFor(location: MapPos & { horizontalAccuracy?: number }) {
        const base = this.getOptions().distance ?? DEFAULT_LOCATION_DISTANCE_FROM_ROUTE;
        const accuracy = location.horizontalAccuracy > 0 ? location.horizontalAccuracy : 0;
        return Math.min(Math.max(base + accuracy, base), Math.max(MAX_OFF_ROUTE_TOLERANCE, base));
    }

    /**
     * Below MIN_BEARING_SPEED the reported heading is noise, but a slow walker still has a direction:
     * derive it from the ground covered, else the projection can snap onto the other leg.
     */
    private bearingFor(location: MapPos & { bearing?: number; speed?: number }) {
        if (location.speed >= MIN_BEARING_SPEED && location.bearing >= 0) {
            this.bearingAnchor = location;
            this.derivedBearing = -1;
            return location.bearing;
        }
        if (!this.bearingAnchor) {
            this.bearingAnchor = location;
        } else if (computeDistanceBetween(this.bearingAnchor, location) >= MIN_DERIVED_BEARING_DISTANCE) {
            this.derivedBearing = getRhumbLineBearing(this.bearingAnchor, location);
            this.bearingAnchor = location;
        }
        return this.derivedBearing >= 0 ? this.derivedBearing : undefined;
    }

    /**
     * Meters of route ahead the projection may move on this fix, bounded by speed so a nearby later
     * leg of the route cannot be picked.
     */
    private projectionLookAhead(location: { speed?: number }, now: number) {
        if (!this.lastUpdateTime) {
            return MAX_PROJECTION_LOOKAHEAD;
        }
        const elapsed = Math.max((now - this.lastUpdateTime) / 1000, 0);
        const speed = Math.max(location.speed > 0 ? location.speed : 0, this.lastSpeed);
        return Math.min(speed * elapsed * PROJECTION_LOOKAHEAD_TOLERANCE + PROJECTION_LOOKAHEAD_MARGIN, MAX_PROJECTION_LOOKAHEAD);
    }

    /** A full scan is the only way to notice a rejoin somewhere else, and the only expensive one. */
    private shouldFullScan(location: MapPos, now: number) {
        if (!this.lastFullScanLocation) {
            return true;
        }
        return now - this.lastFullScanTime >= OFF_ROUTE_RESCAN_INTERVAL || computeDistanceBetween(location, this.lastFullScanLocation) >= OFF_ROUTE_RESCAN_DISTANCE;
    }

    update(location: MapPos & { horizontalAccuracy?: number; bearing?: number; speed?: number }, positions: MapPos[], now = Date.now()): OffRouteState {
        const tolerance = this.toleranceFor(location);
        const bearing = this.bearingFor(location);
        const maxAhead = this.projectionLookAhead(location, now);
        this.lastUpdateTime = now;
        this.lastSpeed = location.speed > 0 ? location.speed : 0;
        let best = findClosestOnRoute(location, positions, { fromIndex: this.lastOnPathIndex, bearing, maxAhead });
        if ((!best || best.distanceFromRoute > tolerance) && this.lastOnPathIndex !== -1 && this.shouldFullScan(location, now)) {
            // out of the window: either we left the route, or we rejoined it somewhere else entirely
            this.lastFullScanTime = now;
            this.lastFullScanLocation = location;
            const full = findClosestOnRoute(location, positions, { bearing });
            // only a real rejoin: stepping aside often ends up nearer a later part of the route,
            // which would jump the user kilometres forward
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

        const requiredFixes = this.getOptions().fixes ?? 1;
        if (best.distanceFromRoute <= tolerance) {
            this.offFixes = 0;
            // coming back takes as many fixes as leaving, else a user on the tolerance edge flaps off
            // and on every fix (re-framing, re-arming the reroute, waking the screen)
            this.onFixes++;
            if (!this.mOffRoute || this.onFixes >= requiredFixes) {
                this.onFixes = 0;
                this.mOffRoute = false;
                this.mOffRouteSince = 0;
                this.lastOnPathIndex = best.index;
                this.lastDistanceToIndex = best.distanceToIndex;
            }
        } else {
            // every fix counts, moving or not, else a navigation started off route is never told so
            this.onFixes = 0;
            this.offFixes++;
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
    position: MapPos;
    /** set when the target is a maneuver of the route rather than a plain point on it */
    maneuver?: RouteInstruction;
}

/** meters of route between two of its vertices. `maxDistance` stops the walk once exceeded. */
export function distanceAlong(positions: MapPos[], fromIndex: number, toIndex: number, maxDistance = Number.POSITIVE_INFINITY) {
    let distance = 0;
    const end = Math.min(toIndex, positions.length - 1);
    for (let index = Math.max(fromIndex, 0); index < end; index++) {
        distance += computeDistanceBetween(positions[index], positions[index + 1]);
        if (distance > maxDistance) {
            return distance;
        }
    }
    return distance;
}

/** The next maneuver while it is near, else the closest point of the route (maneuvers can be km apart). */
export function chooseRejoinTarget({
    closestIndex = -1,
    fromIndex,
    instructions,
    positions
}: {
    positions: MapPos[];
    instructions?: RouteInstruction[];
    /** last index the user was on the route at */
    fromIndex: number;
    /** closest index to where they are now, which may be further along if they cut a corner */
    closestIndex?: number;
}): RejoinTarget {
    const size = positions?.length ?? 0;
    if (size < 2) {
        return null;
    }
    // never send anyone backwards: the furthest along of the two is the honest starting point
    const baseIndex = Math.min(Math.max(fromIndex, closestIndex, 0), size - 1);
    const maneuver = instructions?.find((instruction) => instruction.index >= baseIndex);
    if (maneuver) {
        const maneuverIndex = Math.min(maneuver.index, size - 1);
        if (distanceAlong(positions, baseIndex, maneuverIndex, REJOIN_MANEUVER_MAX_EXTRA) <= REJOIN_MANEUVER_MAX_EXTRA) {
            return { index: maneuverIndex, position: positions[maneuverIndex], maneuver };
        }
    }
    return { index: baseIndex, position: positions[baseIndex] };
}

/** Routes coming from OSM are not navigable: they have no instructions and no consistent direction. */
export function isNavigableRoute(item: Item) {
    return !!item?.route && !item.route.osmid;
}

export function getDistanceFromRouteSetting() {
    return ApplicationSettings.getNumber('location_distance_from_route', DEFAULT_LOCATION_DISTANCE_FROM_ROUTE);
}

/** Snaps a location onto a route polyline. Returns -1 when the location is further than `distanceFromRoute` meters from it. */
export function isLocationOnRoute(location: MapPos, positions: MapPos[], distanceFromRoute: number = getDistanceFromRouteSetting()) {
    return isLocationOnPath(location, positions, false, true, distanceFromRoute);
}

/** `computeRemaining` and `computeInstruction` are opt-in because both walk the polyline. */
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
        if (instructionIndex !== -1) {
            result.instructionIndex = instructionIndex;
            result.instruction = instructions[instructionIndex];
            let distanceToNextInstruction = distanceToOnPathIndex ?? computeDistanceBetween(location, positions[onPathIndex]);
            for (let index = onPathIndex; index < result.instruction.index; index++) {
                distanceToNextInstruction += computeDistanceBetween(positions[index], positions[index + 1]);
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
