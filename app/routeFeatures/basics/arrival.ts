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

/** How far a zone is from UTC at an instant, in minutes. */
export function zoneOffsetMinutes(zone: string, epochMs: number): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    }).formatToParts(new Date(epochMs));
    const field = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const wallClockAsUtc = Date.UTC(field('year'), field('month') - 1, field('day'), field('hour'), field('minute'), field('second'));
    return Math.round((wallClockAsUtc - Math.floor(epochMs / 1000) * 1000) / 60000);
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
    const { fromPhone, tz } = routeTimeZone(inputs.departure);
    return { at, offset: fromPhone ? undefined : zoneOffsetMinutes(tz, at) };
}
