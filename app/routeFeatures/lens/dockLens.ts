import { derived, get } from 'svelte/store';
import { routeLensStore, selectLens } from '~/routeFeatures/lens/routeLensStore';
import { liveRouteFeatures, nextLens, resolveLens, routeLenses } from '~/routeFeatures/registry';
import { navigationItem } from '~/stores/navigationStore';
import type { RouteProgress } from '~/utils/navigation';

/** The lens the navigated route is read in, and what it asks of a profile: the dock's chart pages draw with it. */
export const dockLens = derived([liveRouteFeatures, navigationItem, routeLensStore], ([features, item, requested]) => {
    const lenses = routeLenses(features, { item });
    const activeLens = lenses.find((lens) => lens.id === resolveLens(requested, lenses));
    const options = activeLens?.profile?.({ item });
    return { lenses, activeLens, fill: options?.fill ?? null, fade: options?.fade ?? false, overlay: options?.overlay ?? null };
});

/** A tap on a dock chart goes to the next lens: there is no bar to pick from. */
export function nextDockLens() {
    const { activeLens, lenses } = get(dockLens);
    const next = nextLens(lenses, activeLens?.id);
    if (next) {
        selectLens(next);
    }
}

interface FollowedChart {
    hilghlightPathIndex(
        params: { onPathIndex: number; remainingDistance: number; remainingDistanceToStep: number; remainingTime: number; dplus?: number; dmin?: number },
        highlight?: undefined,
        sendEvent?: boolean
    ): void;
}

/**
 * Makes a chart follow the user's position. The service already walked the polyline for the fix, so the chart just
 * follows its result: the marker only moves with the index, so a fix on the same vertex is not worth a redraw.
 */
export function progressFollower() {
    let highlightedIndex = -2;
    return (chart: FollowedChart | undefined, progress: RouteProgress | null, profile: { dplus?: number; dmin?: number } | undefined, available: boolean) => {
        if (!progress || !available || progress.onPathIndex === highlightedIndex) {
            return;
        }
        highlightedIndex = progress.onPathIndex;
        chart?.hilghlightPathIndex(
            {
                onPathIndex: progress.onPathIndex,
                remainingDistance: progress.remainingDistance,
                remainingDistanceToStep: progress.remainingDistanceToStep,
                remainingTime: progress.remainingTime,
                dplus: profile?.dplus,
                dmin: profile?.dmin
            },
            undefined,
            false
        );
    };
}
