import { describe, expect, it } from 'vitest';
import { DEFAULT_PACE } from '~/utils/routeAnalysis/storage';
import type { Departure, RouteAnalysis, WeatherData } from '~/utils/routeAnalysis/types';
import { type WeatherVar, quantise } from '~/utils/routeAnalysis/weatherSeries';
import { readWeather, wxGlyph } from './read';

const HOUR = 3600;
const T0 = Date.UTC(2026, 5, 1) / 1000;
const NOW = (T0 + 4 * HOUR) * 1000;
const DEPART = (T0 + 6 * HOUR) * 1000;
const HOURS = 24;

// 10 km north in 101 vertices, routed in 2 h; the three samples are ridden at 6 h, 7 h and 8 h
const coordinates = Array.from({ length: 101 }, (_, index) => [6, 45 + (index * 100) / 111320]);
const geometry = { type: 'LineString' as const, coordinates };
const samples = [0, 50, 100].map((index) => ({ i: index, d: index * 100, alt: 1000 }));

type Series = Partial<Record<WeatherVar, number[]>>;
/** Hourly values per sample, by variable. A variable left out is a constant: 10 °C, still air from the north, clear. */
function layer(bySample: Series[]): WeatherData {
    const hours = (variable: WeatherVar, sample: Series, fallback: number) => quantise(variable, sample[variable] ?? Array<number>(HOURS).fill(fallback));
    const column = (variable: WeatherVar, fallback: number) => bySample.map((sample) => hours(variable, sample, fallback));
    return {
        samples,
        t0: T0,
        n: HOURS,
        v: {
            temp: column('temp', 10),
            precip: column('precip', 0),
            precipProb: column('precipProb', 0),
            wind: column('wind', 0),
            gust: column('gust', 0),
            dir: column('dir', 0),
            cloud: column('cloud', 0),
            code: column('code', 0),
            fl: column('fl', 2500),
            dni: column('dni', 0)
        },
        request: { decimals: 2, vars: [], models: 'best_match' }
    };
}

/** `rain` mm/h stamped at hours `at`, 0 elsewhere. */
const rainAt = (rain: number, ...at: number[]) => Array.from({ length: HOURS }, (_, hour) => (at.includes(hour) ? rain : 0));

function item(data: WeatherData, departure: Departure = { mode: 'planned', at: DEPART }) {
    const analysis: RouteAnalysis = {
        v: 1,
        inputs: { departure, pace: { ...DEFAULT_PACE }, geometryKey: 'k' },
        layers: { weather: { prov: { computedAt: NOW, inputsHash: 'h', provider: 'open-meteo/forecast', quality: 'ok' }, data } }
    };
    return { geometry, route: { totalTime: 2 * HOUR }, analysis };
}

const dry = layer([{}, {}, {}]);
// rain in the middle, 3 mm/h during the hour before 7 h and the one before 8 h
const rainMiddle = layer([{}, { precip: rainAt(3, 7, 8) }, {}]);

describe('readWeather', () => {
    it('has nothing to read without a weather layer', () => {
        expect(readWeather({ geometry, route: { totalTime: HOUR } }, NOW)).toBeNull();
        expect(readWeather({ geometry, analysis: { v: 1, inputs: item(dry).analysis.inputs, layers: {} } }, NOW)).toBeNull();
    });

    it('reads each sample at the time the ride is there', () => {
        const read = readWeather(item(layer([{}, { temp: Array.from({ length: HOURS }, (_, hour) => hour) }, {}])), NOW);
        // the middle sample is reached 1 h after leaving at 6 h
        expect(read?.ride[1].reading?.temp).toBe(7);
        expect(read?.ride.map((entry) => entry.at)).toEqual([DEPART, DEPART + HOUR * 1000, DEPART + 2 * HOUR * 1000]);
    });

    it('reads another time when the departure moves, with no new data', () => {
        const temps = layer([{}, { temp: Array.from({ length: HOURS }, (_, hour) => hour) }, {}]);
        const later = readWeather(item(temps, { mode: 'planned', at: DEPART + 2 * HOUR * 1000 }), NOW);
        expect(later?.ride[1].reading?.temp).toBe(9);
    });
});

describe('slices', () => {
    it('is one dry slice for a dry ride', () => {
        expect(readWeather(item(dry), NOW)?.slices).toEqual([{ i0: 0, i1: 100, k: 'w0', s: 0 }]);
    });

    it('cuts the line half way between samples, each slice by the rain of its sample', () => {
        expect(readWeather(item(rainMiddle), NOW)?.slices).toEqual([
            { i0: 0, i1: 25, k: 'w0', s: 0 },
            { i0: 25, i1: 75, k: 'w2', s: 2 },
            { i0: 75, i1: 100, k: 'w0', s: 0 }
        ]);
    });

    it('joins neighbours of the same class', () => {
        const slices = readWeather(item(layer([{}, { precip: rainAt(3, 7, 8) }, { precip: rainAt(3, 7, 8, 9) }])), NOW)?.slices;
        expect(slices).toEqual([
            { i0: 0, i1: 25, k: 'w0', s: 0 },
            { i0: 25, i1: 100, k: 'w2', s: 2 }
        ]);
    });

    it('draws a sample the forecast does not cover as dry', () => {
        const outside = readWeather(item(dry, { mode: 'planned', at: DEPART + 40 * HOUR * 1000 }), NOW);
        expect(outside?.slices).toEqual([{ i0: 0, i1: 100, k: 'w0', s: 0 }]);
    });
});

describe('spans', () => {
    it('lists the stretches where it rains, with the worst of them', () => {
        const spans = readWeather(item(rainMiddle), NOW)?.spans;
        expect(spans).toHaveLength(1);
        expect(spans?.[0]).toMatchObject({ i0: 25, i1: 75, peak: 3 });
        expect(spans?.[0].from).toBeCloseTo(2500, 0);
        expect(spans?.[0].to).toBeCloseTo(7500, 0);
    });

    it('has none on a dry ride', () => {
        expect(readWeather(item(dry), NOW)?.spans).toEqual([]);
    });
});

describe('symbols', () => {
    it('puts a plate at each sample: the temperature, the rain when there is, the glyph of the sky', () => {
        const read = readWeather(item(layer([{ code: Array(HOURS).fill(3) }, { precip: rainAt(1.26, 7, 8), code: Array(HOURS).fill(61) }, {}])), NOW);
        const plates = read?.symbols.filter((symbol) => symbol.sym === 'wx');
        expect(plates?.map((plate) => plate.i)).toEqual([0, 50, 100]);
        expect(plates?.[0]).toMatchObject({ t: '10°', icon: wxGlyph(3), s: 0 });
        expect(plates?.[0].t2).toBeUndefined();
        expect(plates?.[1]).toMatchObject({ t: '10°', t2: '1.3', icon: wxGlyph(61), s: 2 });
    });

    it('ranks the rainy plates first for the room on the map', () => {
        const plates = readWeather(item(rainMiddle), NOW)?.symbols.filter((symbol) => symbol.sym === 'wx');
        expect(plates?.[1].p).toBeGreaterThan(plates[0].p);
    });

    it('says the plates are out of date', () => {
        expect(readWeather(item(dry), NOW, { stale: true })?.symbols.every((symbol) => symbol.stale === 1)).toBe(true);
        expect(readWeather(item(dry), NOW)?.symbols.every((symbol) => !symbol.stale)).toBe(true);
    });

    it('draws the wind from 10 km/h, an arrow where it blows to, with its speed', () => {
        // from the east at 24 km/h at the middle sample, calm elsewhere
        const wind = layer([{}, { wind: Array(HOURS).fill(24), dir: Array(HOURS).fill(90) }, { wind: Array(HOURS).fill(9) }]);
        const arrows = readWeather(item(wind), NOW)?.symbols.filter((symbol) => symbol.sym === 'wind');
        expect(arrows).toHaveLength(1);
        expect(arrows?.[0]).toMatchObject({ i: 50, t: '24', rot: 270 });
    });

    it('marks a gust of 50 km/h or more', () => {
        const gusty = layer([{}, { wind: Array(HOURS).fill(30), gust: Array(HOURS).fill(55) }, {}]);
        expect(readWeather(item(gusty), NOW)?.symbols.find((symbol) => symbol.sym === 'wind')?.s).toBe(2);
    });
});

describe('summary', () => {
    it('gives the range of temperatures', () => {
        const read = readWeather(item(layer([{ temp: Array(HOURS).fill(4) }, {}, { temp: Array(HOURS).fill(17) }])), NOW);
        expect(read?.summary).toMatchObject({ tempMin: 4, tempMax: 17 });
    });

    it('adds up the rain over the time the ride spends in each stretch', () => {
        // 3 mm/h over the middle half of a 2 h ride: 1 h
        expect(readWeather(item(rainMiddle), NOW)?.summary.rainTotal).toBeCloseTo(3, 1);
        expect(readWeather(item(dry), NOW)?.summary.rainTotal).toBe(0);
    });

    it('finds the heaviest rain and where', () => {
        const read = readWeather(item(layer([{ precip: rainAt(0.5, 6) }, { precip: rainAt(5, 7, 8) }, {}])), NOW);
        expect(read?.summary.rainPeak?.mmPerHour).toBe(5);
        expect(read?.summary.rainPeak?.distance).toBeCloseTo(5000, 0);
        expect(readWeather(item(dry), NOW)?.summary.rainPeak).toBeUndefined();
    });

    it('is the share of the way ridden against a wind of over 10 km/h', () => {
        // the route goes north; a north wind at the middle sample, whose stretch is half of it
        const headwind = layer([{}, { wind: Array(HOURS).fill(20), dir: Array(HOURS).fill(0) }, {}]);
        expect(readWeather(item(headwind), NOW)?.summary.headShare).toBeCloseTo(0.5, 2);
        const tailwind = layer([{}, { wind: Array(HOURS).fill(20), dir: Array(HOURS).fill(180) }, {}]);
        expect(readWeather(item(tailwind), NOW)?.summary.headShare).toBe(0);
    });

    it('knows a thunderstorm by its code', () => {
        expect(readWeather(item(layer([{}, { code: Array(HOURS).fill(95) }, {}])), NOW)?.summary.thunder).toBe(true);
        expect(readWeather(item(dry), NOW)?.summary.thunder).toBe(false);
    });
});

describe('at', () => {
    it('reads the weather of the nearest sample at the time the ride is at a vertex', () => {
        const read = readWeather(item(layer([{}, { temp: Array.from({ length: HOURS }, (_, hour) => hour), wind: Array(HOURS).fill(20) }, {}])), NOW);
        // vertex 60 is reached at 7 h 12 min; the sample at 50 is nearest
        expect(read?.at(60)?.temp).toBeCloseTo(7.2, 1);
        expect(read?.at(60)?.head).toBeCloseTo(20, 1);
    });
});

describe('wxGlyph', () => {
    it('draws the sky from the WMO code', () => {
        const glyph = (code: number) => wxGlyph(code).codePointAt(0);
        expect(glyph(0)).toBe(0xf0599);
        expect(glyph(2)).toBe(0xf0595);
        expect(glyph(3)).toBe(0xf0590);
        expect(glyph(45)).toBe(0xf0591);
        expect(glyph(53)).toBe(0xf0597);
        expect(glyph(63)).toBe(0xf0597);
        expect(glyph(65)).toBe(0xf0596);
        expect(glyph(82)).toBe(0xf0596);
        expect(glyph(66)).toBe(0xf067f);
        expect(glyph(73)).toBe(0xf0598);
        expect(glyph(86)).toBe(0xf0598);
        expect(glyph(96)).toBe(0xf067e);
    });

    it('is cloudy when the code is not known', () => {
        expect(wxGlyph(undefined).codePointAt(0)).toBe(0xf0590);
        expect(wxGlyph(1234).codePointAt(0)).toBe(0xf0590);
    });
});
