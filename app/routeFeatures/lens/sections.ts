/** The sections of a lens, on the map and on the profile. Pure: nothing here may import NativeScript. */
import type { Feature, Geometry } from 'geojson';
import { gradientRamp, lineProgress } from '~/routeFeatures/lens/gradient';
import type { LensId, LensSection, LensSlice, LensSymbol, NavAlert } from '~/routeFeatures/registry';

/**
 * The map's version of a lens: the focused section's own `lensfocus` line for a halo, then one `lens` line per
 * slice, faded (`f` 0) when another section is focused. The look is the style's, see `routelens.mss`.
 * With a `gradientPalette` the slices are one `lens` line for the whole route instead, its colours a `gradient` ramp (the focus dims
 * it there), and the steep slices come as `lens_chev` lines for the chevrons. The source needs `lineMetrics`.
 */
export function lensFeatures(coordinates: number[][], lens: LensId, slices: LensSlice[], focus?: { i0: number; i1: number }, gradientPalette?: Record<string, string>): Feature[] {
    const features: Feature[] = [];
    // first: a feature is drawn after the ones before it, and the halo goes under the slices
    const halo = focus && coordinates.slice(focus.i0, focus.i1 + 1);
    if (halo?.length > 1) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: halo }, properties: { class: 'lensfocus', lens } });
    }
    if (gradientPalette) {
        const gradient = gradientRamp(lineProgress(coordinates), slices, { palette: gradientPalette, focus });
        if (gradient) {
            features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { class: 'lens', lens, gradient, ramp: 1, f: 1, id: 0 } });
            slices.forEach((slice) => {
                const line = coordinates.slice(slice.i0, slice.i1 + 1);
                if (slice.s >= 2 && line.length > 1) {
                    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: { class: 'lens_chev', lens, s: slice.s } });
                }
            });
        }
        return features;
    }
    slices.forEach((slice, id) => {
        const line = coordinates.slice(slice.i0, slice.i1 + 1);
        if (line.length > 1) {
            const focused = !focus || (slice.i0 <= focus.i1 && slice.i1 >= focus.i0);
            features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: { class: 'lens', lens, k: slice.k, s: slice.s, f: focused ? 1 : 0, id } });
        }
    });
    return features;
}

/** The plates of a lens, one point each. */
export function symbolFeatures(coordinates: number[][], symbols: LensSymbol[]): Feature[] {
    return symbols
        .filter((symbol) => coordinates[symbol.vertex])
        .map(({ vertex, ...properties }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coordinates[vertex] }, properties: { class: 'lens_symbol', ...properties, at: vertex } }));
}

/** The stretches to watch while following the route, drawn whatever the lens. */
export function alertFeatures(coordinates: number[][], alerts: NavAlert[]): Feature[] {
    const features: Feature[] = [];
    alerts.forEach(({ i0, i1, ...properties }) => {
        const line = coordinates.slice(i0, i1 + 1);
        if (line.length > 1) {
            features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: { class: 'navalert', ...properties } });
        }
    });
    return features;
}

/** The next or previous section by position, wrapping round; the first or last when none is focused. */
export function stepSection(sections: LensSection[], current: { i0: number } | undefined, direction: 1 | -1): LensSection | undefined {
    const ordered = sections.slice().sort((first, second) => first.i0 - second.i0);
    if (!current) {
        return direction > 0 ? ordered[0] : ordered[ordered.length - 1];
    }
    if (direction > 0) {
        return ordered.find((section) => section.i0 > current.i0) ?? ordered[0];
    }
    return ordered.reverse().find((section) => section.i0 < current.i0) ?? ordered[0];
}

/** The section a route vertex is in. */
export function sectionAt(sections: LensSection[], index: number): LensSection | undefined {
    return sections.find((section) => index >= section.i0 && index <= section.i1);
}

/** What the profile zooms to for a section: the section and a tenth of its length on each side. */
export function paddedRange(section: { i0: number; i1: number }, count: number): { fromIndex: number; toIndex: number } {
    const padding = Math.max(1, Math.round((section.i1 - section.i0) / 10));
    return { fromIndex: Math.max(0, section.i0 - padding), toIndex: Math.min(count - 1, section.i1 + padding) };
}

const LENS_CLASSES = ['lens', 'lens_chev', 'lensfocus', 'lens_symbol', 'navalert'];

/** Whether a tapped feature is something the lens drew, not an item. */
export function isLensFeature(featureData: Record<string, unknown> | undefined): boolean {
    return typeof featureData?.class === 'string' && LENS_CLASSES.includes(featureData.class);
}

/** The route vertex a tap on the route, one of its slices or a plate means: a plate knows its own, the rest is where the tap landed. */
export function tappedVertex(featureData: Record<string, unknown>, coordinates: number[][], position: { lat: number; lon: number }): number {
    return featureData.class === 'lens_symbol' && typeof featureData.at === 'number' ? featureData.at : nearestIndex(coordinates, position.lat, position.lon);
}

/** The vertex closest to a point, -1 on an empty route. */
export function nearestIndex(coordinates: number[][], lat: number, lon: number): number {
    const lonScale = Math.cos((lat * Math.PI) / 180);
    let nearest = -1;
    let nearestDistance = Infinity;
    coordinates.forEach(([pointLon, pointLat], index) => {
        const distance = Math.hypot((pointLon - lon) * lonScale, pointLat - lat);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = index;
        }
    });
    return nearest;
}

/** The vertices of a route, a `MultiLineString` flattened the way the profile is. */
export function routeCoordinates(geometry: Geometry | undefined): number[][] {
    return geometry?.type === 'LineString' ? geometry.coordinates : geometry?.type === 'MultiLineString' ? geometry.coordinates.flat() : [];
}
