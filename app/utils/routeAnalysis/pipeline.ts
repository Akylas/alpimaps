import { type Readable, type Writable, writable } from 'svelte/store';
import { type LayerReason, type LayerRun, affectedLayers, changedInputs } from './freshness';
import { type AnalysisInputs, LAYER_IDS, type Layer, type LayerId, type RouteAnalysis } from './types';

export interface StageContext {
    itemKey: string;
    analysis: RouteAnalysis;
    inputs: AnalysisInputs;
    /** Aborted when the layer's inputs changed or the run was replaced. Native calls cannot be aborted: their result is dropped. */
    signal: AbortSignal;
    progress(value: number): void;
}

/** What a feature contributes to compute one layer. */
export interface AnalysisStage {
    layer: LayerId;
    /** Layers of the same item that finish before this one starts, when it reads them. */
    after?: LayerId[];
    /** Stages sharing a resource run one at a time, whatever the item: the offline routing service is one singleton. */
    resource?: string;
    run(context: StageContext): Promise<Layer<unknown>>;
}

/** Throw it from a stage for the status to say why, rather than `error`. */
export class StageError extends Error {
    constructor(
        public reason: LayerReason,
        message?: string
    ) {
        super(message ?? reason);
    }
}

export type PipelineRuns = Partial<Record<LayerId, LayerRun>>;

export interface RunRequest {
    itemKey: string;
    analysis: RouteAnalysis;
    layers: LayerId[];
    /** Receives each finished layer, in the order they finish. The caller persists it. */
    commit(layer: LayerId, value: Layer<unknown>): void | Promise<void>;
}

interface ActiveRun {
    id: number;
    controller: AbortController;
    done: Promise<void>;
}

/**
 * Runs the stages the features contribute: one run per (item, layer), a new one replacing the old,
 * layers in parallel unless a stage says it waits for another or shares a resource.
 */
export function createPipeline(stages: () => AnalysisStage[]) {
    const active = new Map<string, ActiveRun>();
    const runsByItem = new Map<string, Writable<PipelineRuns>>();
    const resourceTails = new Map<string, Promise<void>>();
    let nextId = 0;

    const runKey = (itemKey: string, layer: LayerId) => `${itemKey}:${layer}`;

    function runsStore(itemKey: string) {
        let store = runsByItem.get(itemKey);
        if (!store) {
            store = writable({});
            runsByItem.set(itemKey, store);
        }
        return store;
    }

    function setRun(itemKey: string, layer: LayerId, run: LayerRun | undefined) {
        runsStore(itemKey).update((runs) => {
            const next = { ...runs };
            if (run) {
                next[layer] = run;
            } else {
                delete next[layer];
            }
            return next;
        });
    }

    function abort(itemKey: string, layer: LayerId) {
        const run = active.get(runKey(itemKey, layer));
        if (run) {
            run.controller.abort();
            active.delete(runKey(itemKey, layer));
            setRun(itemKey, layer, undefined);
        }
    }

    function start(request: RunRequest, stage: AnalysisStage) {
        const { analysis, itemKey } = request;
        const key = runKey(itemKey, stage.layer);
        abort(itemKey, stage.layer);
        const id = ++nextId;
        const controller = new AbortController();
        const current = () => active.get(key)?.id === id;
        // the layers it waits for are those of the same item still running now
        const waitsFor = (stage.after ?? []).map((layer) => active.get(runKey(itemKey, layer))?.done).filter(Boolean);
        setRun(itemKey, stage.layer, { state: 'queued' });

        const done = (async () => {
            await Promise.all(waitsFor);
            let release: (() => void) | undefined;
            if (stage.resource) {
                const previous = resourceTails.get(stage.resource) ?? Promise.resolve();
                const mine = new Promise<void>((resolve) => (release = resolve));
                resourceTails.set(
                    stage.resource,
                    previous.then(() => mine)
                );
                await previous;
            }
            try {
                if (!current()) {
                    return;
                }
                setRun(itemKey, stage.layer, { state: 'running' });
                const layer = await stage.run({
                    itemKey,
                    analysis,
                    inputs: analysis.inputs,
                    signal: controller.signal,
                    progress: (value) => {
                        if (current()) {
                            setRun(itemKey, stage.layer, { state: 'running', progress: value });
                        }
                    }
                });
                if (!current()) {
                    return;
                }
                await request.commit(stage.layer, layer);
                // replaced while it was being saved: the newer run owns the entry now
                if (current()) {
                    active.delete(key);
                    setRun(itemKey, stage.layer, undefined);
                }
            } catch (error) {
                if (current()) {
                    active.delete(key);
                    setRun(itemKey, stage.layer, { state: 'failed', reason: error instanceof StageError ? error.reason : 'error' });
                    console.error('routeAnalysis', stage.layer, error);
                }
            } finally {
                release?.();
            }
        })();
        active.set(key, { id, controller, done });
        return done;
    }

    return {
        /** What is running, queued or failed for an item, to hand to `evaluateAnalysis`. */
        runs(itemKey: string): Readable<PipelineRuns> {
            return runsStore(itemKey);
        },
        /** Resolves once every requested layer has finished, failed or been replaced. A layer no stage computes is skipped. */
        run(request: RunRequest): Promise<void> {
            const available = stages();
            const pending = request.layers.flatMap((layer) => available.filter((candidate) => candidate.layer === layer));
            const started: Promise<void>[] = [];
            const startedLayers = new Set<LayerId>();
            // a stage starts once the layers it reads, when they are part of this run, have started: it waits on them
            while (pending.length) {
                const index = pending.findIndex((stage) => (stage.after ?? []).every((layer) => startedLayers.has(layer) || !pending.some((other) => other.layer === layer)));
                const [stage] = pending.splice(Math.max(index, 0), 1);
                startedLayers.add(stage.layer);
                started.push(start(request, stage));
            }
            return Promise.all(started).then(() => undefined);
        },
        /** The inputs of an item changed: stop what depends on them, and nothing else. Returns the layers stopped. */
        setInputs(itemKey: string, previous: AnalysisInputs, next: AnalysisInputs): LayerId[] {
            const stopped = affectedLayers(changedInputs(previous, next)).filter((layer): layer is LayerId => layer !== 'timeline' && active.has(runKey(itemKey, layer)));
            stopped.forEach((layer) => abort(itemKey, layer));
            return stopped;
        },
        /** Stops one layer of an item, or all of them. */
        cancel(itemKey: string, layer?: LayerId) {
            (layer ? [layer] : LAYER_IDS).forEach((id) => abort(itemKey, id));
        },
        /** Clears the report of a failure, once the user has seen it. */
        clearFailure(itemKey: string, layer: LayerId) {
            if (!active.has(runKey(itemKey, layer))) {
                setRun(itemKey, layer, undefined);
            }
        }
    };
}
