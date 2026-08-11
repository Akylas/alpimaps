import { GenericMapPos, MapPosVector, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
import { ApplicationSettings } from '@nativescript/core';
import type { Item, RouteInstruction } from '~/models/Item';
import { computeDistanceBetween } from '~/utils/geo';

export const DEFAULT_LOCATION_DISTANCE_FROM_ROUTE = 15;

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
export function computeRouteProgress({ computeInstruction, computeRemaining, item, location, onPathIndex, positions }: ComputeRouteProgressOptions): RouteProgress {
    const result: RouteProgress = { onPathIndex };
    if (onPathIndex === -1) {
        return result;
    }
    const route = item.route;
    if (computeRemaining) {
        result.remainingDistance = distanceToEnd(onPathIndex, positions);
        result.remainingTime = (route.totalTime * result.remainingDistance) / route.totalDistance;
        const stepIndex = route.waypoints.filter((waypoint) => waypoint.properties.showOnMap).find((waypoint) => waypoint.properties.index > onPathIndex)?.properties?.index;
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
            let distanceToNextInstruction = computeDistanceBetween(location, fromNativeMapPos(positions.get(onPathIndex)));
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
