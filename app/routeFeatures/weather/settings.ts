import { derived, get } from 'svelte/store';
import { settingsStore } from '~/stores/settingsStore';
import { DEFAULT_WEATHER_PROVIDER } from '~/utils/routeAnalysis/weatherProvider';

export const routeFeatureWeather = settingsStore('route_feature_weather', true);

/** The provider the forecast is asked of. */
export const weatherProviderId = settingsStore<string>('weather_provider', DEFAULT_WEATHER_PROVIDER);

/** How many decimals the points sent to the provider are rounded to, `'2'` (about 1 km) or `'1'` (about 11 km). A segment holds strings. */
export const weatherPrecision = settingsStore<string>('weather_precision', '2');

export function weatherDecimals(): 1 | 2 {
    return get(weatherPrecision) === '1' ? 1 : 2;
}

/** Changes with any of what the forecast is asked with: the layer already fetched is then out of date. */
export const weatherSettingsKey = derived([weatherProviderId, weatherPrecision], (values) => values.join());
