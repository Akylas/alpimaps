import { get, writable } from 'svelte/store';
import { type GeoLocation, SIMULATED_PROVIDER } from '~/handlers/GeoHandler';
import { getBGServiceInstance } from '~/services/BgService';
import { isNavigating, navigationItem } from '~/stores/navigationStore';
import { EARTH_RADIUS, type MapPos, bearingBetween, computeDistanceBetween, geometryCoordinates, toDegrees, toRadians } from '~/utils/geo';

/** Dev only: drives navigation along its own route, so it can be tried on a simulator or at a desk. */
const TICK_MS = 1000;
/** how far to the right of the route an "off route" fix lands, past the default off-route distance */
const OFF_ROUTE_OFFSET = 60;
/** a jump lands this far before the maneuver, so its approach can be watched */
const MANEUVER_LEAD = 150;
export const SIMULATED_SPEEDS = [1, 3, 5, 10, 18, 30, 50, 90, 150];

export interface RouteSimulation {
    speedKmh: number;
    paused: boolean;
    offRoute: boolean;
}
export const routeSimulation = writable<RouteSimulation>(null);

let timer: ReturnType<typeof setInterval>;
let path: MapPos[] = [];
/** metres from the start to each point of `path` */
let cumulative: number[] = [];
/** metres from the start to each maneuver */
let maneuvers: number[] = [];
let travelled = 0;

function offset(position: MapPos, bearing: number, meters: number): MapPos {
    const angle = meters / EARTH_RADIUS;
    const lat = toRadians(position.lat);
    const lon = toRadians(position.lon);
    const heading = toRadians(bearing);
    const newLat = Math.asin(Math.sin(lat) * Math.cos(angle) + Math.cos(lat) * Math.sin(angle) * Math.cos(heading));
    const newLon = lon + Math.atan2(Math.sin(heading) * Math.sin(angle) * Math.cos(lat), Math.cos(angle) - Math.sin(lat) * Math.sin(newLat));
    return { lat: toDegrees(newLat), lon: toDegrees(newLon), altitude: position.altitude };
}

function loadPath() {
    const item = get(navigationItem);
    path = item?.geometry ? geometryCoordinates(item.geometry).map((coordinates) => ({ lon: coordinates[0], lat: coordinates[1], altitude: coordinates[2] })) : [];
    cumulative = [0];
    for (let index = 1; index < path.length; index++) {
        cumulative.push(cumulative[index - 1] + computeDistanceBetween(path[index - 1], path[index]));
    }
    maneuvers = (item?.instructions ?? []).map((instruction) => cumulative[instruction.index]).filter((distance) => distance !== undefined);
    travelled = 0;
}

function routeLength() {
    return cumulative[cumulative.length - 1] ?? 0;
}

function emit(simulation: RouteSimulation) {
    // the segment being walked: from point index - 1 to point index
    const next = cumulative.findIndex((distance) => distance > travelled);
    const index = Math.max(next === -1 ? path.length - 1 : next, 1);
    const from = path[index - 1];
    const to = path[index];
    const segment = cumulative[index] - cumulative[index - 1];
    const ratio = segment > 0 ? Math.min((travelled - cumulative[index - 1]) / segment, 1) : 1;
    const bearing = bearingBetween(from, to);
    let position: MapPos = {
        lat: from.lat + (to.lat - from.lat) * ratio,
        lon: from.lon + (to.lon - from.lon) * ratio,
        altitude: from.altitude !== undefined && to.altitude !== undefined ? from.altitude + (to.altitude - from.altitude) * ratio : undefined
    };
    if (simulation.offRoute) {
        position = offset(position, bearing + 90, OFF_ROUTE_OFFSET);
    }
    const location: GeoLocation = {
        ...position,
        speed: simulation.paused ? 0 : simulation.speedKmh / 3.6,
        bearing,
        horizontalAccuracy: 5,
        verticalAccuracy: 5,
        timestamp: Date.now(),
        provider: SIMULATED_PROVIDER
    };
    getBGServiceInstance().geoHandler.onLocation(location);
}

function tick() {
    const simulation = get(routeSimulation);
    if (!simulation || !get(isNavigating) || path.length < 2) {
        stopRouteSimulation();
        return;
    }
    if (!simulation.paused) {
        travelled = Math.min(travelled + (simulation.speedKmh / 3.6) * (TICK_MS / 1000), routeLength());
    }
    emit(simulation);
    // held at the end rather than stopped: arrival still has to be looked at
    if (travelled >= routeLength() && !simulation.paused) {
        routeSimulation.set({ ...simulation, paused: true });
    }
}

export function startRouteSimulation(speedKmh = 18) {
    if (timer) {
        return;
    }
    loadPath();
    getBGServiceInstance().geoHandler.simulating = true;
    routeSimulation.set({ speedKmh, paused: false, offRoute: false });
    timer = setInterval(tick, TICK_MS);
    tick();
}

function update(change: (simulation: RouteSimulation) => RouteSimulation) {
    const simulation = get(routeSimulation);
    if (simulation) {
        routeSimulation.set(change(simulation));
    }
}

/** One step along SIMULATED_SPEEDS, faster for a positive direction. */
export function changeSimulatedSpeed(direction: 1 | -1) {
    update((simulation) => {
        const current = SIMULATED_SPEEDS.findIndex((speed) => speed >= simulation.speedKmh);
        const index = Math.min(Math.max((current === -1 ? SIMULATED_SPEEDS.length - 1 : current) + direction, 0), SIMULATED_SPEEDS.length - 1);
        return { ...simulation, speedKmh: SIMULATED_SPEEDS[index] };
    });
}

export function toggleSimulationPaused() {
    update((simulation) => ({ ...simulation, paused: !simulation.paused }));
}

export function toggleSimulatedOffRoute() {
    update((simulation) => ({ ...simulation, offRoute: !simulation.offRoute }));
    emitNow();
}

/** Lands MANEUVER_LEAD before the next maneuver, or before the one before the current approach. */
export function jumpToManeuver(direction: 1 | -1) {
    const target = direction > 0 ? maneuvers.find((distance) => distance - MANEUVER_LEAD > travelled + 1) : [...maneuvers].reverse().find((distance) => distance - MANEUVER_LEAD < travelled - 1);
    travelled = target === undefined ? (direction > 0 ? Math.max(routeLength() - MANEUVER_LEAD, 0) : 0) : Math.max(target - MANEUVER_LEAD, 0);
    emitNow();
}

function emitNow() {
    const simulation = get(routeSimulation);
    if (simulation && path.length >= 2) {
        emit(simulation);
    }
}

export function stopRouteSimulation() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    const geoHandler = getBGServiceInstance()?.geoHandler;
    if (geoHandler) {
        geoHandler.simulating = false;
    }
    routeSimulation.set(null);
}
