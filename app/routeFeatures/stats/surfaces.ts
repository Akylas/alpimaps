/** What the surface lens reads off the route's stats. Pure: nothing here may import NativeScript. */

export interface SurfaceShare {
    id: string;
    /** 0..1 */
    perc: number;
}

export interface SurfaceSegment {
    id: string;
    /** profile data indexes */
    start: number;
    end: number;
}

const PAVED = ['paved_smooth', 'paved', 'paved_rough'];

/** 0..1 of the route on a paved surface. */
export function pavedShare(surfaces: SurfaceShare[]): number {
    return surfaces.filter(({ id }) => PAVED.includes(id)).reduce((total, { perc }) => total + perc, 0);
}

/** The biggest surfaces, biggest first; the ones under 1 % are not worth a word. `unpaved` is the sum of the others. */
export function topSurfaces(surfaces: SurfaceShare[], count: number): SurfaceShare[] {
    return surfaces
        .filter(({ id, perc }) => perc >= 0.01 && id !== 'unpaved')
        .sort((first, second) => second.perc - first.perc)
        .slice(0, count);
}

/** How dark each surface is on e-ink, 0 to 255: the rougher and the less paved, the darker. */
export const surfaceShades: Record<string, number> = {
    paved: 45,
    street: 55,
    cycleway: 50,
    highway: 60,
    road: 60,
    paved_smooth: 70,
    paved_rough: 100,
    compacted: 125,
    gravel: 150,
    track: 150,
    dirt: 170,
    path: 185,
    sac_scale_1: 195,
    sac_scale_2: 195,
    sac_scale_3: 195,
    steps: 205,
    sac_scale_4: 215,
    sac_scale_5: 215,
    sac_scale_6: 215
};
const UNKNOWN_SURFACE_SHADE = 120;

export const surfaceShade = (id: string) => surfaceShades[id] ?? UNKNOWN_SURFACE_SHADE;

/** Gradient stops for the profile fill, one per segment, as indices into the profile data; the shade is for where colour is lost, on e-ink. */
export function surfaceStops(segments: SurfaceSegment[], colors: Record<string, string>, fallbackColor: string): { d: number; color: string; shade: number }[] {
    return segments.map(({ id, start }) => ({ d: start, color: colors[id] ?? fallbackColor, shade: surfaceShade(id) })).sort((first, second) => first.d - second.d);
}

/** The key of a surface slice in the lens palette. */
export function surfaceKey(id: string) {
    return 'surface_' + id;
}

/** Where the stats card puts its legend, dp from its top, and how tall a row of it is: the card is as tall as its longest legend. */
export const STATS_LEGEND_TOP = 58;
export const STATS_LEGEND_ROW = 20;
const STATS_BOTTOM_PADDING = 12;
const STATS_MAX_ROWS = 6;

/** dp the stats card needs, `counts` being how many lines each of the views it reads in turn has: the legend runs two to a row. */
export function statsCardHeight(counts: number[]): number {
    const rows = Math.min(Math.max(1, ...counts.map((count) => Math.ceil(count / 2))), STATS_MAX_ROWS);
    return STATS_LEGEND_TOP + rows * STATS_LEGEND_ROW + STATS_BOTTOM_PADDING;
}
