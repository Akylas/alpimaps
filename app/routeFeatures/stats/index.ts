import { get } from 'svelte/store';
import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { surfaceLegend } from '~/routeFeatures/stats/legend';
import { surfacePalette } from '~/routeFeatures/stats/palette';
import { routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
import { type LensProfile, type LensSection, type LensSlice, type RouteLens, registerRouteFeature, routeFeatures, routeStatViews } from '~/routeFeatures/registry';
import { routeFeatureStats } from '~/routeFeatures/stats/settings';
import { shadeGrey } from '~/routeFeatures/lens/shades';
import { pavedShare, statsCardHeight, surfaceKey, surfaceShade, surfaceStops, topSurfaces } from '~/routeFeatures/stats/surfaces';
import type { IItem } from '~/models/Item';
import { surfaceColors } from '~/utils/routing';
import { weakMemo } from '~/utils/weakMemo';

/** dp: the card is as tall as the longest legend of the views it reads in turn */
function statsHeight(item: IItem) {
    if (!item?.route || !item.stats) {
        return 0;
    }
    const features = get(routeFeatures);
    const extra = routeStatViews(features, { item }).map((view) => view.rows({ item }).length);
    return statsCardHeight([item.stats.waytypes?.length ?? 0, item.stats.surfaces?.length ?? 0, ...extra]);
}
// a surface the palette does not know
const UNKNOWN_SURFACE_COLOR = '#B9C2C8';

const percent = (share: number) => Math.round(share * 100) + ' %';

// the stats are replaced, never edited, so they key what the profile asks of the chart: the same object for as long as they are
const surfaceProfile = weakMemo((stats: NonNullable<IItem['stats']>): LensProfile => {
    const { surfaceSegments, surfaces } = stats;
    // stats saved before the segments were kept have none: a route of one surface is still all of it
    const segments = surfaceSegments?.length ? surfaceSegments : surfaces.length === 1 ? [{ id: surfaces[0].id, start: 0, end: 0 }] : null;
    if (!segments) {
        return {};
    }
    return {
        fill: surfaceStops(segments, surfaceColors, UNKNOWN_SURFACE_COLOR),
        // what each colour is, in the line under the chart
        legend: topSurfaces(surfaces, 4).map(({ id }) => ({ label: lc(id), color: surfaceColors[id] ?? UNKNOWN_SURFACE_COLOR, eink: shadeGrey(surfaceShade(id)) }))
    };
});

const NO_SECTIONS: LensSection[] = [];
const NO_SLICES: LensSlice[] = [];
const segmentReads = new WeakMap<object, { sections: LensSection[]; slices: LensSlice[] }>();

function readSegments(item: IItem) {
    const segments = item.stats?.surfaceSegments;
    if (!segments?.length) {
        return { sections: NO_SECTIONS, slices: NO_SLICES };
    }
    if (!segmentReads.has(segments)) {
        const data = item.profile?.data;
        segmentReads.set(segments, {
            sections: segments.map(({ end, id, start }, index) => ({
                id: index,
                i0: start,
                i1: end,
                title: data?.[end] && data[start] ? `${lc(id)} · ${formatDistance(data[end].d - data[start].d)}` : lc(id)
            })),
            slices: segments.map(({ end, id, start }) => ({ i0: start, i1: end, k: surfaceKey(id), s: 0 }))
        });
    }
    return segmentReads.get(segments);
}

const surfaceLens: RouteLens = {
    id: 'surface',
    icon: 'mdi-road-variant',
    label: () => lc('lens_surface'),
    available: ({ item }) => !!item?.route && item.stats?.surfaces?.length > 0,
    chip: ({ item }) => ({ value: `${percent(pavedShare(item.stats.surfaces))} ${lc('paved')}` }),
    // each surface with the colour it has on the profile, which makes the headline its legend
    headline: ({ item }) => ({
        facts: topSurfaces(item.stats.surfaces, 3).map(({ id, perc }) => ({ icon: 'mdi-square-rounded', color: surfaceColors[id] ?? UNKNOWN_SURFACE_COLOR, text: `${percent(perc)} ${lc(id)}` }))
    }),
    readout: ({ index, item }) => {
        const segment = item.stats?.surfaceSegments?.find(({ end, start }) => index >= start && index <= end);
        return segment && lc(segment.id);
    },
    profile: ({ item }) => surfaceProfile(item.stats),
    sections: ({ item }) => readSegments(item).sections,
    slices: ({ item }) => readSegments(item).slices,
    legend: ({ item, palette, translate, variant }) => surfaceLegend({ palette, surfaces: [...new Set((item.stats?.surfaceSegments ?? []).map(({ id }) => id))], translate, variant })
};

registerRouteFeature({
    id: 'stats',
    order: 20,
    setting: { title: () => lc('road_stats'), store: routeFeatureStats },
    // the views other features add to the card change what it needs to show
    changes: routeAnalysisChanges,
    lensPalette: surfacePalette,
    lenses: [surfaceLens],
    pageSections: [
        {
            id: 'stats',
            icon: 'mdi-chart-bar-stacked',
            title: () => lc('road_stats'),
            lens: 'surface',
            summary: ({ item }) => (item.stats?.surfaces?.length ? `${percent(pavedShare(item.stats.surfaces))} ${lc('paved')}` : undefined),
            rows: ({ item }) => (item?.route && item.stats ? [{ key: 'stats', height: statsHeight(item) }] : []),
            component: () => import('~/routeFeatures/stats/RouteStatsView.svelte')
        }
    ],
    sheetCard: {
        component: () => import('~/routeFeatures/stats/RouteStatsView.svelte'),
        height: ({ item }) => statsHeight(item)
    }
});
