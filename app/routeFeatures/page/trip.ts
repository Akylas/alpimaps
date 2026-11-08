/** When a ride leaves and arrives, for the strip under the tiles of the route page. Pure: nothing here may import NativeScript. */
import { routeTimeZone } from '~/utils/routeAnalysis/departure';
import type { StageItem } from '~/utils/routeAnalysis/pipeline';
import { createAnalysis } from '~/utils/routeAnalysis/storage';
import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';
import type { RouteAnalysis } from '~/utils/routeAnalysis/types';

export interface TripTimes {
    /** epoch ms */
    start: number;
    end: number;
    /** minutes east of UTC in the route's zone; none: the phone's */
    offset?: number;
    /** the ride leaves with the clock: its start is not a time to say */
    now: boolean;
    /** civil days from today to the day it leaves */
    startDay: number;
    /** civil days from the day it leaves to the day it arrives */
    endShift: number;
}

const MINUTE = 60000;
const DAY = 24 * 60 * MINUTE;

/** The civil day an instant is in, as a number: in the zone `offset` minutes east of UTC, else on the phone's clock. */
function dayOf(at: number, offset: number | undefined): number {
    return Math.floor((at + (offset ?? -new Date(at).getTimezoneOffset()) * MINUTE) / DAY);
}

/** The ride as it is timed now: with the departure and the pace the route has, else leaving now at the usual pace. */
export function tripTimes(item: StageItem & { analysis?: RouteAnalysis | null }, now: number): TripTimes | null {
    const inputs = (item.analysis ?? createAnalysis(item.geometry)).inputs;
    const timeline = buildTimeline(timelineSource(item), inputs, now);
    if (!timeline.t.length) {
        return null;
    }
    const start = timeline.at(0);
    const end = timeline.at(timeline.t.length - 1);
    const { offset } = routeTimeZone(inputs.departure);
    return { start, end, offset, now: inputs.departure.mode === 'now', startDay: dayOf(start, offset) - dayOf(now, offset), endShift: dayOf(end, offset) - dayOf(start, offset) };
}
