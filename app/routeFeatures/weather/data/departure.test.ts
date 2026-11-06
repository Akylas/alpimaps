import { describe, expect, it } from 'vitest';
import type { WeatherRead } from './read';
import { METRIC_FORMAT } from '~/routeFeatures/weather/data/format';
import { RAIN_BLUE } from '~/routeFeatures/weather/ui/colors';
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

    it('says the rain of the ride as a figure for the cell of its departure: its number, how much of a bar it fills, the blue of the rain', () => {
        const figure = weatherAssessment(read({ rainTotal: 2.5 }))?.figure;
        expect(figure).toMatchObject({ text: '2.5', color: RAIN_BLUE });
        expect(figure?.share).toBeCloseTo(0.5, 5);
        expect(weatherAssessment(read({ rainTotal: 50 }))?.figure?.share).toBe(1);
        expect(weatherAssessment(read({ rainTotal: 5 }, false))?.figure).toBeUndefined();
    });

    it('says a ride with a trace of rain or none as a dash, with no bar', () => {
        expect(weatherAssessment(read({ rainTotal: 0.05 }))?.figure).toEqual({ text: '–' });
        expect(weatherAssessment(read({}))?.figure).toEqual({ text: '–' });
    });

    it('says the rain in the units it is given', () => {
        const inches = { ...METRIC_FORMAT, rainNumber: () => '0.1' };
        expect(weatherAssessment(read({ rainTotal: 2.5 }), inches)?.figure?.text).toBe('0.1');
    });

    it('says a ride the forecast does not reach is not covered, with no points and no marks', () => {
        expect(weatherAssessment(read({ rainTotal: 5, headShare: 1 }, false))).toEqual({ points: {}, indicators: [], covered: false });
    });

    it('marks wind when a quarter of the way is against it', () => {
        expect(weatherAssessment(read({ headShare: 0.25 }))?.indicators).toContain('wind');
        expect(weatherAssessment(read({ headShare: 0.24 }))?.indicators).not.toContain('wind');
    });

    it('marks the sky of the ride first, as the mark a cell always shows: the sun, the cloud, the rain', () => {
        expect(weatherAssessment(read({ cloud: 10 }))?.indicators).toEqual(['sunny']);
        expect(weatherAssessment(read({ cloud: 90 }))?.indicators).toEqual(['cloudy']);
        expect(weatherAssessment(read({ cloud: 10, rainTotal: 1, rainPeak: { mmPerHour: 1, distance: 0 } }))?.indicators).toEqual(['rainy']);
    });

    it('marks the wind after the sky', () => {
        expect(weatherAssessment(read({ headShare: 0.5, rainTotal: 1, rainPeak: { mmPerHour: 1, distance: 0 } }))?.indicators).toEqual(['rainy', 'wind']);
    });

    it('needs a fetch when a forecast was fetched and does not reach the ride, not before one was asked for', () => {
        expect(weatherNeedsFetch(null)).toBe(false);
        expect(weatherNeedsFetch(read({}))).toBe(false);
        expect(weatherNeedsFetch(read({}, false))).toBe(true);
    });
});
