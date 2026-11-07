import { get } from 'svelte/store';
import type { IItem } from '~/models/Item';
import { computeLayers } from '~/routeFeatures/analysisRunner';
import { routeFeatureRoad } from '~/routeFeatures/road/settings';
import { activityOf } from '~/utils/routeAnalysis/activity';

/** A route just computed for a bike is matched on the road graph for its fast roads, without the user asking. */
export function computeRiskLayer(item: IItem) {
    if (get(routeFeatureRoad) && activityOf(item, item.analysis)?.kind === 'bike') {
        return computeLayers(item, ['risk']);
    }
}
