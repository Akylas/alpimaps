import { departurePassed } from './departure';
import { type AnalysisInputs, type Departure, LAYER_IDS, type Layer, type LayerId, type RouteAnalysis } from './types';

export type LayerState = 'absent' | 'queued' | 'running' | 'fresh' | 'aging' | 'stale' | 'inputs-changed' | 'offline-cached' | 'failed' | 'pinned';
export type LayerReason = 'departure-passed' | 'out-of-coverage' | 'offline' | 'rate-limited' | 'no-dem' | 'no-routing-package' | 'error';

export interface LayerStatus {
    state: LayerState;
    ageMs?: number;
    reason?: LayerReason;
    /** 0..1 when known, else indeterminate */
    progress?: number;
    /** An update would do something: it is not fresh, nothing is running, and it is not blocked by being offline. */
    canRefresh: boolean;
}

/** What the user sees: the internal states folded in three. */
export type FreshnessTier = 'fresh' | 'outdated' | 'unavailable';

/** `timeline` is not a stored layer but ages too: a planned departure goes by. */
export type StatusKey = LayerId | 'timeline';

const STATUS_KEYS: StatusKey[] = [...LAYER_IDS, 'timeline'];

/** The inputs a layer depends on. A change to one of them is what makes the layer `inputs-changed`. */
export type InputKey = 'geometry' | 'activity' | 'departure' | 'pace';

/**
 * Weather depends on the geometry only: a new departure or pace is re-read from the stored hourly
 * series, as long as the ride stays inside the fetched window (see `weatherCoverage`).
 */
export const LAYER_DEPENDENCIES: Record<StatusKey, InputKey[]> = {
    terrain: ['geometry'],
    risk: ['geometry', 'activity'],
    weather: ['geometry'],
    sun: ['geometry', 'departure', 'pace'],
    timeline: ['geometry', 'activity', 'departure', 'pace']
};

export function affectedLayers(changed: InputKey[]): StatusKey[] {
    return STATUS_KEYS.filter((key) => LAYER_DEPENDENCIES[key].some((dependency) => changed.includes(dependency)));
}

/** The time zone arrives with the first weather response: it does not change when the ride happens. */
function departureKey(departure: Departure) {
    return JSON.stringify({ mode: departure.mode, at: departure.at, days: departure.days, keepPast: departure.keepPast });
}

/** What changed between two sets of inputs. */
export function changedInputs(previous: AnalysisInputs, next: AnalysisInputs): InputKey[] {
    const changed: InputKey[] = [];
    if (previous.geometryKey !== next.geometryKey) {
        changed.push('geometry');
    }
    if (previous.activity?.kind !== next.activity?.kind) {
        changed.push('activity');
    }
    if (departureKey(previous.departure) !== departureKey(next.departure)) {
        changed.push('departure');
    }
    if (JSON.stringify(previous.pace) !== JSON.stringify(next.pace)) {
        changed.push('pace');
    }
    return changed;
}

export function hashParts(...parts: (string | number | undefined)[]): string {
    let hash = 2166136261;
    for (const char of parts.map((part) => part ?? '').join('|')) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    }
    return hash.toString(36);
}

/** What a layer is computed from beyond the shared inputs: DEM source, routing package date, request... */
export type LayerExtra = Record<string, string | number | undefined>;

/** Hash of exactly the inputs a layer depends on, stored in its provenance. Names the extras sorted, so order does not matter. */
export function layerInputsHash(layer: StatusKey, inputs: AnalysisInputs, extra: LayerExtra = {}): string {
    const parts: (string | number | undefined)[] = [layer];
    const dependencies = LAYER_DEPENDENCIES[layer];
    if (dependencies.includes('geometry')) {
        parts.push(inputs.geometryKey);
    }
    if (dependencies.includes('activity')) {
        parts.push(inputs.activity?.kind);
    }
    if (dependencies.includes('departure')) {
        parts.push(departureKey(inputs.departure));
    }
    if (dependencies.includes('pace')) {
        parts.push(JSON.stringify(inputs.pace));
    }
    Object.keys(extra)
        .sort()
        .forEach((name) => parts.push(`${name}=${extra[name]}`));
    return hashParts(...parts);
}

export function tierOf(state: LayerState): FreshnessTier {
    switch (state) {
        case 'fresh':
        case 'aging':
        case 'pinned':
            return 'fresh';
        case 'stale':
        case 'inputs-changed':
            return 'outdated';
        default:
            return 'unavailable';
    }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How old a weather fetch may be before it shows as aging, then as stale: the closer the ride, the shorter. */
export function weatherTtl(leadMs: number, navigating = false): { aging: number; stale: number } {
    if (navigating) {
        return { aging: 30 * MINUTE, stale: 60 * MINUTE };
    }
    if (leadMs <= DAY) {
        return { aging: HOUR, stale: 3 * HOUR };
    }
    if (leadMs <= 3 * DAY) {
        return { aging: 3 * HOUR, stale: 6 * HOUR };
    }
    return { aging: 6 * HOUR, stale: 12 * HOUR };
}

/**
 * The window to fetch the weather for, epoch seconds: the ride plus 3 h either side, rounded out to
 * UTC days, so the +/- 3 h shift of the departure and a floating `now` stay local.
 */
export function weatherCoverage(startAt: number, totalSec: number): { from: number; to: number } {
    const day = 86400;
    const start = startAt / 1000 - 3 * 3600;
    const end = startAt / 1000 + totalSec + 3 * 3600;
    return { from: Math.floor(start / day) * day, to: Math.ceil(end / day) * day };
}

/** A run in flight, or why the last one failed: what the pipeline reports for a layer. */
export type LayerRun = { state: 'queued' | 'running'; progress?: number } | { state: 'failed'; reason: LayerReason };

export interface FreshnessContext {
    now: number;
    inputs: AnalysisInputs;
    /** epoch ms the ride starts at and its length, from the live timeline */
    timeline: { startAt: number; totalSec: number };
    navigating?: boolean;
    /** the network is not available (or the user forced it off) */
    offline?: boolean;
    /** What each layer was last hashed with, see `layerInputsHash` */
    extras?: Partial<Record<LayerId, LayerExtra>>;
    /** A run in flight, or the reason the last one failed */
    runs?: Partial<Record<LayerId, LayerRun>>;
}

function statusOf(state: LayerState, extra: Partial<LayerStatus> = {}): LayerStatus {
    return { state, canRefresh: state !== 'fresh' && state !== 'queued' && state !== 'running' && state !== 'offline-cached', ...extra };
}

/** Where one stored layer stands. `layer` is absent when it was never computed. */
export function evaluateLayer(id: LayerId, layer: Layer<unknown> | undefined, context: FreshnessContext): LayerStatus {
    const run = context.runs?.[id];
    if (run && (run.state === 'queued' || run.state === 'running')) {
        return { state: run.state, progress: run.progress, ageMs: layer ? context.now - layer.prov.computedAt : undefined, canRefresh: false };
    }
    const ageMs = layer ? context.now - layer.prov.computedAt : undefined;
    if (run?.state === 'failed') {
        return statusOf('failed', { ageMs, reason: run.reason });
    }
    if (!layer) {
        return statusOf('absent');
    }
    if (layer.pinned) {
        return statusOf('pinned', { ageMs });
    }
    if (layer.prov.inputsHash !== layerInputsHash(id, context.inputs, context.extras?.[id])) {
        return statusOf('inputs-changed', { ageMs });
    }
    if (id !== 'weather') {
        return statusOf('fresh', { ageMs });
    }
    const { startAt, totalSec } = context.timeline;
    const coverage = layer.prov.coverage;
    if (coverage && (startAt / 1000 < coverage.from || startAt / 1000 + totalSec > coverage.to)) {
        return statusOf('inputs-changed', { ageMs, reason: 'out-of-coverage' });
    }
    const ttl = weatherTtl(startAt - context.now, context.navigating);
    if (ageMs < ttl.aging) {
        return statusOf('fresh', { ageMs });
    }
    // an old forecast with no network: what is shown is what there is
    if (context.offline) {
        return statusOf('offline-cached', { ageMs, reason: 'offline' });
    }
    return statusOf(ageMs < ttl.stale ? 'aging' : 'stale', { ageMs });
}

/** The ride's clock: stale once the planned departure went by, unless the ride is under way or over. */
export function evaluateTimeline(context: FreshnessContext): LayerStatus {
    const { departure } = context.inputs;
    const rideOver = departure.at !== undefined && context.now > departure.at + context.timeline.totalSec * 1000;
    if (departurePassed(departure, context.now) && !context.navigating && !rideOver) {
        return statusOf('stale', { reason: 'departure-passed' });
    }
    return statusOf('fresh');
}

export function evaluateAnalysis(analysis: RouteAnalysis | null | undefined, context: FreshnessContext): Record<StatusKey, LayerStatus> {
    const layers = analysis?.layers ?? {};
    return {
        terrain: evaluateLayer('terrain', layers.terrain, context),
        risk: evaluateLayer('risk', layers.risk, context),
        weather: evaluateLayer('weather', layers.weather, context),
        sun: evaluateLayer('sun', layers.sun, context),
        timeline: evaluateTimeline(context)
    };
}

/** What "refresh all" updates: outdated layers and failed ones, never a fresh one. */
export function layersToRefresh(statuses: Partial<Record<StatusKey, LayerStatus>>): StatusKey[] {
    return STATUS_KEYS.filter((key) => key !== 'timeline' && statuses[key]?.canRefresh && (tierOf(statuses[key].state) === 'outdated' || statuses[key].state === 'failed'));
}
