import type { LineString } from 'geojson';
import type { IItem, RouteInstruction } from '~/models/Item';
import { packageService } from '~/services/PackageService';
import type { OffRouteState, RouteProgress } from '~/utils/navigation';
import { computeRouteProgress, findClosestOnRoute } from '~/utils/navigation';
import { type MapPos, distanceToEnd, toPosition } from '~/utils/geo';

/**
 * Kept beside the route rather than spliced in: the navigated item is the user's own, often saved,
 * route, and a reroute must not rewrite its geometry, profile, stats or maneuver indices.
 */
export interface NavigationDetour {
    positions: MapPos[];
    instructions: RouteInstruction[];
    /** index in the *base* positions the detour comes back onto the route at */
    rejoinIndex: number;
    totalDistance: number;
    totalTime: number;
}

export function positionsToGeoJSONLine(positions: MapPos[]): LineString {
    if (!positions || positions.length < 2) {
        return null;
    }
    return { type: 'LineString', coordinates: positions.map(toPosition) };
}

/**
 * The route navigation follows, *not* the selected item. Never persisted: the base item is read-only
 * and a full reroute swaps in an in-memory one. `RouteProgress.onPathIndex` always refers to the base.
 */
export class NavigationRoute {
    positions: MapPos[];
    detour: NavigationDetour = null;
    /** the route the user picked, kept when a full reroute replaced the base */
    originalItem: IItem = null;

    constructor(public item: IItem) {
        this.positions = packageService.getRouteItemPoses(item);
    }

    /** The polyline the user is actually on, which the projection has to run against. */
    get activePositions() {
        return this.detour?.positions ?? this.positions;
    }
    get hasDetour() {
        return !!this.detour;
    }
    get destination(): MapPos {
        return this.positions?.length ? this.positions[this.positions.length - 1] : null;
    }

    setDetour(detour: NavigationDetour) {
        this.detour = detour;
    }
    clearDetour() {
        this.detour = null;
    }

    /** `positions` skips re-parsing a geometry the caller already has natively */
    replaceBase(item: IItem, positions?: MapPos[]) {
        this.originalItem = this.originalItem ?? this.item;
        this.item = item;
        this.positions = positions ?? packageService.getRouteItemPoses(item);
        this.detour = null;
    }

    /** meters of base route left from `index` to the end */
    remainingBaseDistance(index: number) {
        return index >= 0 ? distanceToEnd(index, this.positions) : 0;
    }

    /**
     * On a detour, maneuvers and distance ahead come from the detour, but `onPathIndex` stays a base
     * index (the rejoin point): the elevation chart, ascents and surface preview index the base route.
     */
    progressFrom(state: OffRouteState, location: MapPos): RouteProgress {
        if (state.onPathIndex === -1) {
            return { onPathIndex: -1, offRoute: state.offRoute, closestIndex: state.closestIndex, distanceFromRoute: state.distanceFromRoute };
        }
        const detour = this.detour;
        const progress = computeRouteProgress({
            item: detour ? { route: { totalTime: detour.totalTime, totalDistance: detour.totalDistance }, instructions: detour.instructions } : this.item,
            location,
            positions: this.activePositions,
            onPathIndex: state.onPathIndex,
            // a stale index is not where the user is, so the measured distance to it means nothing
            distanceToOnPathIndex: state.stale ? undefined : state.distanceToIndex,
            computeRemaining: true,
            computeInstruction: true
        });
        progress.offRoute = state.offRoute;
        progress.stale = state.stale;
        progress.closestIndex = state.closestIndex;
        progress.distanceFromRoute = state.distanceFromRoute;
        if (detour) {
            const baseDistance = this.remainingBaseDistance(detour.rejoinIndex);
            const baseRoute = this.item.route;
            progress.detourIndex = state.onPathIndex;
            progress.onDetour = true;
            progress.onPathIndex = detour.rejoinIndex;
            progress.remainingDistance = (progress.remainingDistance ?? 0) + baseDistance;
            if (baseRoute?.totalTime > 0 && baseRoute.totalDistance > 0) {
                progress.remainingTime = (progress.remainingTime ?? 0) + (baseRoute.totalTime * baseDistance) / baseRoute.totalDistance;
            } else {
                progress.remainingTime = undefined;
            }
            // waypoint steps are base indices, which say nothing while we are off the base polyline
            progress.remainingDistanceToStep = undefined;
        }
        return progress;
    }

    /** being back on the base at or past the rejoin point covers the user cutting the detour short */
    shouldDropDetour(state: OffRouteState, location: MapPos, tolerance: number) {
        const detour = this.detour;
        if (!detour) {
            return false;
        }
        if (state.onPathIndex >= detour.positions.length - 1) {
            return true;
        }
        // only from the rejoin point on: matching the base *before* it would undo the detour
        const onBase = findClosestOnRoute(location, this.positions, { fromIndex: detour.rejoinIndex });
        return !!onBase && onBase.distanceFromRoute <= tolerance;
    }
}
