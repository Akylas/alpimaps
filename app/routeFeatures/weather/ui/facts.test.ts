import { describe, expect, it } from 'vitest';
import { METRIC_FORMAT } from '~/routeFeatures/weather/data/format';
import type { WeatherSummary } from '~/routeFeatures/weather/data/read';
import { SUN_COLOR } from '~/routeFeatures/weather/ui/colors';
import { rainPeakSentence, summaryFacts } from '~/routeFeatures/weather/ui/facts';

const words = { format: METRIC_FORMAT, t: (key: string, ...args: string[]) => [key, ...args].join(' '), distance: (meters: number) => `${meters / 1000} km` };
const summary: WeatherSummary = { rainTotal: 0, headShare: 0, tailShare: 0, thunder: false };

describe('summaryFacts', () => {
    it('says the temperatures as oss-weather does: the high in bold, the low lighter after it', () => {
        const [temperature] = summaryFacts({ ...summary, tempMin: 6, tempMax: 12 }, words);
        expect(temperature).toMatchObject({ icon: 'mdi-thermometer', value: '12°', unit: '/ 6°', text: '12° / 6°' });
    });

    it('says one figure when the high and the low are the same', () => {
        const [temperature] = summaryFacts({ ...summary, tempMin: 8, tempMax: 8 }, words);
        expect(temperature).toMatchObject({ value: '8°', text: '8°' });
        expect(temperature.unit).toBeUndefined();
    });

    it('has no rain chip for a dry ride, nor for a trace of rain under a tenth of a millimeter', () => {
        expect(summaryFacts({ ...summary, cloud: 60 }, words).map(({ icon }) => icon)).toEqual(['mdi-cloud-outline']);
        const trace = summaryFacts({ ...summary, rainTotal: 0.04, rainPeak: { mmPerHour: 0.1, distance: 6000, probability: 0 } }, words);
        expect(trace).toEqual([]);
    });

    it('says the rain over the ride in one chip, its bar the chance of it, and nothing of the peak', () => {
        const facts = summaryFacts({ ...summary, rainTotal: 2.5, rainPeak: { mmPerHour: 2.1, distance: 6000, probability: 70 } }, words);
        expect(facts).toHaveLength(1);
        expect(facts[0]).toMatchObject({ icon: 'mdi-water', value: '2.5', unit: 'mm', bar: 0.7 });
        expect(facts[0].note).toBeUndefined();
        expect(facts[0].label).toBeUndefined();
    });

    it('has no bar when the forecast does not say how likely the rain is', () => {
        const [rain] = summaryFacts({ ...summary, rainTotal: 1, rainPeak: { mmPerHour: 1, distance: 6000 } }, words);
        expect(rain.bar).toBeUndefined();
    });

    it('washes the cloud chip by how cloudy it is', () => {
        const [low] = summaryFacts({ ...summary, cloud: 50 }, words).slice(-1);
        const [high] = summaryFacts({ ...summary, cloud: 100 }, words).slice(-1);
        expect(low.icon).toBe('mdi-cloud-outline');
        expect(parseInt(high.tint.slice(7), 16)).toBeGreaterThan(parseInt(low.tint.slice(7), 16));
    });

    it('highlights a clear sky as it does the cloud and the rain: a sun chip in its colour, the clear share, in place of the cloud one', () => {
        const [sun] = summaryFacts({ ...summary, cloud: 15 }, words);
        expect(sun).toMatchObject({ icon: 'mdi-weather-sunny', value: '85', unit: '%', color: SUN_COLOR });
        expect(sun.tint?.startsWith(SUN_COLOR)).toBe(true);
        expect(summaryFacts({ ...summary, cloud: 15 }, words).some(({ icon }) => icon === 'mdi-cloud-outline')).toBe(false);
        expect(summaryFacts({ ...summary, cloud: 40 }, words)[0].icon).toBe('mdi-cloud-outline');
    });

    it('says the wind against the ride only from a tenth of the way, and a warning from 30 %', () => {
        expect(summaryFacts(summary, words).some(({ icon }) => icon === 'mdi-weather-windy')).toBe(false);
        const some = summaryFacts({ ...summary, headShare: 0.2 }, words).find(({ icon }) => icon === 'mdi-weather-windy');
        expect(some).toMatchObject({ value: '20', unit: '%' });
        expect(some.color).toBeUndefined();
        expect(summaryFacts({ ...summary, headShare: 0.5 }, words).find(({ icon }) => icon === 'mdi-weather-windy').color).toBeDefined();
    });

    it('says a storm as a warning', () => {
        expect(summaryFacts({ ...summary, thunder: true }, words).find(({ icon }) => icon === 'mdi-weather-lightning')?.alert).toBe(true);
    });
});

describe('rainPeakSentence', () => {
    it('says the heaviest rain, where and how likely', () => {
        expect(rainPeakSentence({ ...summary, rainTotal: 1, rainPeak: { mmPerHour: 2.1, distance: 6000, probability: 70 } }, words)).toBe('weather_rain_around 2.1 mm 6 km · 70 %');
    });

    it('leaves the chance out when the forecast does not say, and says nothing for a dry ride', () => {
        expect(rainPeakSentence({ ...summary, rainTotal: 1, rainPeak: { mmPerHour: 2.1, distance: 6000 } }, words)).toBe('weather_rain_around 2.1 mm 6 km');
        expect(rainPeakSentence(summary, words)).toBeUndefined();
    });

    it('says nothing of a trace of rain', () => {
        expect(rainPeakSentence({ ...summary, rainTotal: 0.04, rainPeak: { mmPerHour: 0.1, distance: 6000, probability: 0 } }, words)).toBeUndefined();
    });
});
