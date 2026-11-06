import { derived, get } from 'svelte/store';
import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { IItem } from '~/models/Item';
import { computeLayers, layerStatuses, routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
import { routeLensStore } from '~/routeFeatures/lens/routeLensStore';
import { alertFeatures, routeCoordinates, symbolFeatures } from '~/routeFeatures/lens/sections';
import {
    type LensChip,
    type LensFact,
    type LensHeadline,
    type LensProfile,
    type RouteCtx,
    type RouteLens,
    type RoutePageSection,
    type RouteTile,
    registerRouteFeature
} from '~/routeFeatures/registry';
import { roadLegend } from '~/routeFeatures/road/legend';
import { roadPalette } from '~/routeFeatures/road/palette';
import { readRoad, roadWords } from '~/routeFeatures/road/read';
import { roadRows } from '~/routeFeatures/road/rows';
import { riskStage } from '~/routeFeatures/road/stage';
import { roadSettingRows, roadSettingsKey, routeFeatureRoad } from '~/routeFeatures/road/settings';
import { activityOf } from '~/utils/routeAnalysis/activity';
import type { LayerStatus } from '~/utils/routeAnalysis/freshness';

const statusOf = (item: IItem) => layerStatuses(item).risk;

/** A computed route ridden by bike: an imported track has no costing to read the roads with. */
const isBikeRoute = (item: IItem) => !!item?.route && !item.properties?.imported && activityOf(item, item.analysis)?.kind === 'bike';

function chipState(status: LayerStatus): LensChip['state'] {
    switch (status.state) {
        case 'absent':
        case 'failed':
            return 'missing';
        case 'queued':
        case 'running':
            return 'running';
        case 'inputs-changed':
            return 'outdated';
        default:
            return undefined;
    }
}

const compute = (item: IItem) => () => computeLayers(item, ['risk']);

// the fills are built once per read: the chart redraws for a new one
const fills = new WeakMap<object, LensProfile>();

function missingHeadline(item: IItem, status: LayerStatus): LensHeadline {
    switch (status.state) {
        case 'queued':
        case 'running':
            return { facts: [{ icon: 'mdi-road-variant', text: lc('road_computing') }] };
        case 'failed':
            return { facts: [{ icon: 'mdi-alert-circle-outline', text: lc('road_failed'), alert: true }], action: { label: lc('road_retry'), run: compute(item) } };
        default:
            return { facts: [{ icon: 'mdi-road-variant', text: lc('road_not_computed') }], action: { label: lc('road_compute'), run: compute(item) } };
    }
}

const roadLens: RouteLens = {
    id: 'road',
    icon: 'mdi-car-brake-alert',
    label: () => lc('lens_road'),
    available: ({ item }) => isBikeRoute(item),
    chip: ({ item }) => {
        const read = readRoad(item);
        const chip: LensChip = { state: chipState(statusOf(item)) };
        if (read?.runs.length) {
            chip.value = formatDistance(read.exposed);
            chip.alert = read.runs.some(({ section }) => section.level === 3);
        }
        return chip;
    },
    headline: ({ item }) => {
        const status = statusOf(item);
        const read = readRoad(item);
        if (!read) {
            return missingHeadline(item, status);
        }
        const facts: LensFact[] = read.runs.length
            ? [{ icon: 'mdi-alert-outline', text: lc('road_fast_km', formatDistance(read.exposed)), alert: read.runs.some(({ section }) => section.level === 3) }]
            : [{ icon: 'mdi-check-circle-outline', text: lc('road_none') }];
        if (read.unknown > 0) {
            facts.push({ icon: 'mdi-help-circle-outline', text: lc('road_unknown', formatDistance(read.unknown)) });
        }
        if (status.state === 'running' || status.state === 'queued') {
            facts.push({ icon: 'mdi-road-variant', text: lc('road_computing') });
        }
        return { facts, action: status.state === 'failed' ? { label: lc('road_retry'), run: compute(item) } : undefined };
    },
    readout: ({ index, item }) => {
        const run = readRoad(item)?.runs.find(({ i0, i1 }) => index >= i0 && index <= i1);
        return run && `${lc(run.section.level === 3 ? 'road_level_high' : 'road_level_medium')} · ${roadWords.speed(run.section.speed)}`;
    },
    profile: ({ item }) => {
        const read = readRoad(item);
        if (!read) {
            return {};
        }
        if (!fills.has(read)) {
            fills.set(read, { fill: read.fill });
        }
        return fills.get(read);
    },
    sections: ({ item }) => readRoad(item)?.sections ?? [],
    slices: ({ item }) => readRoad(item)?.slices ?? [],
    symbols: ({ item }) => readRoad(item)?.symbols ?? [],
    legend: ({ palette, translate, variant }) => roadLegend({ palette, translate, variant })
};

function roadTiles({ item }: RouteCtx): RouteTile[] {
    const read = isBikeRoute(item) ? readRoad(item) : null;
    // nothing to say, nothing to show
    return read?.runs.length ? [{ key: 'risk', icon: 'mdi-alert-outline', label: lc('road_fast_tile'), value: formatDistance(read.exposed), lens: 'road', alert: true }] : [];
}

const roadPageSection: RoutePageSection = {
    id: 'road',
    icon: 'mdi-car-brake-alert',
    title: () => lc('road_safety'),
    lens: 'road',
    summary: ({ item }) => {
        const read = readRoad(item);
        return read && (read.runs.length ? lc('road_fast_km', formatDistance(read.exposed)) : lc('road_none'));
    },
    rows: ({ item }) => {
        const data = item?.profile?.data;
        return isBikeRoute(item) ? roadRows(readRoad(item), data?.[data.length - 1]?.d ?? 0) : [];
    },
    component: () => import('~/routeFeatures/road/RoadSafetyRow.svelte')
};

registerRouteFeature({
    id: 'road',
    order: 13,
    setting: { title: () => lc('road_safety'), store: routeFeatureRoad },
    settings: roadSettingRows,
    // a layer finishing or failing, a threshold or a minimum length reading the same layer again, and the lens: the signs are the lens' own in the road lens
    changes: derived([routeAnalysisChanges, roadSettingsKey, routeLensStore], (values) => values.join()),
    lensPalette: roadPalette,
    lenses: [roadLens],
    tiles: roadTiles,
    pageSections: [roadPageSection],
    attention: ({ item }) => (isBikeRoute(item) ? (readRoad(item)?.marks ?? []) : []),
    navBanners: [{ id: 'road', component: () => import('~/routeFeatures/road/RiskBanner.svelte') }],
    // while following the route, whatever the lens: the fast casing, and the signs unless the road lens draws them
    mapFeatures: ({ item, navigating }) => {
        const read = navigating && isBikeRoute(item) ? readRoad(item) : null;
        if (!read?.alerts.length) {
            return [];
        }
        const coordinates = routeCoordinates(item.geometry);
        return [...alertFeatures(coordinates, read.alerts), ...(get(routeLensStore) === 'road' ? [] : symbolFeatures(coordinates, read.symbols))];
    },
    compute: riskStage
});
