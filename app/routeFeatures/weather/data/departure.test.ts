import { describe, expect, it } from 'vitest';
import type { WeatherRead } from './read';
import { weatherAssessment } from './departure';

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

    it('says a ride the forecast does not reach is not covered, with no points and no marks', () => {
        expect(weatherAssessment(read({ rainTotal: 5, headShare: 1 }, false))).toEqual({ points: {}, indicators: [], covered: false });
    });

    it('marks rain from a tenth of a millimeter', () => {
        expect(weatherAssessment(read({ rainTotal: 0.1 }))?.indicators).toContain('rain');
        expect(weatherAssessment(read({ rainTotal: 0.09 }))?.indicators).not.toContain('rain');
    });

    it('marks wind when a quarter of the way is against it', () => {
        expect(weatherAssessment(read({ headShare: 0.25 }))?.indicators).toContain('wind');
        expect(weatherAssessment(read({ headShare: 0.24 }))?.indicators).not.toContain('wind');
    });

    it('marks sun for a dry ride under a clear sky: under 40 % of cloud', () => {
        expect(weatherAssessment(read({ cloud: 39 }))?.indicators).toContain('sun');
        expect(weatherAssessment(read({ cloud: 40 }))?.indicators).not.toContain('sun');
        expect(weatherAssessment(read({ cloud: 10, rainTotal: 1 }))?.indicators).not.toContain('sun');
        expect(weatherAssessment(read({}))?.indicators).not.toContain('sun');
    });

    it('keeps the order: rain, wind, sun', () => {
        expect(weatherAssessment(read({ rainTotal: 1, headShare: 0.5, cloud: 10 }))?.indicators).toEqual(['rain', 'wind']);
    });
});
