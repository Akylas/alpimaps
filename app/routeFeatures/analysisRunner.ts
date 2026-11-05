import { showError } from '@shared/utils/showError';
import { get, writable } from 'svelte/store';
import { getMapContext } from '~/mapModules/MapModule';
import type { IItem } from '~/models/Item';
import { focusKeyOf } from '~/routeFeatures/lens/routeFocusStore';
import { routeFeatures, routeStages } from '~/routeFeatures/registry';
import { networkService } from '~/services/NetworkService';
import { activityOf } from '~/utils/routeAnalysis/activity';
import { withRouteTimeZone } from '~/utils/routeAnalysis/departure';
import { type LayerExtra, type LayerStatus, type StatusKey, evaluateAnalysis } from '~/utils/routeAnalysis/freshness';
import { createPipeline } from '~/utils/routeAnalysis/pipeline';
import { createAnalysis, reconcileAnalysis } from '~/utils/routeAnalysis/storage';
import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';
import type { Layer, LayerId, RouteAnalysis } from '~/utils/routeAnalysis/types';

/** The one pipeline: the features contribute the stages, and a layer is computed when something asks for it. */
const pipeline = createPipeline(() => routeStages(get(routeFeatures)));

/** Ticks whenever a layer finishes, fails or starts: what reads the statuses reads them again. */
const changes = writable(0);
export const routeAnalysisChanges = { subscribe: changes.subscribe };
const notify = () => changes.update((count) => count + 1);

function isSaved(item: IItem) {
    return item?.id !== undefined && item.id !== null;
}

/** The zone a layer reports for the route start, when it does. */
function reportedZone(data: unknown): { tz: string; utcOffset: number } | undefined {
    return data && typeof data === 'object' && 'tz' in data && typeof data.tz === 'string' && 'utcOffset' in data && typeof data.utcOffset === 'number'
        ? { tz: data.tz, utcOffset: data.utcOffset }
        : undefined;
}

// one save after the other: a slow one must not land after, and over, a newer one
let saving: Promise<void> = Promise.resolve();

function commit(item: IItem, layer: LayerId, value: Layer<unknown>) {
    const current = item.analysis;
    const zone = reportedZone(value.data);
    const analysis: RouteAnalysis = {
        ...current,
        inputs: zone ? { ...current.inputs, departure: withRouteTimeZone(current.inputs.departure, zone.tz, zone.utcOffset) } : current.inputs,
        layers: { ...current.layers, [layer]: value }
    };
    item.analysis = analysis;
    notify();
    // an unsaved route keeps its analysis on the item until it is saved with it
    if (isSaved(item)) {
        saving = saving.then(() => getMapContext().mapModule('items').updateItem(item, { analysis }, false, false)).then(() => undefined, showError);
        return saving;
    }
}

/**
 * Computes layers of a route and keeps them on it, saved when the route is. Resolves once each has finished or failed;
 * what failed is in `layerStatuses`.
 */
export async function computeLayers(item: IItem, layers: LayerId[]) {
    const itemKey = focusKeyOf(item);
    item.analysis = reconcileAnalysis(item.analysis, item.geometry) ?? createAnalysis(item.geometry, activityOf(item, null));
    const unsubscribe = pipeline.runs(itemKey).subscribe(notify);
    try {
        await pipeline.run({ itemKey, item, analysis: item.analysis, layers, commit: (layer, value) => commit(item, layer, value) });
    } catch (error) {
        showError(error);
    } finally {
        unsubscribe();
    }
}

/** Where each layer of a route stands now: absent, running, fresh, outdated, offline... */
export function layerStatuses(item: IItem, now = Date.now()): Record<StatusKey, LayerStatus> {
    const analysis = item.analysis ?? null;
    const inputs = (analysis ?? createAnalysis(item.geometry, activityOf(item, null))).inputs;
    const { startAt, totalSec } = buildTimeline(timelineSource(item), inputs, now);
    const extras: Partial<Record<LayerId, LayerExtra>> = {};
    routeStages(get(routeFeatures)).forEach((stage) => {
        if (stage.extra) {
            extras[stage.layer] = stage.extra();
        }
    });
    return evaluateAnalysis(analysis, { now, inputs, timeline: { startAt, totalSec }, offline: !networkService.connected, extras, runs: get(pipeline.runs(focusKeyOf(item))) });
}
