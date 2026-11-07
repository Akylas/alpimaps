/** A lens' colours as one ramp along the route, for the style's `line-gradient`. Pure: nothing here may import NativeScript. */
import type { LensSlice } from '~/routeFeatures/registry';

/** The SDK bakes the ramp into every tile the route touches: a few hundred stops at most. */
export const MAX_RAMP_STOPS = 300;

export interface GradientOptions {
    /** the colour of each slice key, `#RRGGBB` */
    palette: Record<string, string>;
    /** for a key the palette has not */
    fallback?: string;
    /** a slice the focus does not touch is drawn at this alpha, 0..1 */
    dimmedAlpha?: number;
    focus?: { i0: number; i1: number };
    /** how far a colour reaches into the next one, as a share of the shorter of the two sections: 0 is a hard edge, 0.5 the most */
    blend?: number;
    maxStops?: number;
}

/** a stretch shorter than this share of the route is not a gap */
const GAP_TOLERANCE = 1e-4;
const FALLBACK_COLOR = '#8D96A3';
const DEFAULT_BLEND = 0.1;

/** How far along the line each vertex is, 0..1. In Web Mercator units: the tiles measure a line's progress the same way. */
export function lineProgress(coordinates: number[][]): number[] {
    const toMercator = ([lon, lat]: number[]) => [(lon * Math.PI) / 180, Math.log(Math.tan(Math.PI / 4 + (Math.max(-89.9, Math.min(89.9, lat)) * Math.PI) / 360))];
    const lengths: number[] = [0];
    let previous = coordinates.length ? toMercator(coordinates[0]) : undefined;
    for (let index = 1; index < coordinates.length; index++) {
        const point = toMercator(coordinates[index]);
        lengths.push(lengths[index - 1] + Math.hypot(point[0] - previous[0], point[1] - previous[1]));
        previous = point;
    }
    const total = lengths[lengths.length - 1];
    return total > 0 ? lengths.map((length) => length / total) : lengths.map(() => 0);
}

/** `color` (`#RRGGBB`) at `alpha`: `#RRGGBBAA`. Anything else is left as it is. */
function withAlpha(color: string, alpha: number) {
    return /^#[0-9a-f]{6}$/i.test(color)
        ? color +
              Math.round(alpha * 255)
                  .toString(16)
                  .padStart(2, '0')
        : color;
}

interface Section {
    start: number;
    end: number;
    color: string;
    /** no slice covers it: nothing blends into it */
    gap?: boolean;
}

/**
 * The ramp of a lens' slices as the SDK reads it, `"0:#112233,0.2:#112233,0.2:#445566"`: each slice holds its colour and blends into
 * the next at a boundary, as far as a tenth of the shorter of the two by default. A stretch no slice covers is drawn in `fallback`, with
 * hard edges. `progress` is `lineProgress` of the route, the slices index into it. Slices are expected in route order and
 * in route order; more sections than `maxStops` allows are folded, the shortest first, into the one before them.
 */
export function gradientRamp(progress: number[], slices: LensSlice[], options: GradientOptions): string {
    const { blend = DEFAULT_BLEND, dimmedAlpha = 0.35, fallback = FALLBACK_COLOR, focus, maxStops = MAX_RAMP_STOPS, palette } = options;
    const covered: Section[] = slices
        .filter((slice) => slice.i1 > slice.i0 && progress[slice.i0] !== undefined && progress[slice.i1] !== undefined)
        .sort((first, second) => first.i0 - second.i0)
        .map((slice) => {
            const color = palette[slice.k] ?? fallback;
            const focused = !focus || (slice.i0 <= focus.i1 && slice.i1 >= focus.i0);
            return { start: progress[slice.i0], end: progress[slice.i1], color: focused ? color : withAlpha(color, dimmedAlpha) };
        });
    if (!covered.length) {
        return '';
    }
    const dimmedFallback = focus ? withAlpha(fallback, dimmedAlpha) : fallback;
    const sections: Section[] = [];
    let reached = 0;
    covered.forEach((section) => {
        if (section.start > reached + GAP_TOLERANCE) {
            sections.push({ start: reached, end: section.start, color: dimmedFallback, gap: true });
        }
        sections.push(section);
        reached = Math.max(reached, section.end);
    });
    if (reached < 1 - GAP_TOLERANCE) {
        sections.push({ start: reached, end: 1, color: dimmedFallback, gap: true });
    }
    // two stops a section, and two sections is the least a boundary needs
    const maxSections = Math.max(1, Math.floor(maxStops / 2));
    while (sections.length > maxSections) {
        let shortest = 0;
        sections.forEach((section, index) => {
            if (section.end - section.start < sections[shortest].end - sections[shortest].start) {
                shortest = index;
            }
        });
        const [removed] = sections.splice(shortest, 1);
        if (shortest > 0) {
            sections[shortest - 1].end = removed.end;
        } else {
            sections[0].start = removed.start;
        }
    }
    const reach = (before: Section, after: Section) => (before.gap || after.gap ? 0 : blend) * Math.min(before.end - before.start, after.end - after.start);
    const format = (position: number) => String(Math.round(position * 1e5) / 1e5);
    const stops: string[] = [];
    sections.forEach((section, index) => {
        const flatStart = index ? section.start + reach(sections[index - 1], section) : section.start;
        const flatEnd = index < sections.length - 1 ? section.end - reach(section, sections[index + 1]) : section.end;
        stops.push(`${format(flatStart)}:${section.color}`, `${format(flatEnd)}:${section.color}`);
    });
    return stops.join(',');
}
