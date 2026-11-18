import type { Geometry } from 'geojson';
import { stampNow } from './departure';
import { geometryKey } from './geometryKey';
import type { Activity, AnalysisInputs, Departure, Pace, RouteAnalysis } from './types';

export const ANALYSIS_VERSION = 1;

export const DEFAULT_PACE: AnalysisInputs['pace'] = { multiplier: 1, stopsMinPerHour: 0, model: 'proportional' };

function isAnalysis(value: any): value is RouteAnalysis {
    const { inputs } = value ?? {};
    return (
        value?.v === ANALYSIS_VERSION &&
        typeof inputs?.geometryKey === 'string' &&
        typeof inputs.departure?.mode === 'string' &&
        typeof inputs.pace?.multiplier === 'number' &&
        typeof value.layers === 'object' &&
        value.layers !== null
    );
}

/** The stored column. Anything unreadable, from another version or missing what the checks read reads as no analysis. */
export function parseAnalysis(raw: string | null | undefined): RouteAnalysis | null {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        return isAnalysis(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function createAnalysis(geometry: Geometry, activity?: Activity): RouteAnalysis {
    return {
        v: ANALYSIS_VERSION,
        inputs: { activity, departure: { mode: 'now' }, pace: { ...DEFAULT_PACE }, geometryKey: geometryKey(geometry) },
        layers: {}
    };
}

/**
 * Call it with the geometry about to be saved. An edited route drops every layer and the recording
 * (both are keyed by vertex) but keeps what the user chose: activity, departure, pace.
 */
export function reconcileAnalysis(analysis: RouteAnalysis | null | undefined, geometry: Geometry): RouteAnalysis | null {
    if (!analysis) {
        return null;
    }
    const key = geometryKey(geometry);
    if (analysis.inputs.geometryKey === key) {
        return analysis;
    }
    return { v: analysis.v, inputs: { ...analysis.inputs, geometryKey: key }, layers: {} };
}

/** Switching the activity invalidates the layers whose `inputsHash` includes it; that is for the freshness check to tell. */
export function withActivity(analysis: RouteAnalysis | null | undefined, geometry: Geometry, activity: Activity): RouteAnalysis {
    const base = reconcileAnalysis(analysis, geometry) ?? createAnalysis(geometry);
    return { ...base, inputs: { ...base.inputs, activity } };
}

/** The ride's start as the user set it. The route's zone, once known, stays: it is the route's, not the plan's. */
export function withDeparture(analysis: RouteAnalysis | null | undefined, geometry: Geometry, departure: Departure): RouteAnalysis {
    const base = reconcileAnalysis(analysis, geometry) ?? createAnalysis(geometry);
    const { tz, tzFromPhone, utcOffset } = base.inputs.departure;
    const zone = tz ? { tz, utcOffset, tzFromPhone } : {};
    return { ...base, inputs: { ...base.inputs, departure: { ...zone, ...departure } } };
}

/** A `now` departure stamped with the time, as the user pressed it or a layer was read in it. The same analysis when there is nothing to stamp. */
export function withNowStamp(analysis: RouteAnalysis, now: number): RouteAnalysis {
    const departure = stampNow(analysis.inputs.departure, now);
    return departure === analysis.inputs.departure ? analysis : { ...analysis, inputs: { ...analysis.inputs, departure } };
}

/** The user's pace: what is given changes, the rest stays. */
export function withPace(analysis: RouteAnalysis | null | undefined, geometry: Geometry, pace: Partial<Pick<Pace, 'multiplier' | 'stopsMinPerHour'>>): RouteAnalysis {
    const base = reconcileAnalysis(analysis, geometry) ?? createAnalysis(geometry);
    return { ...base, inputs: { ...base.inputs, pace: { ...base.inputs.pace, ...pace } } };
}

/** A ride that was done: its recording gives the timeline and its start. The route's zone, once known, stays. */
export function withRecording(analysis: RouteAnalysis | null | undefined, geometry: Geometry, recorded: NonNullable<RouteAnalysis['recorded']>): RouteAnalysis {
    const base = reconcileAnalysis(analysis, geometry) ?? createAnalysis(geometry);
    const { tz, tzFromPhone, utcOffset } = base.inputs.departure;
    const zone = tz ? { tz, utcOffset, tzFromPhone } : {};
    return { ...base, recorded, inputs: { ...base.inputs, departure: { ...zone, mode: 'recorded', at: recorded.startedAt }, pace: { ...base.inputs.pace, model: 'recorded' } } };
}

/**
 * A ride that was done, planned again: it leaves now at the usual pace. What was pinned for the day it was ridden (its weather) goes,
 * it says nothing of a ride that has not happened.
 */
export function withoutRecording(analysis: RouteAnalysis, geometry: Geometry): RouteAnalysis {
    const base = reconcileAnalysis(analysis, geometry) ?? createAnalysis(geometry);
    const { tz, tzFromPhone, utcOffset } = base.inputs.departure;
    const zone = tz ? { tz, utcOffset, tzFromPhone } : {};
    const { recorded: _recorded, ...rest } = base;
    const layers = Object.fromEntries(Object.entries(base.layers).filter(([, layer]) => !layer.pinned));
    return { ...rest, layers, inputs: { ...base.inputs, departure: { ...zone, mode: 'now' }, pace: { ...base.inputs.pace, model: DEFAULT_PACE.model } } };
}

/**
 * A route that was ridden at a time, with no recording to say how it went: it is timed as any route, from that start. What was read for
 * another time goes (a forecast says nothing of that day), what was pinned stays.
 */
export function withRidden(analysis: RouteAnalysis | null | undefined, geometry: Geometry, at: number): RouteAnalysis {
    const base = reconcileAnalysis(analysis, geometry) ?? createAnalysis(geometry);
    const { tz, tzFromPhone, utcOffset } = base.inputs.departure;
    const zone = tz ? { tz, utcOffset, tzFromPhone } : {};
    const { recorded: _recorded, ...rest } = base;
    const layers = Object.fromEntries(Object.entries(base.layers).filter(([id, layer]) => id !== 'weather' || layer.pinned));
    return { ...rest, layers, inputs: { ...base.inputs, departure: { ...zone, mode: 'recorded', at } } };
}
