import { describe, expect, it } from 'vitest';
import type { WeatherRead } from './read';
import { RAIN_BLUE, SUN_COLOR } from '~/routeFeatures/weather/ui/colors';
import { weatherAssessment, weatherNeedsFetch } from './departure';

const entry = (known: boolean) => ({ sample: { i: 0, d: 0, alt: 0 }, at: 0, reading: known ? {} : undefined });
const read = (summary: Partial<WeatherRead['summary']>, known = true): Pick<WeatherRead, 'ride' | 'summary'> => ({
    ride: [entry(true), entry(known)],
    summary: { rainTotal: 0, headShare: 0, tailShare: 0, thunder: false, ...summary }
});

describe('weatherAssessment', () => {
    it('knows nothing without a forecast', () => {
        expect(weatherAssessment(null)).toBeUndefined();
    });

    it('adds 3 points for each mm of rain and 2 for the whole way against the wind', () => {
        expect(weatherAssessment(read({ rainTotal: 2, headShare: 0.5 }))?.points).toEqual({ rain: 6, wind: 1 });
    });

    it('says the rain of the ride, for the cell of its departure', () => {
        expect(weatherAssessment(read({ rainTotal: 2.5 }))?.rainMm).toBe(2.5);
        expect(weatherAssessment(read({ rainTotal: 5 }, false))?.rainMm).toBeUndefined();
    });

    it('says a ride the forecast does not reach is not covered, with no points and no marks', () => {
        expect(weatherAssessment(read({ rainTotal: 5, headShare: 1 }, false))).toEqual({ points: {}, indicators: [], covered: false });
    });

    it('marks wind when a quarter of the way is against it', () => {
        expect(weatherAssessment(read({ headShare: 0.25 }))?.indicators).toContain('wind');
        expect(weatherAssessment(read({ headShare: 0.24 }))?.indicators).not.toContain('wind');
    });

    it('says the sky of the ride, which is what marks it: the sun, the rain or the cloud, each in its colour', () => {
        expect(weatherAssessment(read({ cloud: 10 }))?.sky).toMatchObject({ icon: 'mdi-weather-sunny', color: SUN_COLOR });
        expect(weatherAssessment(read({ cloud: 10, rainTotal: 1, rainPeak: { mmPerHour: 1, distance: 0 } }))?.sky).toMatchObject({ icon: 'mdi-weather-rainy', color: RAIN_BLUE });
        expect(weatherAssessment(read({ cloud: 90 }))?.sky?.icon).toBe('mdi-weather-cloudy');
        expect(weatherAssessment(read({ cloud: 90 }))?.sky?.color).toBeDefined();
    });

    it('has no mark for rain nor sun: the sky says them', () => {
        expect(weatherAssessment(read({ rainTotal: 1, cloud: 10 }))?.indicators).toEqual([]);
        expect(weatherAssessment(read({ headShare: 0.5, rainTotal: 1 }))?.indicators).toEqual(['wind']);
    });

    it('needs a fetch when a forecast was fetched and does not reach the ride, not before one was asked for', () => {
        expect(weatherNeedsFetch(null)).toBe(false);
        expect(weatherNeedsFetch(read({}))).toBe(false);
        expect(weatherNeedsFetch(read({}, false))).toBe(true);
    });
});
