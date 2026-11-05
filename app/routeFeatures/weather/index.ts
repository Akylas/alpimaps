import { lc } from '~/helpers/locale';
import { registerRouteFeature } from '~/routeFeatures/registry';
import { routeFeatureWeather } from './settings';
import { weatherStage } from './stage';

registerRouteFeature({
    id: 'weather',
    order: 14,
    setting: { title: () => lc('lens_weather'), store: routeFeatureWeather },
    compute: weatherStage
});
