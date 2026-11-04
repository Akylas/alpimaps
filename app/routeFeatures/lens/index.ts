import { derived, get } from 'svelte/store';
import { focusKeyOf, routeFocus } from '~/routeFeatures/lens/routeFocusStore';
import { routeLensStore } from '~/routeFeatures/lens/routeLensStore';
import { lensFeatures, routeCoordinates } from '~/routeFeatures/lens/sections';
import { registerRouteFeature, resolveLens, routeFeatures, routeLenses } from '~/routeFeatures/registry';

// the lens and the focused section redraw the route, the cursor does not: a key that only they change
const lensChanges = derived([routeLensStore, routeFocus], ([lens, focus], set: (key: string) => void) => {
    set(`${lens}|${focus?.itemKey}|${focus?.section?.lens}|${focus?.section?.i0}|${focus?.section?.i1}`);
});

registerRouteFeature({
    id: 'lens',
    order: 5,
    changes: lensChanges,
    // the navigation layer has no lens yet
    mapFeatures: ({ item, navigating }) => {
        if (navigating) {
            return [];
        }
        const lenses = routeLenses(get(routeFeatures), { item });
        const lens = lenses.find(({ id }) => id === resolveLens(get(routeLensStore), lenses));
        const slices = lens?.slices?.({ item });
        if (!slices?.length) {
            return [];
        }
        const focus = get(routeFocus);
        const section = focus?.itemKey === focusKeyOf(item) && focus.section?.lens === lens.id ? focus.section : undefined;
        return lensFeatures(routeCoordinates(item.geometry), lens.id, slices, section);
    }
});
