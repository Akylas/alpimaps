import { describe, expect, it } from 'vitest';
import { DEFAULT_WEATHER_PROVIDER, type WeatherProvider, getWeatherProvider, registerWeatherProvider, roundCoordinate, weatherProviders } from '~/routeFeatures/weather/providers/provider';

function provider(id: string): WeatherProvider {
    return { id, name: id, source: id, attribution: { text: id, url: '', license: '' }, maxPoints: 10, fetch: async () => ({ t0: 0, n: 0, series: [], vars: [], models: '' }) };
}

describe('weather providers', () => {
    it('finds the provider registered under an id', () => {
        const other = provider('meteo-france');
        registerWeatherProvider(other);
        expect(getWeatherProvider('meteo-france')).toBe(other);
        expect(weatherProviders()).toContain(other);
    });

    it('falls back to the default provider for an id nobody registered', () => {
        const fallback = provider(DEFAULT_WEATHER_PROVIDER);
        registerWeatherProvider(fallback);
        expect(getWeatherProvider('gone')).toBe(fallback);
        expect(getWeatherProvider(undefined)).toBe(fallback);
    });
});

describe('roundCoordinate', () => {
    it('rounds to the decimals asked', () => {
        expect(roundCoordinate(45.18756, 2)).toBe(45.19);
        expect(roundCoordinate(-5.7249, 2)).toBe(-5.72);
        expect(roundCoordinate(45.18756, 1)).toBe(45.2);
    });
});
