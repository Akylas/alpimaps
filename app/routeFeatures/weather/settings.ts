import { derived, get } from 'svelte/store';
import { settingsStore } from '~/stores/settingsStore';
import { DEFAULT_WEATHER_PROVIDER } from '~/utils/routeAnalysis/weatherProvider';
import { DEFAULT_THRESHOLDS, type WeatherThresholds } from './read';

export const routeFeatureWeather = settingsStore('route_feature_weather', true);

/** The provider the forecast is asked of. */
/** The samples of the route page's weather card are listed under a header, closed until asked for: the summary comes first. */
export const weatherDetailsOpen = settingsStore('weather_details_open', false);

export const weatherProviderId = settingsStore<string>('weather_provider', DEFAULT_WEATHER_PROVIDER);

/** How many decimals the points sent to the provider are rounded to, `'2'` (about 1 km) or `'1'` (about 11 km). A segment holds strings. */
export const weatherPrecision = settingsStore<string>('weather_precision', '2');

export function weatherDecimals(): 1 | 2 {
    return get(weatherPrecision) === '1' ? 1 : 2;
}

/** Changes with any of what the forecast is asked with: the layer already fetched is then out of date. */
export const weatherSettingsKey = derived([weatherProviderId, weatherPrecision], (values) => values.join());

/** km/h: what of the wind is worth showing, on the profile and on the plates. */
export const weatherProfileWind = settingsStore('weather_profile_wind', DEFAULT_THRESHOLDS.profileWind);
export const weatherPlateWind = settingsStore('weather_plate_wind', DEFAULT_THRESHOLDS.plateWind);
export const weatherGust = settingsStore('weather_gust', DEFAULT_THRESHOLDS.gust);

export function weatherThresholds(): WeatherThresholds {
    return { profileWind: get(weatherProfileWind), plateWind: get(weatherPlateWind), gust: get(weatherGust) };
}

/** Changes with any of what is shown of the wind: the route is read again. The forecast fetched stays. */
export const weatherWindKey = derived([weatherProfileWind, weatherPlateWind, weatherGust], (values) => values.join());
