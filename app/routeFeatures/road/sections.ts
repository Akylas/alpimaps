/** What the road lens shows of the risky sections: slices, speed signs, marks, the profile fill. Pure: nothing here may import NativeScript. */
import type { AttentionMark, LensSection, LensSlice, LensSymbol, NavAlert, ProfileFillStop } from '~/routeFeatures/registry';
import { ROAD_COLORS, ROAD_CORE_KEY, ROAD_MARK_COLOR, ROAD_SHADES, riskKey } from '~/routeFeatures/road/palette';
import type { RiskLevel, RiskSection } from '~/routeFeatures/road/risk';

/** How the figures are said, in the units the user chose. */
export interface RoadWords {
    speed: (kmh: number) => string;
    speedNumber: (kmh: number) => string;
    distance: (meters: number) => string;
}

/** A risky section on the route's profile: `i0`..`i1` are profile data indexes. */
export interface RoadRun {
    section: RiskSection;
    i0: number;
    i1: number;
}

export interface RoadRead {
    runs: RoadRun[];
    /** meters on fast roads without a separated lane */
    exposed: number;
    /** meters of motor road with no tagged limit, not evaluated */
    unknown: number;
    sections: LensSection[];
    slices: LensSlice[];
    symbols: LensSymbol[];
    marks: AttentionMark[];
    /** while following the route: the fast runs, to get ready for them */
    alerts: NavAlert[];
    fill: ProfileFillStop[];
}

/** meters between two speed signs of a long run */
const SIGN_SPACING = 2000;

/**
 * The sections on the profile, in route order, each starting where the one before ended and at least one step long. They are
 * placed by the shape indexes of the match, as the surface segments are: the meters of the edges are the figures, not the place.
 */
function runsOf(sections: RiskSection[], data: { d: number }[]): RoadRun[] {
    const last = data.length - 1;
    const runs: RoadRun[] = [];
    let cursor = 0;
    sections
        .slice()
        .sort((first, second) => first.start - second.start)
        .forEach((section) => {
            const i0 = Math.max(section.start, cursor);
            const i1 = Math.min(Math.max(section.end, i0 + 1), last);
            if (i1 > i0) {
                runs.push({ section, i0, i1 });
                cursor = i1;
            }
        });
    return runs;
}

export function buildRoadRead(sections: RiskSection[], unknown: number, data: { d: number }[], words: RoadWords): RoadRead {
    const last = data.length - 1;
    const runs = runsOf(sections, data);
    const slices: LensSlice[] = [];
    const fill: ProfileFillStop[] = [{ d: 0, color: ROAD_COLORS.core, shade: ROAD_SHADES.core }];
    let cursor = 0;
    runs.forEach(({ i0, i1, section }) => {
        if (i0 > cursor) {
            slices.push({ i0: cursor, i1: i0, k: ROAD_CORE_KEY, s: 0 });
        }
        slices.push({ i0, i1, k: riskKey(section.level), s: section.level });
        if (fill[fill.length - 1].d === i0) {
            fill.pop();
        }
        fill.push({ d: i0, color: ROAD_COLORS[section.level], shade: ROAD_SHADES[section.level] }, { d: i1, color: ROAD_COLORS.core, shade: ROAD_SHADES.core });
        cursor = i1;
    });
    if (last > 0 && cursor < last) {
        slices.push({ i0: cursor, i1: last, k: ROAD_CORE_KEY, s: 0 });
    }
    const lensSections = runs.map(({ i0, i1, section }, id): LensSection => ({ id, i0, i1, title: `${words.speed(section.speed)} · ${words.distance(section.length)}` }));
    return {
        runs,
        exposed: runs.reduce((total, { section }) => total + section.length, 0),
        unknown,
        sections: lensSections,
        slices,
        // a sign in the middle of the run, and one every 2 km along a long one
        symbols: runs.flatMap(({ i0, i1, section }) => {
            const count = Math.max(1, Math.round(section.length / SIGN_SPACING));
            return Array.from(
                { length: count },
                (_, position): LensSymbol => ({
                    shape: 'speed_sign',
                    vertex: Math.min(i0 + Math.round(((i1 - i0) * (position + 0.5)) / count), i1),
                    label: words.speedNumber(section.speed),
                    severity: section.level,
                    priority: 40 + section.level * 10
                })
            );
        }),
        marks: runs.map(({ section }, id) => ({ kind: 'fast' as const, color: ROAD_MARK_COLOR, lens: 'road' as const, section: lensSections[id] })),
        alerts: runs.map(({ i0, i1, section }) => ({ kind: 'fast' as const, i0, i1, s: section.level })),
        fill
    };
}
