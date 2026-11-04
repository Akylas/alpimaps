import { showError } from '@shared/utils/showError';
import { navigate } from '@shared/utils/svelte/ui';
import type { Item } from '~/models/Item';

/** Loaded when asked for: the page is not part of the startup graph. */
export async function showRoutePage(item: Item) {
    try {
        const RoutePage = (await import('~/routeFeatures/page/RoutePage.svelte')).default;
        navigate({ page: RoutePage, props: { item } });
    } catch (error) {
        showError(error);
    }
}
