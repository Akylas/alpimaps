/** When a route ends, for the Time tile. Pure: nothing here may import NativeScript. */
import type { RouteAnalysis } from '~/utils/routeAnalysis/types';
import { routeTimeZone } from '~/utils/routeAnalysis/departure';
import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';

export interface Arrival {
    /** epoch ms */
    at: number;
    /** minutes east of UTC, in the route's zone; none: the phone's zone */
    offset?: number;
}

/** The arrival of a route whose departure is planned or recorded: one that leaves "now" has none to tell. */
export function arrivalOf(item: Parameters<typeof timelineSource>[0] & { analysis?: RouteAnalysis | null }, now: number): Arrival | undefined {
    const inputs = item.analysis?.inputs;
    if (!inputs || inputs.departure.mode === 'now') {
        return undefined;
    }
    const timeline = buildTimeline(timelineSource(item), inputs, now);
    if (!timeline.t.length) {
        return undefined;
    }
    const at = timeline.at(timeline.t.length - 1);
    return { at, offset: routeTimeZone(inputs.departure).offset };
}
