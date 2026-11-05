import { describe, expect, it } from 'vitest';
import { DEFAULT_PACE } from '~/utils/routeAnalysis/storage';
import type { Departure, RouteAnalysis, WeatherData } from '~/utils/routeAnalysis/types';
import { type WeatherVar, quantise } from '~/utils/routeAnalysis/weatherSeries';
import { type WeatherThresholds, readWeather, wxGlyph } from './read';

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
    const hours = (variable: WeatherVar, sample: Series, fallback: number | null) => quantise(variable, sample[variable] ?? Array<number>(HOURS).fill(fallback));
    const column = (variable: WeatherVar, fallback: number | null) => bySample.map((sample) => hours(variable, sample, fallback));
    return {
        samples,
        t0: T0,
        n: HOURS,
        v: {
            temp: column('temp', 10),
            precip: column('precip', 0),
            precipProb: column('precipProb', null),
            wind: column('wind', 0),
            gust: column('gust', 0),
            dir: column('dir', 0),
            cloud: column('cloud', null),
            code: column('code', 0),
            fl: column('fl', 2500),
            dni: column('dni', 0)
        },
        request: { decimals: 2, vars: [], models: 'best_match' }
    };
}

/** `rain` mm/h stamped at hours `at`, 0 elsewhere. */
const rainAt = (rain: number, ...at: number[]) => Array.from({ length: HOURS }, (_, hour) => (at.includes(hour) ? rain : 0));

function item(data: WeatherData, departure: Departure = { mode: 'planned', at: DEPART }, totalTime = 2 * HOUR) {
    const analysis: RouteAnalysis = {
        v: 1,
        inputs: { departure, pace: { ...DEFAULT_PACE }, geometryKey: 'k' },
        layers: { weather: { prov: { computedAt: NOW, inputsHash: 'h', provider: 'open-meteo/forecast', quality: 'ok' }, data } }
    };
    return { geometry, route: { totalTime }, analysis };
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
    it('puts a plate at each sample: the sky, the temperature, and the rain when there is', () => {
        const read = readWeather(item(layer([{ code: Array(HOURS).fill(3) }, { precip: rainAt(1.26, 7, 8), code: Array(HOURS).fill(61) }, {}])), NOW);
        const plates = read?.symbols.filter((symbol) => symbol.sym === 'wx');
        expect(plates?.map((plate) => plate.i)).toEqual([0, 50, 100]);
        expect(plates?.[0]).toMatchObject({ t: '10°', icon: wxGlyph(3), s: 0 });
        expect(plates?.[0].t2).toBeUndefined();
        expect(plates?.[1]).toMatchObject({ t: '10°', t2: '1.3 mm', icon: wxGlyph(61), s: 2 });
    });

    it('ranks the rainy plates first for the room on the map', () => {
        const plates = readWeather(item(rainMiddle), NOW)?.symbols.filter((symbol) => symbol.sym === 'wx');
        expect(plates?.[1].p).toBeGreaterThan(plates[0].p);
    });

    it('says the plates are out of date', () => {
        expect(readWeather(item(dry), NOW, { stale: true })?.symbols.every((symbol) => symbol.stale === 1)).toBe(true);
        expect(readWeather(item(dry), NOW)?.symbols.every((symbol) => !symbol.stale)).toBe(true);
    });

    it('has no plate of its own for the wind', () => {
        const wind = layer([{}, { wind: Array(HOURS).fill(40), dir: Array(HOURS).fill(0) }, {}]);
        expect(readWeather(item(wind), NOW)?.symbols.every((symbol) => symbol.sym === 'wx')).toBe(true);
    });

    // the route goes north: a north wind is a headwind, a south one a tailwind
    const windLine = (speed: number, dir: number, gust?: number, thresholds?: Partial<WeatherThresholds>) =>
        readWeather(item(layer([{}, { wind: Array(HOURS).fill(speed), dir: Array(HOURS).fill(dir), ...(gust ? { gust: Array(HOURS).fill(gust) } : {}) }, {}])), NOW, { thresholds })?.symbols.find(
            (symbol) => symbol.i === 50
        )?.t3;

    it('puts a strong wind on a second line of the plate: 30 km/h, or 20 of it against the ride', () => {
        expect(windLine(12, 0)).toBeUndefined();
        expect(windLine(25, 90)).toBeUndefined();
        expect(windLine(30, 90)).toContain('30');
        expect(windLine(22, 0)).toContain('22');
    });

    it('takes the thresholds from the settings: a wind from 20 km/h earns its line, and 13 of headwind', () => {
        expect(windLine(25, 90, undefined, { plateWind: 20 })).toContain('25');
        expect(windLine(15, 90, undefined, { plateWind: 20 })).toBeUndefined();
        expect(windLine(14, 0, undefined, { plateWind: 20 })).toContain('14');
        expect(windLine(12, 0, undefined, { plateWind: 20 })).toBeUndefined();
        expect(windLine(35, 90, undefined, { plateWind: 40 })).toBeUndefined();
    });

    it('takes the burst from the settings', () => {
        expect(windLine(5, 90, 45, { gust: 40 })).toContain(String.fromCodePoint(0xf059e) + '45');
        expect(windLine(5, 90, 45)).toBeUndefined();
    });

    it('starts the second line with a newline and the windy glyph', () => {
        expect(windLine(35, 0)?.startsWith('\n' + String.fromCodePoint(0xf059d) + ' 35')).toBe(true);
    });

    it('says which way it is against: an arrow left for a headwind, right for a tailwind, with how much, from 10 km/h', () => {
        const left = String.fromCodePoint(0xf004d);
        const right = String.fromCodePoint(0xf0054);
        expect(windLine(35, 0)).toContain(left + '35');
        expect(windLine(35, 180)).toContain(right + '35');
        expect(windLine(35, 90)).not.toContain(left);
        expect(windLine(35, 90)).not.toContain(right);
    });

    it('marks a burst of 50 km/h or more, even in a light wind', () => {
        const burst = String.fromCodePoint(0xf059e);
        expect(windLine(12, 90, 55)).toContain(burst + '55');
        expect(windLine(35, 90, 40)).not.toContain(burst);
    });
});

describe('cloud', () => {
    it('is on each row, and in the sky of the plates and of the profile', () => {
        const read = readWeather(item(layer([{ cloud: Array(HOURS).fill(5) }, { cloud: Array(HOURS).fill(50) }, { cloud: Array(HOURS).fill(95) }])), NOW);
        expect(read?.rows.map(({ cloud }) => cloud)).toEqual([5, 50, 95]);
        expect(read?.profile.temp.map(({ glyph }) => glyph.codePointAt(0))).toEqual([0xf0599, 0xf0595, 0xf0590]);
        expect(read?.symbols.map(({ icon }) => icon?.codePointAt(0))).toEqual([0xf0599, 0xf0595, 0xf0590]);
    });

    it('is averaged over the way ridden in the summary', () => {
        // stretches of a quarter, a half and a quarter of the route
        const read = readWeather(item(layer([{ cloud: Array(HOURS).fill(20) }, { cloud: Array(HOURS).fill(60) }, { cloud: Array(HOURS).fill(100) }])), NOW);
        expect(read?.summary.cloud).toBeCloseTo(60, 0);
    });
});

describe('rows', () => {
    it('has a row for each sample: where, when, and what it says at the time the ride is there', () => {
        const read = readWeather(item(layer([{ temp: Array(HOURS).fill(4) }, { precip: rainAt(3, 7, 8), code: Array(HOURS).fill(61) }, {}])), NOW);
        expect(read?.rows.map(({ i }) => i)).toEqual([0, 50, 100]);
        expect(read?.rows[1]).toMatchObject({ index: 1, at: DEPART + HOUR * 1000, precip: 3, code: 61, rain: 2 });
        expect(read?.rows[0].temp).toBe(4);
        expect(read?.rows[1].distance).toBeCloseTo(5000, 0);
    });

    it('says the stretch of the route each speaks for, to be focused', () => {
        const read = readWeather(item(rainMiddle), NOW);
        expect(read?.rows.map(({ i0, i1 }) => [i0, i1])).toEqual([
            [0, 25],
            [25, 75],
            [75, 100]
        ]);
    });

    it('says the wind against the ride at each', () => {
        const read = readWeather(item(layer([{}, { wind: Array(HOURS).fill(20), dir: Array(HOURS).fill(0), gust: Array(HOURS).fill(35) }, {}])), NOW);
        expect(read?.rows[1].wind).toBe(20);
        expect(read?.rows[1].gust).toBe(35);
        expect(read?.rows[1].head).toBeCloseTo(20, 1);
        expect(read?.rows[1].cross).toBeCloseTo(0, 1);
    });

    it('says the wind across the ride too: above 0 from the right', () => {
        // the route goes north: a west wind comes from the left
        const read = readWeather(item(layer([{}, { wind: Array(HOURS).fill(20), dir: Array(HOURS).fill(270) }, {}])), NOW);
        expect(read?.rows[1].cross).toBeCloseTo(-20, 1);
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

    it('is the share of the way ridden with a wind of over 10 km/h behind', () => {
        const tailwind = layer([{}, { wind: Array(HOURS).fill(20), dir: Array(HOURS).fill(180) }, {}]);
        expect(readWeather(item(tailwind), NOW)?.summary.tailShare).toBeCloseTo(0.5, 2);
        const headwind = layer([{}, { wind: Array(HOURS).fill(20), dir: Array(HOURS).fill(0) }, {}]);
        expect(readWeather(item(headwind), NOW)?.summary.tailShare).toBe(0);
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

describe('profile', () => {
    it('has a bar for a wet stretch, as high as the rain, over the meters of the stretch', () => {
        const { rain } = readWeather(item(rainMiddle), NOW)?.profile ?? { rain: [] };
        expect(rain).toHaveLength(1);
        expect(rain[0].mmPerHour).toBe(3);
        expect(rain[0].from).toBeCloseTo(2500, 0);
        expect(rain[0].to).toBeCloseTo(7500, 0);
    });

    it('has no bar on a dry ride', () => {
        expect(readWeather(item(dry), NOW)?.profile.rain).toEqual([]);
    });

    it('has a bar for each hour of a stretch that takes several, the rain read at each', () => {
        // routed in 8 h: the middle stretch takes 4 h, from 8 h to 12 h. Each hour's rain is stamped at its end: 9 to 12 h say 1, 2, 3, 4 mm/h
        const slow = layer([{}, { precip: Array.from({ length: HOURS }, (_, hour) => (hour >= 9 && hour <= 12 ? hour - 8 : 0)) }, {}]);
        const { rain } = readWeather(item(slow, undefined, 8 * HOUR), NOW)?.profile ?? { rain: [] };
        expect(rain.map(({ mmPerHour }) => mmPerHour)).toEqual([1, 2, 3, 4]);
        rain.slice(1).forEach((bar, index) => expect(bar.from).toBeCloseTo(rain[index].to, 0));
        expect(rain[0].from).toBeCloseTo(2500, 0);
        expect(rain[3].to).toBeCloseTo(7500, 0);
    });

    it('says how likely the rain is, and takes it for sure when the forecast does not say', () => {
        const unsure = layer([{}, { precip: rainAt(3, 7, 8), precipProb: Array(HOURS).fill(40) }, {}]);
        expect(readWeather(item(unsure), NOW)?.profile.rain[0].probability).toBeCloseTo(0.4, 5);
        expect(readWeather(item(rainMiddle), NOW)?.profile.rain[0].probability).toBe(1);
    });

    it('has a temperature point at each sample, with the sky there', () => {
        const read = readWeather(item(layer([{ temp: Array(HOURS).fill(4), code: Array(HOURS).fill(61) }, {}, { temp: Array(HOURS).fill(17) }])), NOW);
        expect(read?.profile.temp.map(({ value }) => value)).toEqual([4, 10, 17]);
        expect(read?.profile.temp[0].glyph).toBe(wxGlyph(61));
        expect(read?.profile.temp.map(({ d }) => d)).toEqual([0, 5000, 10000]);
    });

    it('has the wind where it is worth a mark: 15 km/h or more, or a burst of 50', () => {
        const wind = layer([
            { wind: Array(HOURS).fill(14) },
            { wind: Array(HOURS).fill(20), dir: Array(HOURS).fill(180) },
            { wind: Array(HOURS).fill(15), dir: Array(HOURS).fill(0), gust: Array(HOURS).fill(55) }
        ]);
        const points = readWeather(item(wind), NOW)?.profile.wind ?? [];
        expect(points.map(({ d, gust, speed }) => [d, speed, gust])).toEqual([
            [5000, 20, 0],
            [10000, 15, 55]
        ]);
        expect(points[0].head).toBeCloseTo(-20, 1);
        expect(points[1].head).toBeCloseTo(15, 1);
        const burstOnly = layer([{ wind: Array(HOURS).fill(8), gust: Array(HOURS).fill(52) }, {}, {}]);
        expect(readWeather(item(burstOnly), NOW)?.profile.wind).toHaveLength(1);
    });

    it('takes where the wind is worth a mark, and the burst, from the settings', () => {
        const wind = layer([{ wind: Array(HOURS).fill(10) }, { wind: Array(HOURS).fill(25) }, { wind: Array(HOURS).fill(5), gust: Array(HOURS).fill(42) }]);
        const read = readWeather(item(wind), NOW, { thresholds: { profileWind: 10, gust: 40 } });
        expect(read?.profile.wind.map(({ d }) => d)).toEqual([0, 5000, 10000]);
        expect(read?.profile.gustMin).toBe(40);
        expect(readWeather(item(wind), NOW)?.profile.gustMin).toBe(50);
        expect(readWeather(item(wind), NOW, { thresholds: { profileWind: 30 } })?.profile.wind).toEqual([]);
    });

    it("turns the wind to the way the ride goes: 0 degrees is behind, 180 against, 90 pushing to the rider's right, clockwise on the screen", () => {
        // the route goes north
        const angle = (dir: number) => readWeather(item(layer([{}, { wind: Array(HOURS).fill(20), dir: Array(HOURS).fill(dir) }, {}])), NOW)?.profile.wind[0].angle ?? NaN;
        expect(angle(180)).toBeCloseTo(0, 0);
        expect(Math.abs(angle(0))).toBeCloseTo(180, 0);
        // from the west: pushes the rider to the east, their right; the screen's down
        expect(angle(270)).toBeCloseTo(90, 0);
        // from the east: pushes to the rider's left, the screen's up
        expect(angle(90)).toBeCloseTo(-90, 0);
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

    it('reads the cloud cover for the clear and cloudy codes, which only say it roughly', () => {
        const glyph = (code: number, cloud: number) => wxGlyph(code, cloud).codePointAt(0);
        expect(glyph(3, 10)).toBe(0xf0599);
        expect(glyph(3, 40)).toBe(0xf0595);
        expect(glyph(0, 90)).toBe(0xf0590);
        expect(glyph(1, 19)).toBe(0xf0599);
        expect(glyph(2, 20)).toBe(0xf0595);
        expect(glyph(2, 60)).toBe(0xf0595);
        expect(glyph(2, 61)).toBe(0xf0590);
    });

    it('keeps the sky of the other codes, whatever the cloud', () => {
        expect(wxGlyph(61, 5).codePointAt(0)).toBe(0xf0597);
        expect(wxGlyph(95, 5).codePointAt(0)).toBe(0xf067e);
        expect(wxGlyph(45, 5).codePointAt(0)).toBe(0xf0591);
    });

    it('goes by the cloud alone when there is no code', () => {
        expect(wxGlyph(undefined, 5).codePointAt(0)).toBe(0xf0599);
        expect(wxGlyph(undefined, 95).codePointAt(0)).toBe(0xf0590);
    });

    it('is cloudy when the code is not known', () => {
        expect(wxGlyph(undefined).codePointAt(0)).toBe(0xf0590);
        expect(wxGlyph(1234).codePointAt(0)).toBe(0xf0590);
    });
});
