/** Where the user stands against the risky sections of the route. Pure: nothing here may import NativeScript. */
import type { RiskLevel } from '~/routeFeatures/road/risk';
import type { RoadRun } from '~/routeFeatures/road/sections';

export interface RiskAhead {
    /** the section's first profile index: the same section keeps the same key */
    key: number;
    /** `ahead`: coming up; `on`: on it */
    state: 'ahead' | 'on';
    /** meters to its start, 0 on it */
    distance: number;
    /** meters to its end */
    remaining: number;
    /** km/h */
    speed: number;
    level: RiskLevel;
}

/**
 * The next risky section worth a banner: the one under the user, or the first one at most `lead` meters ahead. A
 * section under `minLength` is the list's, not the banner's: every junction crossing would warn.
 */
export function riskAhead(runs: RoadRun[], data: { d: number }[], index: number, { lead, minLength }: { lead: number; minLength: number }): RiskAhead | null {
    const here = data[index]?.d;
    if (here === undefined) {
        return null;
    }
    // the runs are in route order: the first one not behind and long enough is the one
    for (const { i0, i1, section } of runs) {
        const length = data[i1].d - data[i0].d;
        if (i1 <= index || length < minLength) {
            continue;
        }
        const distance = Math.max(data[i0].d - here, 0);
        if (distance > lead) {
            return null;
        }
        return { key: i0, state: index >= i0 ? 'on' : 'ahead', distance, remaining: data[i1].d - here, speed: section.speed, level: section.level };
    }
    return null;
}
