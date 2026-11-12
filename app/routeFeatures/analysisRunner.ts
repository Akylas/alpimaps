import { showError } from '@shared/utils/showError';
import { get, writable } from 'svelte/store';
import { getMapContext } from '~/mapModules/MapModule';
import type { IItem } from '~/models/Item';
import { focusKeyOf } from '~/routeFeatures/lens/routeFocusStore';
import { routeFeatures, routeStages, tellDeparture } from '~/routeFeatures/registry';
import { networkService } from '~/services/NetworkService';
import { activityOf } from '~/utils/routeAnalysis/activity';
import { TIME_LAYERS, stampNow, withRouteTimeZone } from '~/utils/routeAnalysis/departure';
import { type LayerExtra, type LayerStatus, type StatusKey, evaluateAnalysis } from '~/utils/routeAnalysis/freshness';
import { createPipeline } from '~/utils/routeAnalysis/pipeline';
import { createAnalysis, reconcileAnalysis, withActivity, withDeparture, withNowStamp } from '~/utils/routeAnalysis/storage';
import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';
import type { Layer, LayerId, RouteAnalysis } from '~/utils/routeAnalysis/types';

/** The one pipeline: the features contribute the stages, and a layer is computed when something asks for it. */
const pipeline = createPipeline(() => routeStages(get(routeFeatures)));

/** Ticks whenever a layer finishes, fails or starts: what reads the statuses reads them again. */
const changes = writable(0);
export const routeAnalysisChanges = { subscribe: changes.subscribe };
const notify = () => changes.update((count) => count + 1);

/** The route's inputs changed in place (a new departure, a new pace): what is read from its layers reads them again. */
export const analysisChanged = notify;

/** The route leaves now, stamped: what is read at a time of the ride is read again. */
export function leaveNow(item: IItem) {
    keepLook(item);
    item.analysis = withDeparture(item.analysis, item.geometry, stampNow({ mode: 'now' }, Date.now()));
    saveAnalysis(item, item.analysis);
    notify();
    tellDeparture(get(routeFeatures), { item }, 'restamped');
}

function isSaved(item: IItem) {
    return item?.id !== undefined && item.id !== null;
}

/** The zone a layer reports for the route start, when it does. */
function reportedZone(data: unknown): { tz: string; utcOffset: number } | undefined {
    return data && typeof data === 'object' && 'tz' in data && typeof data.tz === 'string' && 'utcOffset' in data && typeof data.utcOffset === 'number'
        ? { tz: data.tz, utcOffset: data.utcOffset }
        : undefined;
}

// one save after the other, from wherever they come: a slow one must not land after, and over, a newer one
let saving: Promise<void> = Promise.resolve();

/** Saves the route's analysis when the route is saved; an unsaved route keeps its analysis on the item until it is saved with it. */
export function saveAnalysis(item: IItem, analysis: RouteAnalysis): Promise<void> {
    if (!isSaved(item)) {
        return Promise.resolve();
    }
    saving = saving.then(() => getMapContext().mapModule('items').updateItem(item, { analysis }, false, false)).then(() => undefined, showError);
    return saving;
}

// A departure looked at (the When panel's strip): the item carries the analysis as it would be, so the whole page shows it, and what it
// had before is kept here to give back. Only that one is ever saved.
const looks = new Map<string, { base: RouteAnalysis | null }>();

/** What the route had before it was looked at in another way, or `undefined` when it is not. */
export function lookingBase(item: IItem): { analysis: RouteAnalysis | null } | undefined {
    const look = looks.get(focusKeyOf(item));
    return look ? { analysis: look.base } : undefined;
}

export function lookAt(item: IItem, analysis: RouteAnalysis) {
    const key = focusKeyOf(item);
    if (!looks.has(key)) {
        looks.set(key, { base: item.analysis ?? null });
    }
    item.analysis = analysis;
    notify();
}

/** Gives back what the route had. */
export function revertLook(item: IItem) {
    const look = looks.get(focusKeyOf(item));
    if (look) {
        looks.delete(focusKeyOf(item));
        item.analysis = look.base;
        notify();
    }
}

/** What was looked at is now the route's: the change that says so replaces what was kept. */
export function keepLook(item: IItem) {
    looks.delete(focusKeyOf(item));
}

function withLayer(analysis: RouteAnalysis, layer: LayerId, value: Layer<unknown>): RouteAnalysis {
    const zone = reportedZone(value.data);
    return {
        ...analysis,
        inputs: zone ? { ...analysis.inputs, departure: withRouteTimeZone(analysis.inputs.departure, zone.tz, zone.utcOffset) } : analysis.inputs,
        layers: { ...analysis.layers, [layer]: value }
    };
}

function commit(item: IItem, layer: LayerId, value: Layer<unknown>) {
    item.analysis = withLayer(item.analysis, layer, value);
    // a layer that lands while a departure is looked at belongs to the route as it is, which is what is saved
    const look = looks.get(focusKeyOf(item));
    if (look) {
        look.base = withLayer(look.base ?? createAnalysis(item.geometry, activityOf(item, null)), layer, value);
    }
    notify();
    return saveAnalysis(item, look ? look.base : item.analysis);
}

/**
 * Computes layers of a route and keeps them on it, saved when the route is. Resolves once each has finished or failed;
 * what failed is in `layerStatuses`. A departure being looked at is given back first: what is fetched is the route's. A route leaving now
 * is stamped with the time when a layer that reads it is computed.
 */
export async function computeLayers(item: IItem, layers: LayerId[]) {
    const itemKey = focusKeyOf(item);
    revertLook(item);
    const current = reconcileAnalysis(item.analysis, item.geometry) ?? createAnalysis(item.geometry, activityOf(item, null));
    // a ride leaving now keeps the time its data was read at: the stamp goes first, the layers are hashed with it
    const analysis = layers.some((layer) => TIME_LAYERS.includes(layer)) ? withNowStamp(current, Date.now()) : current;
    // an analysis made for a departure or a pace has no activity yet: a computed route is what it was routed for
    const activity = analysis.inputs.activity ? undefined : activityOf(item, null);
    item.analysis = activity ? withActivity(analysis, item.geometry, activity) : analysis;
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
