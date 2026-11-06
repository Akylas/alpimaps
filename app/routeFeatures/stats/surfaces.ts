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

/** Gradient stops for the profile fill, one per segment, as indices into the profile data; the hatch is for where colour is not enough. */
export function surfaceStops<Pattern extends string>(
    segments: SurfaceSegment[],
    colors: Record<string, string>,
    patterns: Record<string, Pattern>,
    fallbackColor: string,
    fallbackPattern: Pattern
): { d: number; color: string; pattern: Pattern }[] {
    return segments.map(({ id, start }) => ({ d: start, color: colors[id] ?? fallbackColor, pattern: patterns[id] ?? fallbackPattern })).sort((first, second) => first.d - second.d);
}

/** The key of a surface slice in the lens palette. */
export function surfaceKey(id: string) {
    return 'surface_' + id;
}
