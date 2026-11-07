import { ApplicationSettings } from '@nativescript/core';
import { derived, get } from 'svelte/store';
import { currentLensPalette, lensVariant, lensVariantStore } from '~/routeFeatures/lens/lensStyle';
import { focusKeyOf, routeFocus } from '~/routeFeatures/lens/routeFocusStore';
import { routeLensStore } from '~/routeFeatures/lens/routeLensStore';
import { lensFeatures, routeCoordinates, symbolFeatures } from '~/routeFeatures/lens/sections';
import { registerRouteFeature, resolveLens, routeFeatures, routeLenses } from '~/routeFeatures/registry';

// the lens, the focused section and the style redraw the route, the cursor does not: a key that only they change
const lensChanges = derived([routeLensStore, routeFocus, lensVariantStore], ([lens, focus, variant], set: (key: string) => void) => {
    set(`${lens}|${variant}|${focus?.itemKey}|${focus?.section?.lens}|${focus?.section?.i0}|${focus?.section?.i1}`);
});

registerRouteFeature({
    id: 'lens',
    order: 5,
    changes: lensChanges,
    // the same for planning and for following the route: the layer it goes to is the caller's
    mapFeatures: ({ item }) => {
        const lenses = routeLenses(get(routeFeatures), { item });
        const lens = lenses.find(({ id }) => id === resolveLens(get(routeLensStore), lenses));
        if (!lens) {
            return [];
        }
        const slices = lens.slices?.({ item }) ?? [];
        const focus = get(routeFocus);
        const section = focus?.itemKey === focusKeyOf(item) && focus.section?.lens === lens.id ? focus.section : undefined;
        const coordinates = routeCoordinates(item.geometry);
        // the slices are one gradient line; e-ink keeps them as slices, each a shade of grey in an outline
        const variant = lensVariant(ApplicationSettings.getString('innerStyle'));
        const gradientPalette = variant !== 'eink' ? currentLensPalette(variant) : undefined;
        return [...lensFeatures(coordinates, lens.id, slices, section, gradientPalette), ...symbolFeatures(coordinates, lens.symbols?.({ item }) ?? [])];
    }
});
