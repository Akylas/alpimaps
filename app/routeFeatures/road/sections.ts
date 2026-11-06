/** What the road lens shows of the risky sections: slices, speed signs, marks, the profile fill. Pure: nothing here may import NativeScript. */
import type { AttentionMark, LensSection, LensSlice, LensSymbol, ProfileFillStop } from '~/routeFeatures/registry';
import { ROAD_COLORS, ROAD_CORE_KEY, riskKey } from '~/routeFeatures/road/palette';
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
    fill: ProfileFillStop[];
}

/** meters between two speed signs of a long run */
const SIGN_SPACING = 2000;
const FILL_PATTERNS: Record<RiskLevel, ProfileFillStop['pattern']> = { 2: 'diagonal', 3: 'cross' };

/** The first profile index at or after a distance, the last one when it is past the end. */
export function indexAt(data: { d: number }[], distance: number): number {
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
    return low;
}

/** The sections on the profile, in route order, each starting where the one before ended and at least one step long. */
function runsOf(sections: RiskSection[], data: { d: number }[]): RoadRun[] {
    const last = data.length - 1;
    const runs: RoadRun[] = [];
    let cursor = 0;
    sections
        .slice()
        .sort((first, second) => first.startDist - second.startDist)
        .forEach((section) => {
            const i0 = Math.max(indexAt(data, section.startDist), cursor);
            const i1 = Math.min(Math.max(indexAt(data, section.startDist + section.length), i0 + 1), last);
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
    const fill: ProfileFillStop[] = [{ d: 0, color: ROAD_COLORS.core, pattern: 'solid' }];
    let cursor = 0;
    runs.forEach(({ i0, i1, section }) => {
        if (i0 > cursor) {
            slices.push({ i0: cursor, i1: i0, k: ROAD_CORE_KEY, s: 0 });
        }
        slices.push({ i0, i1, k: riskKey(section.level), s: section.level });
        if (fill[fill.length - 1].d === i0) {
            fill.pop();
        }
        fill.push({ d: i0, color: ROAD_COLORS[section.level], pattern: FILL_PATTERNS[section.level] }, { d: i1, color: ROAD_COLORS.core, pattern: 'solid' });
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
            return Array.from({ length: count }, (_, position): LensSymbol => {
                const distance = section.startDist + (section.length * (position + 0.5)) / count;
                return {
                    shape: 'speed_sign',
                    vertex: Math.min(Math.max(indexAt(data, distance), i0), i1),
                    label: words.speedNumber(section.speed),
                    severity: section.level,
                    priority: 40 + section.level * 10
                };
            });
        }),
        marks: runs.map(({ section }, id) => ({ kind: 'fast' as const, color: ROAD_COLORS[section.level], tier: section.level, lens: 'road' as const, section: lensSections[id] })),
        fill
    };
}
