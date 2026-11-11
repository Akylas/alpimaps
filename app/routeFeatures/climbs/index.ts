import { showError } from '@shared/utils/showError';
import { convertElevation, formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { derived, get } from 'svelte/store';
import { categoryLabel, climbsRows, readClimbs } from '~/routeFeatures/climbs/data';
import { climbsSettingRows, climbsSettingsKey, climbsSteepOpen, routeFeatureClimbs } from '~/routeFeatures/climbs/settings';
import { climbsLegend } from '~/routeFeatures/climbs/legend';
import { gradePalette } from '~/routeFeatures/climbs/palette';
import { getMapContext } from '~/mapModules/MapModule';
import type { IItem } from '~/models/Item';
import { alertFeatures, routeCoordinates, symbolFeatures } from '~/routeFeatures/lens/sections';
import { type LensFact, type RouteLens, type RoutePageSection, registerRouteFeature } from '~/routeFeatures/registry';

// loaded when asked for: the sheet and its component are not part of the startup graph
async function showClimbsSection(item: IItem) {
    try {
        const { showBottomSheet } = await import('@nativescript-community/ui-bottomsheet/svelte');
        const ClimbsSection = (await import('~/routeFeatures/climbs/ClimbsSection.svelte')).default;
        await showBottomSheet({
            parent: getMapContext().getMainPage(),
            trackingScrollView: 'scrollView',
            detents: [SECTION_SHEET_HEIGHT, 'large'],
            initialDetentIndex: 0,
            view: ClimbsSection,
            props: { item }
        });
    } catch (error) {
        showError(error);
    }
}

const SECTION_SHEET_HEIGHT = 380;

const climbsLens: RouteLens = {
    id: 'climbs',
    icon: 'mdi-slope-uphill',
    label: () => lc('lens_climbs'),
    available: ({ item }) => !!item?.route && !!readClimbs(item),
    chip: ({ item }) => {
        const read = readClimbs(item);
        // a steep way up puts a dot on the chip; the profile marks where
        return read ? { value: String(read.climbs.length), alert: read.marks.length > 0 } : {};
    },
    headline: ({ item }) => {
        const read = readClimbs(item);
        if (!read?.climbs.length) {
            return { facts: [{ text: lc('climbs_none') }] };
        }
        const { best } = read;
        const facts: LensFact[] = [{ icon: 'mdi-slope-uphill', text: read.climbs.length === 1 ? lc('climbs_count_one') : lc('climbs_count', read.climbs.length) }];
        if (best.category) {
            facts.push({ icon: 'mdi-triangle-outline', text: lc('climb_summit_at', categoryLabel(best.category), formatDistance(best.endDistance)) });
        }
        const ascent = item.profile?.dplus;
        if (ascent > 0) {
            facts.push({ icon: 'mdi-arrow-top-right', text: convertElevation(ascent) });
        }
        return { facts };
    },
    openSection: ({ item }) => {
        const read = readClimbs(item);
        return read?.climbs.length || read?.steep.length ? () => showClimbsSection(item) : undefined;
    },
    profile: ({ item }) => ({ brackets: readClimbs(item)?.brackets }),
    sections: ({ item }) => readClimbs(item)?.sections ?? [],
    slices: ({ item }) => readClimbs(item)?.slices ?? [],
    symbols: ({ item }) => readClimbs(item)?.symbols ?? [],
    legend: ({ palette, translate, variant }) => climbsLegend({ palette, translate, variant })
};

const climbsPageSection: RoutePageSection = {
    id: 'climbs',
    icon: 'mdi-slope-uphill',
    title: () => lc('lens_climbs'),
    lens: 'climbs',
    summary: ({ item }) => {
        const read = readClimbs(item);
        if (!read?.climbs.length) {
            return lc('climbs_none');
        }
        const ascent = item.profile?.dplus;
        return [read.climbs.length === 1 ? lc('climbs_count_one') : lc('climbs_count', read.climbs.length), ascent > 0 && '+' + convertElevation(ascent)].filter(Boolean).join(' · ');
    },
    rows: ({ item }) => climbsRows(readClimbs(item), get(climbsSteepOpen)).map((row) => ({ key: row.type === 'header' ? 'header' : `${row.type}${row.id}`, data: row })),
    component: () => import('~/routeFeatures/climbs/ClimbsRow.svelte')
};

registerRouteFeature({
    id: 'climbs',
    order: 12,
    setting: { title: () => lc('lens_climbs'), store: routeFeatureClimbs },
    settings: climbsSettingRows,
    // the steep list folding changes the page's rows
    changes: derived([climbsSettingsKey, climbsSteepOpen], (values) => values),
    lensPalette: gradePalette,
    lenses: [climbsLens],
    pageSections: [climbsPageSection],
    navPages: [
        {
            id: 'climb',
            label: () => lc('navigation_page_climb'),
            component: () => import('~/routeFeatures/climbs/ClimbPage.svelte'),
            available: ({ detour, item }) => !detour && !!readClimbs(item)
        }
    ],
    attention: ({ item }) => readClimbs(item)?.marks ?? [],
    // while following the route, whatever the lens: the steep ways, to be ready for them
    mapFeatures: ({ item, navigating }) => {
        const read = navigating ? readClimbs(item) : null;
        if (!read?.alerts.length) {
            return [];
        }
        const coordinates = routeCoordinates(item.geometry);
        return [...alertFeatures(coordinates, read.alerts), ...symbolFeatures(coordinates, read.gradePlates)];
    }
});
