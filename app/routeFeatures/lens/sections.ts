/** The sections of a lens, on the map and on the profile. Pure: nothing here may import NativeScript. */
import type { Feature, Geometry } from 'geojson';
import type { LensId, LensSection, LensSlice, LensSymbol, NavAlert } from '~/routeFeatures/registry';

/**
 * The map's version of a lens: the focused section's own `lensfocus` line for a halo, then one `lens` line per
 * slice, faded (`f` 0) when another section is focused. The look is the style's, see `routelens.mss`.
 */
export function lensFeatures(coordinates: number[][], lens: LensId, slices: LensSlice[], focus?: { i0: number; i1: number }): Feature[] {
    const features: Feature[] = [];
    // first: a feature is drawn after the ones before it, and the halo goes under the slices
    const halo = focus && coordinates.slice(focus.i0, focus.i1 + 1);
    if (halo?.length > 1) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: halo }, properties: { class: 'lensfocus', lens } });
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
        .filter((symbol) => coordinates[symbol.i])
        .map(({ i: vertex, ...properties }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coordinates[vertex] }, properties: { class: 'lsym', ...properties } }));
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
