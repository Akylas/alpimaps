import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AnalysisStage, type StageContext, StageError, createPipeline } from './pipeline';
import { DEFAULT_PACE, createAnalysis } from './storage';
import type { Layer, LayerId } from './types';

const analysis = createAnalysis({
    type: 'LineString',
    coordinates: [
        [6, 45],
        [6, 45.1]
    ]
});

function deferred<T = void>() {
    let resolve: (value: T) => void;
    let reject: (error: unknown) => void;
    const promise = new Promise<T>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function layerValue(tag: string): Layer<unknown> {
    return { prov: { computedAt: 1, inputsHash: tag, provider: 'test', quality: 'ok' }, data: tag };
}

/** A stage that stays open until the test settles it. */
function openStage(layer: LayerId, extra: Partial<AnalysisStage> = {}) {
    const started: StageContext[] = [];
    const gates: ReturnType<typeof deferred<Layer<unknown>>>[] = [];
    const stage: AnalysisStage = {
        layer,
        ...extra,
        run(context) {
            started.push(context);
            const gate = deferred<Layer<unknown>>();
            gates.push(gate);
            return gate.promise;
        }
    };
    return { stage, started, gates };
}

function setup(...stages: AnalysisStage[]) {
    const pipeline = createPipeline(() => stages);
    const committed: [LayerId, unknown][] = [];
    const request = (itemKey: string, layers: LayerId[]) => ({ itemKey, item: {}, analysis, layers, commit: (layer: LayerId, value: Layer<unknown>) => void committed.push([layer, value.data]) });
    return { pipeline, committed, request };
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('pipeline', () => {
    it('runs a stage, hands the layer over and clears the status', async () => {
        const terrain = openStage('terrain');
        const { committed, pipeline, request } = setup(terrain.stage);
        const seen: string[] = [];
        pipeline.runs('a').subscribe((runs) => seen.push(runs.terrain?.state ?? 'none'));
        const done = pipeline.run(request('a', ['terrain']));
        await settle();
        expect(get(pipeline.runs('a')).terrain).toEqual({ state: 'running' });
        terrain.gates[0].resolve(layerValue('t1'));
        await done;
        expect(committed).toEqual([['terrain', 't1']]);
        expect(seen).toEqual(['none', 'queued', 'running', 'none']);
    });
    it('gives the stage the item inputs and reports its progress', async () => {
        const terrain = openStage('terrain');
        const { pipeline, request } = setup(terrain.stage);
        const done = pipeline.run(request('a', ['terrain']));
        await settle();
        expect(terrain.started[0].inputs).toBe(analysis.inputs);
        terrain.started[0].progress(0.4);
        expect(get(pipeline.runs('a')).terrain).toEqual({ state: 'running', progress: 0.4 });
        terrain.gates[0].resolve(layerValue('t'));
        await done;
    });
    it('skips a layer no feature computes', async () => {
        const { committed, pipeline, request } = setup();
        await pipeline.run(request('a', ['weather']));
        expect(committed).toEqual([]);
        expect(get(pipeline.runs('a'))).toEqual({});
    });
    it('runs the layers in parallel', async () => {
        const weather = openStage('weather');
        const sun = openStage('sun');
        const { pipeline, request } = setup(weather.stage, sun.stage);
        const done = pipeline.run(request('a', ['weather', 'sun']));
        await settle();
        expect(weather.started).toHaveLength(1);
        expect(sun.started).toHaveLength(1);
        weather.gates[0].resolve(layerValue('w'));
        sun.gates[0].resolve(layerValue('s'));
        await done;
    });

    describe('ordering', () => {
        it('starts a stage after the layers it reads, of the same item', async () => {
            const terrain = openStage('terrain');
            const weather = openStage('weather', { after: ['terrain'] });
            const { pipeline, request } = setup(terrain.stage, weather.stage);
            const done = pipeline.run(request('a', ['terrain', 'weather']));
            await settle();
            expect(weather.started).toHaveLength(0);
            expect(get(pipeline.runs('a')).weather).toEqual({ state: 'queued' });
            terrain.gates[0].resolve(layerValue('t'));
            await settle();
            expect(weather.started).toHaveLength(1);
            weather.gates[0].resolve(layerValue('w'));
            await done;
        });
        it('waits for the layers it reads whatever the order they are asked in', async () => {
            const terrain = openStage('terrain');
            const weather = openStage('weather', { after: ['terrain'] });
            const sun = openStage('sun', { after: ['weather'] });
            const { pipeline, request } = setup(terrain.stage, weather.stage, sun.stage);
            const done = pipeline.run(request('a', ['sun', 'weather', 'terrain']));
            await settle();
            expect(terrain.started).toHaveLength(1);
            expect(weather.started).toHaveLength(0);
            expect(sun.started).toHaveLength(0);
            terrain.gates[0].resolve(layerValue('t'));
            await settle();
            expect(weather.started).toHaveLength(1);
            expect(sun.started).toHaveLength(0);
            weather.gates[0].resolve(layerValue('w'));
            await settle();
            sun.gates[0].resolve(layerValue('s'));
            await done;
        });
        it('does not hold the shared resource while it waits for another layer', async () => {
            const weather = openStage('weather');
            const risk = openStage('risk', { after: ['weather'], resource: 'routing' });
            const terrain = openStage('terrain', { resource: 'routing' });
            const { pipeline, request } = setup(weather.stage, risk.stage, terrain.stage);
            const done = pipeline.run(request('a', ['weather', 'risk', 'terrain']));
            await settle();
            // risk is idle behind the weather: terrain must be able to use the routing service
            expect(terrain.started).toHaveLength(1);
            expect(risk.started).toHaveLength(0);
            terrain.gates[0].resolve(layerValue('t'));
            weather.gates[0].resolve(layerValue('w'));
            await settle();
            expect(risk.started).toHaveLength(1);
            risk.gates[0].resolve(layerValue('r'));
            await done;
        });
        it('does not wait for the layer of another item', async () => {
            const terrain = openStage('terrain');
            const weather = openStage('weather', { after: ['terrain'] });
            const { pipeline, request } = setup(terrain.stage, weather.stage);
            const first = pipeline.run(request('a', ['terrain']));
            const second = pipeline.run(request('b', ['weather']));
            await settle();
            expect(weather.started).toHaveLength(1);
            terrain.gates[0].resolve(layerValue('t'));
            weather.gates[0].resolve(layerValue('w'));
            await Promise.all([first, second]);
        });
        it('runs the stages of a shared resource one at a time, across items', async () => {
            const terrain = openStage('terrain', { resource: 'routing' });
            const risk = openStage('risk', { resource: 'routing' });
            const { pipeline, request } = setup(terrain.stage, risk.stage);
            const first = pipeline.run(request('a', ['terrain']));
            const second = pipeline.run(request('b', ['risk']));
            await settle();
            expect(terrain.started).toHaveLength(1);
            expect(risk.started).toHaveLength(0);
            terrain.gates[0].resolve(layerValue('t'));
            await settle();
            expect(risk.started).toHaveLength(1);
            risk.gates[0].resolve(layerValue('r'));
            await Promise.all([first, second]);
        });
        it('frees the resource when its stage fails', async () => {
            const terrain = openStage('terrain', { resource: 'routing' });
            const risk = openStage('risk', { resource: 'routing' });
            const { pipeline, request } = setup(terrain.stage, risk.stage);
            const done = pipeline.run(request('a', ['terrain', 'risk']));
            await settle();
            terrain.gates[0].reject(new Error('boom'));
            await settle();
            expect(risk.started).toHaveLength(1);
            risk.gates[0].resolve(layerValue('r'));
            await done;
        });
    });

    describe('replacing and cancelling', () => {
        it('tells a stage it was aborted, for it to cancel its native call: there is no AbortController', async () => {
            const weather = openStage('weather');
            const { pipeline, request } = setup(weather.stage);
            pipeline.run(request('a', ['weather']));
            await settle();
            const cancelled = vi.fn();
            weather.started[0].signal.onAbort(cancelled);
            expect(cancelled).not.toHaveBeenCalled();
            pipeline.run(request('a', ['weather']));
            await settle();
            expect(cancelled).toHaveBeenCalledTimes(1);
            pipeline.cancel('a');
            expect(cancelled).toHaveBeenCalledTimes(1);
        });
        it('calls at once a callback given after the abort', async () => {
            const weather = openStage('weather');
            const { pipeline, request } = setup(weather.stage);
            pipeline.run(request('a', ['weather']));
            await settle();
            pipeline.cancel('a');
            const late = vi.fn();
            weather.started[0].signal.onAbort(late);
            expect(late).toHaveBeenCalledTimes(1);
        });
        it('does not call it for a run that finished', async () => {
            const weather = openStage('weather');
            const { pipeline, request } = setup(weather.stage);
            const done = pipeline.run(request('a', ['weather']));
            await settle();
            const cancelled = vi.fn();
            weather.started[0].signal.onAbort(cancelled);
            weather.gates[0].resolve(layerValue('w'));
            await done;
            pipeline.cancel('a');
            expect(cancelled).not.toHaveBeenCalled();
        });
        it('aborts the run a new one replaces, and drops its late result', async () => {
            const weather = openStage('weather');
            const { committed, pipeline, request } = setup(weather.stage);
            const first = pipeline.run(request('a', ['weather']));
            await settle();
            const second = pipeline.run(request('a', ['weather']));
            await settle();
            expect(weather.started[0].signal.aborted).toBe(true);
            expect(weather.started[1].signal.aborted).toBe(false);
            // a native call cannot be aborted: it answers anyway
            weather.gates[0].resolve(layerValue('old'));
            weather.gates[1].resolve(layerValue('new'));
            await Promise.all([first, second]);
            expect(committed).toEqual([['weather', 'new']]);
        });
        it('keeps the newer run when it replaced one that was being saved', async () => {
            const weather = openStage('weather');
            const saving = deferred();
            const committed: unknown[] = [];
            const pipeline = createPipeline(() => [weather.stage]);
            const request = { itemKey: 'a', item: {}, analysis, layers: ['weather' as LayerId], commit: (_: LayerId, value: Layer<unknown>) => (committed.push(value.data), saving.promise) };
            const first = pipeline.run(request);
            await settle();
            weather.gates[0].resolve(layerValue('old'));
            await settle();
            const second = pipeline.run(request);
            saving.resolve();
            await first;
            expect(get(pipeline.runs('a')).weather).toEqual({ state: 'running' });
            await settle();
            weather.gates[1].resolve(layerValue('new'));
            await second;
            expect(committed).toEqual(['old', 'new']);
            expect(get(pipeline.runs('a'))).toEqual({});
        });
        it('cancels one layer or all of an item, and no other item', async () => {
            const terrain = openStage('terrain');
            const sun = openStage('sun');
            const { committed, pipeline, request } = setup(terrain.stage, sun.stage);
            const mine = pipeline.run(request('a', ['terrain', 'sun']));
            const other = pipeline.run(request('b', ['terrain']));
            await settle();
            pipeline.cancel('a', 'terrain');
            expect(get(pipeline.runs('a'))).toEqual({ sun: { state: 'running' } });
            pipeline.cancel('a');
            expect(get(pipeline.runs('a'))).toEqual({});
            expect(get(pipeline.runs('b')).terrain).toEqual({ state: 'running' });
            terrain.gates.forEach((gate) => gate.resolve(layerValue('t')));
            sun.gates[0].resolve(layerValue('s'));
            await Promise.all([mine, other]);
            expect(committed).toEqual([['terrain', 't']]);
        });
    });

    describe('setInputs', () => {
        const same = analysis.inputs;
        async function running() {
            const stages = (['terrain', 'risk', 'weather', 'sun'] as LayerId[]).map((layer) => openStage(layer));
            const { pipeline, request } = setup(...stages.map((entry) => entry.stage));
            pipeline.run(request('a', ['terrain', 'risk', 'weather', 'sun']));
            await settle();
            return { pipeline, stages };
        }
        it('stops everything that depends on the geometry', async () => {
            const { pipeline } = await running();
            const stopped = pipeline.setInputs('a', same, { ...same, geometryKey: 'edited' });
            expect(stopped).toEqual(['terrain', 'risk', 'weather', 'sun']);
            expect(get(pipeline.runs('a'))).toEqual({});
        });
        it('stops only the sun when the departure moves', async () => {
            const { pipeline, stages } = await running();
            const stopped = pipeline.setInputs('a', same, { ...same, departure: { mode: 'planned', at: 5 } });
            expect(stopped).toEqual(['sun']);
            expect(stages[3].started[0].signal.aborted).toBe(true);
            expect(stages[2].started[0].signal.aborted).toBe(false);
            expect(Object.keys(get(pipeline.runs('a')))).toEqual(['terrain', 'risk', 'weather']);
        });
        it('stops the risk when the activity kind changes, not on a pace change of the sun-less kind', async () => {
            const { pipeline } = await running();
            expect(pipeline.setInputs('a', same, { ...same, activity: { kind: 'hike', origin: 'user' } })).toEqual(['risk']);
            expect(pipeline.setInputs('a', same, { ...same, pace: { ...DEFAULT_PACE, multiplier: 1.2 } })).toEqual(['sun']);
        });
        it('stops nothing for the same inputs, or for an item that runs nothing', async () => {
            const { pipeline } = await running();
            expect(pipeline.setInputs('a', same, { ...same })).toEqual([]);
            expect(pipeline.setInputs('b', same, { ...same, geometryKey: 'edited' })).toEqual([]);
        });
    });

    describe('failure', () => {
        it('says why a stage failed, keeps it, and commits nothing', async () => {
            const stage: AnalysisStage = { layer: 'weather', run: () => Promise.reject(new StageError('rate-limited')) };
            const { committed, pipeline, request } = setup(stage);
            await pipeline.run(request('a', ['weather']));
            expect(get(pipeline.runs('a')).weather).toEqual({ state: 'failed', reason: 'rate-limited' });
            expect(committed).toEqual([]);
        });
        it('calls any other error an error, and the next run replaces the failure', async () => {
            let fail = true;
            const stage: AnalysisStage = { layer: 'sun', run: () => (fail ? Promise.reject(new Error('boom')) : Promise.resolve(layerValue('s'))) };
            const { committed, pipeline, request } = setup(stage);
            await pipeline.run(request('a', ['sun']));
            expect(get(pipeline.runs('a')).sun).toEqual({ state: 'failed', reason: 'error' });
            fail = false;
            await pipeline.run(request('a', ['sun']));
            expect(get(pipeline.runs('a'))).toEqual({});
            expect(committed).toEqual([['sun', 's']]);
        });
        it('fails a layer whose result could not be saved', async () => {
            const stage: AnalysisStage = { layer: 'sun', run: () => Promise.resolve(layerValue('s')) };
            const pipeline = createPipeline(() => [stage]);
            await pipeline.run({ itemKey: 'a', item: {}, analysis, layers: ['sun'], commit: () => Promise.reject(new Error('disk full')) });
            expect(get(pipeline.runs('a')).sun).toEqual({ state: 'failed', reason: 'error' });
        });
        it('does not report the failure of a run that was cancelled', async () => {
            const weather = openStage('weather');
            const { pipeline, request } = setup(weather.stage);
            const done = pipeline.run(request('a', ['weather']));
            await settle();
            pipeline.cancel('a');
            weather.gates[0].reject(new Error('aborted'));
            await done;
            expect(get(pipeline.runs('a'))).toEqual({});
        });
        it('clears a reported failure, not a run in flight', async () => {
            const stage: AnalysisStage = { layer: 'weather', run: () => Promise.reject(new Error('x')) };
            const { pipeline, request } = setup(stage);
            await pipeline.run(request('a', ['weather']));
            pipeline.clearFailure('a', 'weather');
            expect(get(pipeline.runs('a'))).toEqual({});
            const open = openStage('sun');
            const second = setup(open.stage);
            second.pipeline.run(second.request('a', ['sun']));
            await settle();
            second.pipeline.clearFailure('a', 'sun');
            expect(get(second.pipeline.runs('a')).sun).toEqual({ state: 'running' });
            open.gates[0].resolve(layerValue('s'));
        });
    });
});
