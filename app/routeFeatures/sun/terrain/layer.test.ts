import { describe, expect, it } from 'vitest';
import { type ExposureAsker, computeTerrainLayer, freshTerrain, sunExtras } from '~/routeFeatures/sun/terrain/layer';
import { EXPOSURE_STATUS } from '~/routeFeatures/sun/terrain/exposure';
import { layerInputsHash } from '~/utils/routeAnalysis/freshness';
import { StageError } from '~/utils/routeAnalysis/pipeline';
import { DEFAULT_PACE } from '~/utils/routeAnalysis/storage';
import type { AnalysisInputs, RouteAnalysis } from '~/utils/routeAnalysis/types';

const NOW = Date.UTC(2026, 5, 1);
const DEPART = Date.UTC(2026, 5, 21, 11, 30);
// 72 km north-west from Grenoble, a vertex every 120 m, further apart than a bike's step: 601 samples, so three calls
const COUNT = 601;
const coordinates = Array.from({ length: COUNT }, (_, index) => [5.72 - (index * 120 * 0.6) / 78700, 45.19 + (index * 120 * 0.8) / 111320]);
const item = { geometry: { type: 'LineString' as const, coordinates }, route: { totalTime: 6 * 3600 } };
const inputs: AnalysisInputs = { activity: { kind: 'bike', subtype: 'road', origin: 'route' }, departure: { mode: 'planned', at: DEPART }, pace: { ...DEFAULT_PACE }, geometryKey: 'k' };
const analysis: RouteAnalysis = { v: 1, inputs, layers: {} };

/** What the SDK answers: the sun is lit, but for the call's first point, which is in the shade. */
function asker(status = 0) {
    const calls: { size: number; first: { lat: number; lon: number; azimuth: number; altitude: number }; eyeHeight: number; last: boolean }[] = [];
    const expose: ExposureAsker = async (samples, options) => {
        calls.push({ size: samples.length, first: samples[0], eyeHeight: options.eyeHeight, last: options.last });
        return { sunFraction: samples.map((_, index) => (index === 0 ? 0 : 1)), status: samples.map(() => status) };
    };
    return { expose, calls };
}

const compute = (expose: ExposureAsker, overrides: Partial<Parameters<typeof computeTerrainLayer>[0]> = {}) => computeTerrainLayer({ item, analysis, inputs, now: NOW, expose, ...overrides });

describe('computeTerrainLayer', () => {
    it('asks the SDK in calls of 250 points, in order, and only the last one says it is', async () => {
        const { calls, expose } = asker();
        await compute(expose);
        expect(calls.map((call) => [call.size, call.last])).toEqual([
            [250, false],
            [250, false],
            [101, true]
        ]);
    });

    it('asks the sun where the ride is: the point, and where the sun is at the time the ride gets there', async () => {
        const { calls, expose } = asker();
        await compute(expose);
        expect(calls[0].first.lat).toBeCloseTo(45.19, 5);
        expect(calls[0].first.lon).toBeCloseTo(5.72, 5);
        // 13:30 in Grenoble at midsummer: south, high
        expect(calls[0].first.altitude).toBeGreaterThan(60);
        expect(calls[0].first.azimuth).toBeGreaterThan(150);
        expect(calls[0].first.azimuth).toBeLessThan(200);
    });

    it('asks with the height of the eyes of what carries the ride', async () => {
        const { calls, expose } = asker();
        await compute(expose);
        expect(calls[0].eyeHeight).toBe(1.2);
        const hike = asker();
        const walking: AnalysisInputs = { ...inputs, activity: { kind: 'hike', subtype: 'walk', origin: 'user' } };
        await compute(hike.expose, { inputs: walking, analysis: { ...analysis, inputs: walking } });
        expect(hike.calls[0].eyeHeight).toBe(1.5);
    });

    it('keeps the share lit of every sample, with the step and what it was computed with', async () => {
        const { expose } = asker();
        const layer = await compute(expose);
        expect(layer.data.lit).toHaveLength(COUNT);
        expect(layer.data.lit.filter((lit) => lit === 0)).toHaveLength(3);
        expect(layer.data.step).toBe(100);
        expect(layer.data.params).toEqual({ kind: 'bike', eyeHeight: 1.2, algo: 1 });
        expect(layer.data.coverage).toBe(1);
        expect(layer.data.flags).toEqual([]);
    });

    it('says it is partial where the ground was not fine enough, and flags the samples', async () => {
        const { expose } = asker(EXPOSURE_STATUS.COARSE_DEM);
        const layer = await compute(expose);
        expect(layer.prov.quality).toBe('partial');
        expect(layer.data.coverage).toBe(0);
        expect(layer.data.flags).toHaveLength(COUNT);
        expect((await compute(asker().expose)).prov.quality).toBe('ok');
    });

    it('is hashed with the inputs of the sun layer, so a new departure makes it out of date', async () => {
        const layer = await compute(asker().expose);
        expect(layer.prov.inputsHash).toBe(layerInputsHash('sun', inputs, sunExtras()));
        expect(layer.prov.provider).toBe('massif-sdk/sunExposure@1');
        const later: AnalysisInputs = { ...inputs, departure: { mode: 'planned', at: DEPART + 3600000 } };
        expect(layerInputsHash('sun', later, sunExtras())).not.toBe(layer.prov.inputsHash);
    });

    it('tells where it was computed from the timeline: the departure and the pace', async () => {
        const first = await compute(asker().expose);
        const later: AnalysisInputs = { ...inputs, departure: { mode: 'planned', at: DEPART + 3600000 } };
        const second = await compute(asker().expose, { inputs: later, analysis: { ...analysis, inputs: later } });
        expect(second.data.basis.departureHash).not.toBe(first.data.basis.departureHash);
        expect(second.data.basis.paceHash).toBe(first.data.basis.paceHash);
    });

    it('reports its progress as calls are made', async () => {
        const seen: number[] = [];
        await compute(asker().expose, { progress: (value) => seen.push(value) });
        expect(seen).toEqual([1 / 3, 2 / 3, 1]);
    });

    it('stops between calls when the run is abandoned, asking no more', async () => {
        const { calls, expose } = asker();
        const signal = { aborted: false };
        const stopping: ExposureAsker = async (samples, options) => {
            const answer = await expose(samples, options);
            signal.aborted = true;
            return answer;
        };
        await expect(compute(stopping, { signal })).rejects.toBeInstanceOf(StageError);
        expect(calls).toHaveLength(1);
    });

    it('fails for a route with no line', async () => {
        await expect(compute(asker().expose, { item: { route: { totalTime: 100 } } })).rejects.toBeInstanceOf(StageError);
    });
});

describe('freshTerrain', () => {
    it('gives the shares lit of a layer that is of the ride as it is timed', async () => {
        const layer = await compute(asker().expose);
        const terrain = freshTerrain({ ...analysis, layers: { sun: layer } });
        expect(terrain.step).toBe(100);
        expect(terrain.lit).toHaveLength(COUNT);
    });

    it('gives none for a layer of another departure, or another pace', async () => {
        const layer = await compute(asker().expose);
        const later: AnalysisInputs = { ...inputs, departure: { mode: 'planned', at: DEPART + 3600000 } };
        expect(freshTerrain({ v: 1, inputs: later, layers: { sun: layer } })).toBeUndefined();
        const slower: AnalysisInputs = { ...inputs, pace: { ...inputs.pace, multiplier: 1.2 } };
        expect(freshTerrain({ v: 1, inputs: slower, layers: { sun: layer } })).toBeUndefined();
    });

    it('gives none without a layer, or for a layer that holds no shares', async () => {
        expect(freshTerrain(analysis)).toBeUndefined();
        expect(freshTerrain(null)).toBeUndefined();
        const layer = await compute(asker().expose);
        const { lit: _lit, ...astronomyOnly } = layer.data;
        expect(freshTerrain({ ...analysis, layers: { sun: { ...layer, data: astronomyOnly } } })).toBeUndefined();
    });
});
