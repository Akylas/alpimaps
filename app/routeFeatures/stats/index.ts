import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { surfaceKey } from '~/routeFeatures/lens/lensPalette';
import { type LensProfile, type LensSection, type LensSlice, type RouteLens, registerRouteFeature } from '~/routeFeatures/registry';
import { routeFeatureStats } from '~/routeFeatures/stats/settings';
import { pavedShare, surfaceStops, topSurfaces } from '~/routeFeatures/stats/surfaces';
import { ROUTE_STATS_HEIGHT } from '~/utils/navigation';
import type { IItem } from '~/models/Item';
import { surfaceColors } from '~/utils/routing';
import { surfacePatterns } from '~/utils/surfacePattern';

const STATS_HEIGHT = 164;
// a surface the palette does not know
const UNKNOWN_SURFACE_COLOR = '#B9C2C8';

const percent = (share: number) => Math.round(share * 100) + ' %';

// the stats are replaced, never edited, so they key what the profile fill was built from
const fills = new WeakMap<object, LensProfile>();

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
    profile: ({ item }) => {
        const segments = item.stats.surfaceSegments;
        if (!segments?.length) {
            return {};
        }
        if (!fills.has(segments)) {
            fills.set(segments, { fill: surfaceStops(segments, surfaceColors, surfacePatterns, UNKNOWN_SURFACE_COLOR, 'cross') });
        }
        return fills.get(segments);
    },
    sections: ({ item }) => readSegments(item).sections,
    slices: ({ item }) => readSegments(item).slices
};

registerRouteFeature({
    id: 'stats',
    order: 20,
    setting: { title: () => lc('road_stats'), store: routeFeatureStats },
    lenses: [surfaceLens],
    pageSections: [
        {
            id: 'stats',
            icon: 'mdi-chart-bar-stacked',
            title: () => lc('road_stats'),
            lens: 'surface',
            summary: ({ item }) => (item.stats?.surfaces?.length ? `${percent(pavedShare(item.stats.surfaces))} ${lc('paved')}` : undefined),
            rows: ({ item }) => (item?.route && item.stats ? [{ key: 'stats', height: STATS_HEIGHT }] : []),
            component: () => import('~/routeFeatures/stats/RouteStatsView.svelte')
        }
    ],
    sheetCard: {
        component: () => import('~/routeFeatures/stats/RouteStatsView.svelte'),
        height: ({ item }) => (item?.route && item.stats ? STATS_HEIGHT : 0)
    },
    navSections: [
        {
            id: 'stats',
            slot: 'details',
            component: () => import('~/routeFeatures/stats/RouteStatsView.svelte'),
            height: (_scale, { item }) => (item?.stats ? ROUTE_STATS_HEIGHT + 8 : 0)
        }
    ]
});
