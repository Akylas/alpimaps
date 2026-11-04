import { showError } from '@shared/utils/showError';
import { derived } from 'svelte/store';
import { convertElevation, formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { categoryLabel, readClimbs } from '~/routeFeatures/climbs/data';
import {
    climbsCategories,
    climbsMinLength,
    climbsPreset,
    climbsSettingRows,
    climbsSteepDown,
    climbsSteepUp,
    climbsVerySteepDown,
    climbsVerySteepUp,
    routeFeatureClimbs
} from '~/routeFeatures/climbs/settings';
import { getMapContext } from '~/mapModules/MapModule';
import type { IItem } from '~/models/Item';
import { type LensFact, type RouteLens, registerRouteFeature } from '~/routeFeatures/registry';

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
        // a very steep way up turns the icon red; the profile marks where
        return read ? { value: String(read.climbs.length), alert: read.marks.length > 0 } : {};
    },
    headline: ({ item }) => {
        const read = readClimbs(item);
        if (!read?.climbs.length) {
            return { facts: [{ text: lc('climbs_none') }] };
        }
        const { best } = read;
        const facts: LensFact[] = [{ icon: 'mdi-slope-uphill', text: lc('climbs_count', read.climbs.length) }];
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
    slices: ({ item }) => readClimbs(item)?.slices ?? []
};

// what the climbs are read with: they are read again, and the card and the map with them
const settingsChanged = derived([climbsPreset, climbsSteepUp, climbsVerySteepUp, climbsSteepDown, climbsVerySteepDown, climbsMinLength, climbsCategories], (values) => values.join());

registerRouteFeature({
    id: 'climbs',
    order: 12,
    setting: { title: () => lc('lens_climbs'), store: routeFeatureClimbs },
    settings: climbsSettingRows,
    changes: settingsChanged,
    lenses: [climbsLens],
    attention: ({ item }) => readClimbs(item)?.marks ?? []
});
