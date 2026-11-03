import { get } from 'svelte/store';
import { clearSection } from '~/routeFeatures/lens/routeFocusStore';
import type { LensId } from '~/routeFeatures/registry';
import { settingsStore } from '~/stores/settingsStore';

/** The lens last used, global: any route that can show it opens with it, see `resolveLens`. */
export const routeLensStore = settingsStore<LensId>('route_lens', 'overview');

/** The user's pick. A focused section belongs to the lens left, so it goes. */
export function selectLens(id: LensId) {
    if (get(routeLensStore) !== id) {
        routeLensStore.set(id);
        clearSection();
    }
}
