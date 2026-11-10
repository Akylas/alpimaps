/** When a ride leaves and arrives, for the strip under the tiles of the route page. Pure: nothing here may import NativeScript. */
import { type OffsetAt, floatsWithClock, offsetAtFor, snapshotOutdated } from '~/utils/routeAnalysis/departure';
import type { StageItem } from '~/utils/routeAnalysis/pipeline';
import { createAnalysis } from '~/utils/routeAnalysis/storage';
import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';
import type { RouteAnalysis } from '~/utils/routeAnalysis/types';

export interface TripTimes {
    /** epoch ms */
    start: number;
    end: number;
    /** minutes east of UTC in the route's zone at an instant; none: the phone's */
    offsetAt: OffsetAt;
    /** the ride leaves with the clock: its start is not a time to say */
    now: boolean;
    /** the start is a snapshot of an hour long gone: what the figures say is from then */
    outdated: boolean;
    /** civil days from today to the day it leaves */
    startDay: number;
    /** civil days from the day it leaves to the day it arrives */
    endShift: number;
}

const MINUTE = 60000;
const DAY = 24 * 60 * MINUTE;

/** The civil day an instant is in, as a number: in the route's zone, else on the phone's clock. */
function dayOf(at: number, offsetAt: OffsetAt): number {
    return Math.floor((at + (offsetAt(at) ?? -new Date(at).getTimezoneOffset()) * MINUTE) / DAY);
}

/** The civil days from `now` to an instant, in the route's zone, else on the phone's clock. */
export function daysFrom(at: number, now: number, offsetAt: OffsetAt): number {
    return dayOf(at, offsetAt) - dayOf(now, offsetAt);
}

/** How the day is said next to a time: not for today, the weekday for the week to come, else with the date: a day gone has no week to say it in. */
export function dayFormat(days: number): string | undefined {
    return days === 0 ? undefined : days > 0 && days < 7 ? 'ddd' : 'ddd D MMM';
}

/** The ride as it is timed now: with the departure and the pace the route has, else leaving now at the usual pace. */
export function tripTimes(item: StageItem & { analysis?: RouteAnalysis | null }, now: number, zoneOffset?: (tz: string, at: number) => number | undefined): TripTimes | null {
    const inputs = (item.analysis ?? createAnalysis(item.geometry)).inputs;
    const timeline = buildTimeline(timelineSource(item), inputs, now);
    if (!timeline.t.length) {
        return null;
    }
    const start = timeline.at(0);
    const end = timeline.at(timeline.t.length - 1);
    const offsetAt = offsetAtFor(inputs.departure, zoneOffset);
    return {
        start,
        end,
        offsetAt,
        now: floatsWithClock(inputs.departure),
        outdated: snapshotOutdated(inputs.departure, now),
        startDay: daysFrom(start, now, offsetAt),
        endShift: dayOf(end, offsetAt) - dayOf(start, offsetAt)
    };
}
