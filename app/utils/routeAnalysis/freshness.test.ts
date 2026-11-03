import { describe, expect, it } from 'vitest';
import {
    type FreshnessContext,
    affectedLayers,
    changedInputs,
    evaluateAnalysis,
    evaluateLayer,
    evaluateTimeline,
    layerInputsHash,
    layersToRefresh,
    tierOf,
    weatherCoverage,
    weatherTtl
} from './freshness';
import { DEFAULT_PACE } from './storage';
import type { AnalysisInputs, Layer, LayerId, RouteAnalysis } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);

function inputs(overrides: Partial<AnalysisInputs> = {}): AnalysisInputs {
    return { activity: { kind: 'bike', origin: 'route' }, departure: { mode: 'now' }, pace: { ...DEFAULT_PACE }, geometryKey: 'k', ...overrides };
}

function context(overrides: Partial<FreshnessContext> = {}): FreshnessContext {
    return { now: NOW, inputs: inputs(), timeline: { startAt: NOW, totalSec: 2 * 3600 }, ...overrides };
}

function layerFor(id: LayerId, ctx: FreshnessContext, computedAgo = 0, overrides: Partial<Layer<unknown>['prov']> = {}): Layer<unknown> {
    const { startAt, totalSec } = ctx.timeline;
    return {
        data: {},
        prov: {
            computedAt: ctx.now - computedAgo,
            inputsHash: layerInputsHash(id, ctx.inputs, ctx.extras?.[id]),
            provider: 'test',
            quality: 'ok',
            coverage: id === 'weather' ? weatherCoverage(startAt, totalSec) : undefined,
            ...overrides
        }
    };
}

describe('weatherTtl', () => {
    it('shortens as the ride gets close', () => {
        expect(weatherTtl(6 * HOUR)).toEqual({ aging: HOUR, stale: 3 * HOUR });
        expect(weatherTtl(48 * HOUR)).toEqual({ aging: 3 * HOUR, stale: 6 * HOUR });
        expect(weatherTtl(100 * HOUR)).toEqual({ aging: 6 * HOUR, stale: 12 * HOUR });
    });
    it('has its own table during the ride, and for a ride that already started', () => {
        expect(weatherTtl(100 * HOUR, true)).toEqual({ aging: 30 * MINUTE, stale: HOUR });
        expect(weatherTtl(-2 * HOUR)).toEqual({ aging: HOUR, stale: 3 * HOUR });
    });
    it('puts the boundaries on the shorter side', () => {
        expect(weatherTtl(24 * HOUR).aging).toBe(HOUR);
        expect(weatherTtl(72 * HOUR).aging).toBe(3 * HOUR);
    });
});

describe('weatherCoverage', () => {
    it('covers the ride plus 3 h either side, rounded out to whole UTC days', () => {
        const coverage = weatherCoverage(Date.UTC(2026, 5, 1, 12, 0), 2 * 3600);
        expect(coverage.from).toBe(Date.UTC(2026, 5, 1) / 1000);
        expect(coverage.to).toBe(Date.UTC(2026, 5, 2) / 1000);
    });
    it('reaches the next day for a late ride', () => {
        const coverage = weatherCoverage(Date.UTC(2026, 5, 1, 22, 0), 2 * 3600);
        expect(coverage.to).toBe(Date.UTC(2026, 5, 3) / 1000);
    });
});

describe('layerInputsHash', () => {
    it('follows the dependencies of the layer only', () => {
        const base = inputs();
        const hash = (layer: LayerId, other: AnalysisInputs) => layerInputsHash(layer, other) === layerInputsHash(layer, base);
        const moved = inputs({ geometryKey: 'other' });
        const rescheduled = inputs({ departure: { mode: 'planned', at: NOW + HOUR } });
        const slower = inputs({ pace: { ...DEFAULT_PACE, multiplier: 1.2 } });
        const running = inputs({ activity: { kind: 'hike', origin: 'user' } });
        expect(['terrain', 'risk', 'weather', 'sun'].map((layer: LayerId) => hash(layer, moved))).toEqual([false, false, false, false]);
        expect(['terrain', 'risk', 'weather', 'sun'].map((layer: LayerId) => hash(layer, rescheduled))).toEqual([true, true, true, false]);
        expect(['terrain', 'risk', 'weather', 'sun'].map((layer: LayerId) => hash(layer, slower))).toEqual([true, true, true, false]);
        expect(['terrain', 'risk', 'weather', 'sun'].map((layer: LayerId) => hash(layer, running))).toEqual([true, false, true, true]);
    });
    it('ignores the activity subtype and the zone', () => {
        const base = inputs();
        const same = inputs({ activity: { kind: 'bike', subtype: 'road', origin: 'user' }, departure: { mode: 'now', tz: 'Europe/Paris', tzFromPhone: true } });
        expect(layerInputsHash('risk', same)).toBe(layerInputsHash('risk', base));
        expect(layerInputsHash('sun', same)).toBe(layerInputsHash('sun', base));
    });
    it('includes the extras, whatever their order', () => {
        const base = inputs();
        expect(layerInputsHash('terrain', base, { dem: 'a', step: 5 })).toBe(layerInputsHash('terrain', base, { step: 5, dem: 'a' }));
        expect(layerInputsHash('terrain', base, { dem: 'a' })).not.toBe(layerInputsHash('terrain', base, { dem: 'b' }));
    });
});

describe('what changed', () => {
    it('lists the changed inputs', () => {
        const base = inputs();
        expect(changedInputs(base, inputs())).toEqual([]);
        expect(changedInputs(base, inputs({ geometryKey: 'x' }))).toEqual(['geometry']);
        expect(changedInputs(base, inputs({ activity: { kind: 'hike', origin: 'user' } }))).toEqual(['activity']);
        expect(changedInputs(base, inputs({ departure: { mode: 'planned', at: 5 } }))).toEqual(['departure']);
        expect(changedInputs(base, inputs({ pace: { ...DEFAULT_PACE, stopsMinPerHour: 5 } }))).toEqual(['pace']);
        expect(changedInputs(base, inputs({ departure: { mode: 'now', tz: 'Europe/Paris' } }))).toEqual([]);
    });
    it('maps them to the layers to recompute', () => {
        expect(affectedLayers(['geometry'])).toEqual(['terrain', 'risk', 'weather', 'sun', 'timeline']);
        expect(affectedLayers(['departure', 'pace'])).toEqual(['sun', 'timeline']);
        expect(affectedLayers(['activity'])).toEqual(['risk', 'timeline']);
        expect(affectedLayers([])).toEqual([]);
    });
});

describe('tiers', () => {
    it('folds the states in three', () => {
        expect(['fresh', 'aging', 'pinned'].map(tierOf)).toEqual(['fresh', 'fresh', 'fresh']);
        expect(['stale', 'inputs-changed'].map(tierOf)).toEqual(['outdated', 'outdated']);
        expect(['absent', 'queued', 'running', 'offline-cached', 'failed'].map(tierOf)).toEqual(Array(5).fill('unavailable'));
    });
});

describe('evaluateLayer', () => {
    it('is absent when never computed, and can be computed', () => {
        expect(evaluateLayer('weather', undefined, context())).toEqual({ state: 'absent', canRefresh: true });
    });
    it('keeps a deterministic layer fresh whatever its age', () => {
        const ctx = context();
        const status = evaluateLayer('terrain', layerFor('terrain', ctx, 400 * 24 * HOUR), ctx);
        expect(status.state).toBe('fresh');
        expect(status.canRefresh).toBe(false);
    });
    it('flags a layer computed for other inputs', () => {
        const ctx = context();
        const risk = layerFor('risk', ctx);
        const edited = context({ inputs: inputs({ geometryKey: 'moved' }) });
        expect(evaluateLayer('risk', risk, edited)).toMatchObject({ state: 'inputs-changed', canRefresh: true });
    });
    it('never ages a pinned layer', () => {
        const ctx = context();
        const status = evaluateLayer('weather', { ...layerFor('weather', ctx, 90 * 24 * HOUR, { inputsHash: 'whatever' }), pinned: true }, ctx);
        expect(status.state).toBe('pinned');
    });
    it('reports a run in flight and a failure, keeping the age of what is shown', () => {
        const ctx = context({ runs: { weather: { state: 'running', progress: 0.5 } } });
        expect(evaluateLayer('weather', layerFor('weather', ctx, HOUR), ctx)).toEqual({ state: 'running', progress: 0.5, ageMs: HOUR, canRefresh: false });
        const failed = context({ runs: { weather: { state: 'failed', reason: 'rate-limited' } } });
        expect(evaluateLayer('weather', layerFor('weather', failed, 2 * HOUR), failed)).toEqual({ state: 'failed', reason: 'rate-limited', ageMs: 2 * HOUR, canRefresh: true });
    });

    describe('weather', () => {
        // the ride starts in 6 h: fresh under 1 h, aging under 3 h
        const ctx = context({ timeline: { startAt: NOW + 6 * HOUR, totalSec: 3600 } });
        it('goes fresh, aging, stale with its age', () => {
            expect(evaluateLayer('weather', layerFor('weather', ctx, 10 * MINUTE), ctx)).toMatchObject({ state: 'fresh', canRefresh: false });
            expect(evaluateLayer('weather', layerFor('weather', ctx, 2 * HOUR), ctx)).toMatchObject({ state: 'aging', canRefresh: true });
            expect(evaluateLayer('weather', layerFor('weather', ctx, 4 * HOUR), ctx)).toMatchObject({ state: 'stale', canRefresh: true });
        });
        it('ages faster while navigating', () => {
            const navigating = { ...ctx, navigating: true };
            expect(evaluateLayer('weather', layerFor('weather', navigating, 45 * MINUTE), navigating).state).toBe('aging');
            expect(evaluateLayer('weather', layerFor('weather', navigating, 90 * MINUTE), navigating).state).toBe('stale');
        });
        it('shows the stored snapshot as offline when it is old and there is no network', () => {
            const offline = { ...ctx, offline: true };
            expect(evaluateLayer('weather', layerFor('weather', offline, 4 * HOUR), offline)).toEqual({ state: 'offline-cached', reason: 'offline', ageMs: 4 * HOUR, canRefresh: false });
            expect(evaluateLayer('weather', layerFor('weather', offline, 10 * MINUTE), offline).state).toBe('fresh');
        });
        it('stays local when the departure moves inside the fetched window', () => {
            const fetched = layerFor('weather', ctx, MINUTE);
            const shifted = {
                ...ctx,
                inputs: inputs({ departure: { mode: 'planned', at: ctx.timeline.startAt + 2 * HOUR } }),
                timeline: { ...ctx.timeline, startAt: ctx.timeline.startAt + 2 * HOUR }
            };
            expect(evaluateLayer('weather', fetched, shifted).state).toBe('fresh');
        });
        it('needs a new fetch when the ride leaves the fetched window', () => {
            const fetched = layerFor('weather', ctx, MINUTE);
            const later = { ...ctx, timeline: { ...ctx.timeline, startAt: ctx.timeline.startAt + 5 * 24 * HOUR } };
            expect(evaluateLayer('weather', fetched, later)).toMatchObject({ state: 'inputs-changed', reason: 'out-of-coverage' });
        });
    });

    it('recomputes a sun layer when the departure moves', () => {
        const ctx = context();
        const sun = layerFor('sun', ctx);
        const moved = context({ inputs: inputs({ departure: { mode: 'planned', at: NOW + HOUR } }) });
        expect(evaluateLayer('sun', sun, ctx).state).toBe('fresh');
        expect(evaluateLayer('sun', sun, moved).state).toBe('inputs-changed');
    });
});

describe('evaluateTimeline', () => {
    const ride = { startAt: NOW, totalSec: 2 * 3600 };
    it('is fresh for now and for a plan still ahead', () => {
        expect(evaluateTimeline(context()).state).toBe('fresh');
        expect(evaluateTimeline(context({ inputs: inputs({ departure: { mode: 'planned', at: NOW + HOUR } }) })).state).toBe('fresh');
    });
    it('is stale once the planned departure went by', () => {
        const passed = context({ inputs: inputs({ departure: { mode: 'planned', at: NOW - HOUR } }), timeline: ride });
        expect(evaluateTimeline(passed)).toEqual({ state: 'stale', reason: 'departure-passed', canRefresh: true });
    });
    it('is fresh while navigating, or once the ride is over', () => {
        const passed = context({ inputs: inputs({ departure: { mode: 'planned', at: NOW - HOUR } }), timeline: ride });
        expect(evaluateTimeline({ ...passed, navigating: true }).state).toBe('fresh');
        const over = context({ inputs: inputs({ departure: { mode: 'planned', at: NOW - 5 * HOUR } }), timeline: ride });
        expect(evaluateTimeline(over).state).toBe('fresh');
    });
});

describe('evaluateAnalysis and layersToRefresh', () => {
    it('evaluates every layer, an analysis that does not exist being all absent', () => {
        const statuses = evaluateAnalysis(null, context());
        expect(Object.values(statuses).map((status) => status.state)).toEqual(['absent', 'absent', 'absent', 'absent', 'fresh']);
    });
    it('refreshes the outdated and failed layers, not the fresh, the absent or the timeline', () => {
        const ctx = context({ timeline: { startAt: NOW + 6 * HOUR, totalSec: 3600 }, runs: { sun: { state: 'failed', reason: 'error' } } });
        const analysis: RouteAnalysis = {
            v: 1,
            inputs: ctx.inputs,
            layers: {
                terrain: layerFor('terrain', ctx) as any,
                weather: layerFor('weather', ctx, 4 * HOUR) as any,
                risk: { ...layerFor('risk', ctx), prov: { ...layerFor('risk', ctx).prov, inputsHash: 'old' } } as any
            }
        };
        const statuses = evaluateAnalysis(analysis, ctx);
        expect(statuses.terrain.state).toBe('fresh');
        expect(statuses.weather.state).toBe('stale');
        expect(statuses.risk.state).toBe('inputs-changed');
        expect(statuses.sun.state).toBe('failed');
        expect(layersToRefresh(statuses)).toEqual(['risk', 'weather', 'sun']);
    });
    it('leaves a passed departure to the user: the timeline is not refreshed', () => {
        const passed = context({ inputs: inputs({ departure: { mode: 'planned', at: NOW - HOUR } }) });
        const statuses = evaluateAnalysis(null, passed);
        expect(statuses.timeline.state).toBe('stale');
        expect(layersToRefresh({ timeline: statuses.timeline })).toEqual([]);
    });
});
