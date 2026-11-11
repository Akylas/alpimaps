/** What the profile says of the way ahead of the rider. Pure: nothing here may import NativeScript. */
import type { RouteProfile } from '~/models/Item';

/** meters of route the profile page shows */
export const PROFILE_AHEAD_SPAN = 15000;

/** The first vertex at or past `distance` meters, the last one when the route ends before it. */
export function indexAtDistance(data: { d: number }[], distance: number): number {
    let low = 0;
    let high = data.length - 1;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (data[middle].d < distance) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    return Math.max(low, 0);
}

export interface ProfileAhead {
    fromIndex: number;
    toIndex: number;
    /** meters of climb in the stretch */
    ascent: number;
    /** climbs that are in the stretch, even in part */
    climbs: number;
}

/** The `span` meters of route from the vertex the rider is at, null without a profile. */
export function profileAhead(profile: RouteProfile | undefined, index: number, span = PROFILE_AHEAD_SPAN): ProfileAhead | null {
    const data = profile?.data;
    if (!data?.length) {
        return null;
    }
    const fromIndex = Math.min(Math.max(index, 0), data.length - 1);
    const toIndex = indexAtDistance(data, data[fromIndex].d + span);
    const gain = data[toIndex].dp - data[fromIndex].dp;
    return {
        fromIndex,
        toIndex,
        ascent: gain > 0 ? gain : 0,
        climbs: (profile.ascents ?? []).filter((ascent) => ascent.endIndex > fromIndex && ascent.startIndex < toIndex).length
    };
}
