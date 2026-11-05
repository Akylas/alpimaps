import { get } from 'svelte/store';
import { weatherService } from '~/services/WeatherService';
import { type AnalysisStage, StageError } from '~/utils/routeAnalysis/pipeline';
import { WeatherProviderError } from '~/utils/routeAnalysis/weatherProvider';
import { computeWeatherLayer, weatherExtras } from './layer';
import { weatherDecimals, weatherProviderId } from './settings';

/** Asks the forecast for the route. Only runs when the user asks: a first fetch, an update, a retry. */
export const weatherStage: AnalysisStage = {
    layer: 'weather',
    extra: () => weatherExtras(get(weatherProviderId), weatherDecimals()),
    async run({ analysis, inputs, item }) {
        try {
            return await computeWeatherLayer({
                item,
                inputs,
                now: Date.now(),
                decimals: weatherDecimals(),
                // there is a layer already: the user wants the provider's word, not the http cache's
                fetch: (query) => weatherService.fetch(query, { providerId: get(weatherProviderId), fresh: !!analysis.layers.weather })
            });
        } catch (error) {
            throw error instanceof WeatherProviderError ? new StageError(error.reason, error.message) : error;
        }
    }
};
