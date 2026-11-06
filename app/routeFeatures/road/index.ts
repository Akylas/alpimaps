import { lc } from '~/helpers/locale';
import { registerRouteFeature } from '~/routeFeatures/registry';
import { riskStage } from '~/routeFeatures/road/stage';
import { roadSettingRows, roadSettingsKey, routeFeatureRoad } from '~/routeFeatures/road/settings';

registerRouteFeature({
    id: 'road',
    order: 13,
    setting: { title: () => lc('road_safety'), store: routeFeatureRoad },
    settings: roadSettingRows,
    // a threshold or a minimum length reads the same layer again
    changes: roadSettingsKey,
    compute: riskStage
});
