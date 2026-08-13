import { GenericMapPos, MapPosVector, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
import { distanceToEnd } from '@nativescript-community/ui-carto/utils';
import type { LineString } from 'geojson';
import { getMapContext } from '~/mapModules/MapModule';
import type { IItem, RouteInstruction } from '~/models/Item';
import { packageService } from '~/services/PackageService';
import type { OffRouteState, RouteProgress } from '~/utils/navigation';
import { computeRouteProgress, findClosestOnRoute } from '~/utils/navigation';

/**
 * A leg the user is being sent along to get back to the route.
 *
 * It is kept beside the route rather than spliced into it on purpose: the item being navigated is the
 * user's own, often saved, route, and a reroute must not rewrite its geometry, its profile, its stats
 * or its maneuver indices. Once the user is back on the route the detour is simply dropped.
 */
export interface NavigationDetour {
    positions: MapPosVector<LatLonKeys>;
    instructions: RouteInstruction[];
    /** index in the *base* positions the detour comes back onto the route at */
    rejoinIndex: number;
    totalDistance: number;
    totalTime: number;
}

let writer: GeoJSONGeometryWriter<LatLonKeys>;

/** GeoJSON for a native position vector, for the layers that draw a detour or a connector. */
export function positionsToGeoJSONLine(positions: MapPosVector<LatLonKeys>): LineString {
    if (!positions || positions.size() < 2) {
        return null;
    }
    if (!writer) {
        writer = new GeoJSONGeometryWriter<LatLonKeys>({ sourceProjection: getMapContext().getProjection() });
    }
    return JSON.parse(writer.writeGeometry(new LineGeometry<LatLonKeys>({ poses: positions })));
}

/**
 * The route navigation is following, which is *not* the item the user selected.
 *
 * It holds the base route plus, when one is active, the detour that takes the user back onto it, and
 * knows how to express the user's position along whichever of the two they are on in terms the rest of
 * the app already understands (`RouteProgress`, whose `onPathIndex` always refers to the base).
 *
 * Nothing here is ever persisted: the base item is used read-only, and a full reroute replaces it with
 * an in-memory one while keeping the original for display.
 */
export class NavigationRoute {
    positions: MapPosVector<LatLonKeys>;
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
    /** where the route ends, ie what a full reroute has to route to */
    get destination(): GenericMapPos<LatLonKeys> {
        const size = this.positions?.size() ?? 0;
        return size ? fromNativeMapPos<LatLonKeys>(this.positions.get(size - 1)) : null;
    }

    setDetour(detour: NavigationDetour) {
        this.detour = detour;
    }
    clearDetour() {
        this.detour = null;
    }

    /**
     * Swaps the base for a freshly computed one, keeping the user's own route for the map.
     * `positions` skips re-parsing a geometry the caller already has natively.
     */
    replaceBase(item: IItem, positions?: MapPosVector<LatLonKeys>) {
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
     * Turns a projection onto the active polyline into progress along the whole navigation.
     *
     * On a detour the maneuvers and the distance ahead come from the detour, but everything the rest of
     * the app indexes by `onPathIndex` — the elevation chart, the ascents, the surface preview — is
     * about the base route, so `onPathIndex` stays a base index: the point the detour rejoins at.
     */
    progressFrom(state: OffRouteState, location: GenericMapPos<LatLonKeys>): RouteProgress {
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

    /**
     * Whether the detour has done its job. Reaching its last vertex is the normal case; being back
     * within tolerance of the base at or past the rejoin point covers the user cutting the detour short.
     */
    shouldDropDetour(state: OffRouteState, location: GenericMapPos<LatLonKeys>, tolerance: number) {
        const detour = this.detour;
        if (!detour) {
            return false;
        }
        if (state.onPathIndex >= detour.positions.size() - 1) {
            return true;
        }
        // only from the rejoin point on: matching the base *before* it would undo the detour
        const onBase = findClosestOnRoute(location, this.positions, { fromIndex: detour.rejoinIndex });
        return !!onBase && onBase.distanceFromRoute <= tolerance;
    }
}
