import { getTimes } from 'suncalc';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PACE } from '~/utils/routeAnalysis/storage';
import { buildTimeline } from '~/utils/routeAnalysis/timeline';
import type { AnalysisInputs } from '~/utils/routeAnalysis/types';
import { type WeatherFactors, darkMinutes, departureStrip } from './departureStrip';

type WeatherFactorsInput = WeatherFactors;

// Grenoble, a November day
const LAT = 45.19;
const LON = 5.72;
const DAY = Date.UTC(2026, 10, 4, 12);
const { sunrise, sunset } = getTimes(new Date(DAY), LAT, LON);
const MINUTE = 60000;
const HOUR = 60 * MINUTE;

describe('darkMinutes', () => {
    it('is nothing for a ride in the middle of the day', () => {
        expect(darkMinutes(DAY - HOUR, DAY + HOUR, LAT, LON)).toBe(0);
    });

    it('counts the minutes after sunset', () => {
        expect(darkMinutes(sunset.getTime() - HOUR, sunset.getTime() + 30 * MINUTE, LAT, LON)).toBeCloseTo(30, 0);
    });

    it('counts the minutes before sunrise', () => {
        expect(darkMinutes(sunrise.getTime() - 30 * MINUTE, sunrise.getTime() + HOUR, LAT, LON)).toBeCloseTo(30, 0);
    });

    it('counts a whole night between two days', () => {
        const nextSunrise = getTimes(new Date(DAY + 24 * HOUR), LAT, LON).sunrise.getTime();
        expect(darkMinutes(sunset.getTime(), nextSunrise, LAT, LON)).toBeCloseTo((nextSunrise - sunset.getTime()) / MINUTE, 0);
    });
});

describe('departureStrip', () => {
    // a 3 h ride
    const source = { distances: [0, 30000, 60000], totalTime: 3 * 3600 };
    const inputs: AnalysisInputs = { departure: { mode: 'planned', at: 0 }, pace: { ...DEFAULT_PACE }, geometryKey: 'k' };
    const strip = (chosenAt: number, now = chosenAt - 24 * HOUR) => departureStrip({ chosenAt, now, source, inputs, lat: LAT, lon: LON });

    it('lists 13 departures half an hour apart, the chosen one in the middle', () => {
        const chosenAt = DAY;
        const cells = strip(chosenAt);
        expect(cells).toHaveLength(13);
        expect(cells.map(({ offset }) => offset)).toEqual([-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180]);
        expect(cells[6].at).toBe(chosenAt);
        expect(cells.filter(({ chosen }) => chosen).map(({ at }) => at)).toEqual([chosenAt]);
    });

    it('gives each departure the arrival of its own timeline', () => {
        const cell = strip(DAY)[8];
        const timeline = buildTimeline(source, { ...inputs, departure: { mode: 'planned', at: cell.at } }, cell.at - HOUR);
        expect(cell.arrival).toBe(timeline.at(source.distances.length - 1));
    });

    it('counts the dark minutes of each ride, more as the departure gets later in the afternoon', () => {
        const cells = strip(sunset.getTime() - 3 * HOUR);
        expect(cells[0].darkMinutes).toBe(0);
        expect(cells[12].darkMinutes).toBeCloseTo(180, 0);
        expect(cells[12].darkMinutes).toBeGreaterThan(cells[9].darkMinutes);
    });

    it('marks the departures already gone, which are never the best', () => {
        const chosenAt = sunset.getTime() - HOUR;
        const cells = strip(chosenAt, chosenAt - 45 * MINUTE);
        expect(cells.filter(({ past }) => past).map(({ offset }) => offset)).toEqual([-180, -150, -120, -90, -60]);
        expect(cells.find(({ best }) => best).past).toBe(false);
        // a ride that would have left already is timed from its own departure, not from now
        expect(cells[0].arrival - cells[0].at).toBe(cells[12].arrival - cells[12].at);
    });

    it('stars the lowest score, the one nearest the chosen departure on a tie', () => {
        const midday = strip(DAY);
        expect(midday.filter(({ best }) => best).map(({ offset }) => offset)).toEqual([0]);
        const evening = strip(sunset.getTime() - HOUR);
        expect(evening.find(({ best }) => best).offset).toBeLessThan(0);
    });

    it('rates every departure good when they all score the same', () => {
        // a 1 h ride leaving between 3 h before and 3 h after noon: all in daylight
        const short = { distances: [0, 10000, 20000], totalTime: 3600 };
        const cells = departureStrip({ chosenAt: DAY - HOUR, now: DAY - 24 * HOUR, source: short, inputs, lat: LAT, lon: LON });
        expect(new Set(cells.map(({ level }) => level))).toEqual(new Set(['good']));
    });

    it('rates every departure poor when they are all in the dark alike', () => {
        // a 1 h ride leaving around midnight
        const short = { distances: [0, 10000, 20000], totalTime: 3600 };
        const midnight = Date.UTC(2026, 10, 4, 23);
        const cells = departureStrip({ chosenAt: midnight, now: midnight - 24 * HOUR, source: short, inputs, lat: LAT, lon: LON });
        expect(new Set(cells.map(({ level }) => level))).toEqual(new Set(['poor']));
    });

    it('rates by thirds of the score range: the darkest rides poor', () => {
        const cells = strip(sunset.getTime() - 3 * HOUR);
        expect(cells[0].level).toBe('good');
        expect(cells[12].level).toBe('poor');
        expect(cells.some(({ level }) => level === 'fair')).toBe(true);
    });

    describe('anchored', () => {
        it('keeps the window where it was when another departure is chosen: the chosen one moves, not the strip', () => {
            const cells = departureStrip({ anchorAt: DAY, chosenAt: DAY + HOUR, now: DAY - 24 * HOUR, source, inputs, lat: LAT, lon: LON });
            expect(cells[6].at).toBe(DAY);
            expect(cells.findIndex(({ chosen }) => chosen)).toBe(8);
            expect(cells.filter(({ chosen }) => chosen)).toHaveLength(1);
            // the offsets are from the chosen departure
            expect(cells[6].offset).toBe(-60);
            expect(cells[8].offset).toBe(0);
        });
    });

    describe('with the forecast', () => {
        const noon = DAY;
        // the rain comes at noon: every ride leaving from then on gets 2 mm
        const rainy = (at: number) => ({ rainMm: at >= noon ? 2 : 0, headShare: 0, covered: true });
        const cellsWith = (weather: Parameters<typeof departureStrip>[0]['weather'], chosenAt = noon) =>
            departureStrip({ chosenAt, now: chosenAt - 24 * HOUR, source, inputs, lat: LAT, lon: LON, weather });

        it('adds 3 points for each mm of rain', () => {
            const without = cellsWith(undefined);
            const cells = cellsWith(rainy);
            expect(cells[2].score).toBeCloseTo(without[2].score, 5);
            expect(cells[8].score).toBeCloseTo(without[8].score + 6, 5);
        });

        it('adds 2 points for the whole way against the wind', () => {
            const cells = cellsWith(() => ({ rainMm: 0, headShare: 0.5, covered: true }));
            expect(cells[3].score).toBeCloseTo(cellsWith(undefined)[3].score + 1, 5);
        });

        it('stars a dry departure rather than one that gets the rain', () => {
            const best = cellsWith(rainy).find(({ best: starred }) => starred);
            expect(best?.at).toBeLessThan(noon);
        });

        it('rates the rainy departures poor and the dry ones good', () => {
            const cells = cellsWith(rainy);
            expect(cells[2].level).toBe('good');
            expect(cells[10].level).toBe('poor');
        });

        it('says what weighs most on a departure: the rain, the wind, the dark', () => {
            expect(cellsWith(rainy)[9].worst).toBe('rain');
            expect(cellsWith(() => ({ rainMm: 0, headShare: 1, covered: true }))[3].worst).toBe('wind');
            const dark = departureStrip({ chosenAt: sunset.getTime() - HOUR, now: DAY - 24 * HOUR, source, inputs, lat: LAT, lon: LON, weather: () => ({ rainMm: 0, headShare: 0, covered: true }) });
            expect(dark[12].worst).toBe('dark');
            expect(cellsWith(() => ({ rainMm: 0, headShare: 0, covered: true }))[3].worst).toBeUndefined();
        });

        it('weighs the rain, the wind and the dark against each other', () => {
            // 0.5 mm is 1.5, half the way against the wind is 1, 30 dark minutes are 2
            const dark = departureStrip({
                chosenAt: sunset.getTime() - 150 * MINUTE,
                now: DAY - 24 * HOUR,
                source,
                inputs,
                lat: LAT,
                lon: LON,
                weather: () => ({ rainMm: 0.5, headShare: 0.5, covered: true })
            });
            const cell = dark.find(({ darkMinutes }) => darkMinutes > 20 && darkMinutes < 40);
            expect(cell?.worst).toBe('dark');
        });

        it('keeps the rain and the wind of each ride, for the panel to say them', () => {
            const cells = cellsWith(() => ({ rainMm: 1.5, headShare: 0.25, covered: true }));
            expect(cells[4]).toMatchObject({ rainMm: 1.5, headShare: 0.25 });
            expect(cellsWith(undefined)[4].rainMm).toBeUndefined();
        });

        describe('indicators', () => {
            const at = (factors: Partial<WeatherFactorsInput>) => cellsWith(() => ({ rainMm: 0, headShare: 0, covered: true, ...factors }))[3];

            it('says rain from a tenth of a millimeter', () => {
                expect(at({ rainMm: 0.1 }).indicators).toContain('rain');
                expect(at({ rainMm: 0.09 }).indicators).not.toContain('rain');
            });

            it('says wind when a quarter of the way is against it', () => {
                expect(at({ headShare: 0.25 }).indicators).toContain('wind');
                expect(at({ headShare: 0.24 }).indicators).not.toContain('wind');
            });

            it('says sun for a dry ride under a clear sky: under 40 % of cloud', () => {
                expect(at({ cloud: 39 }).indicators).toContain('sun');
                expect(at({ cloud: 40 }).indicators).not.toContain('sun');
                expect(at({ cloud: 10, rainMm: 1 }).indicators).not.toContain('sun');
                expect(at({}).indicators).not.toContain('sun');
            });

            it('says dark when the ride goes into it', () => {
                const dark = departureStrip({
                    chosenAt: sunset.getTime() - HOUR,
                    now: DAY - 24 * HOUR,
                    source,
                    inputs,
                    lat: LAT,
                    lon: LON,
                    weather: () => ({ rainMm: 0, headShare: 0, covered: true })
                });
                expect(dark[12].indicators).toContain('dark');
                expect(dark[0].indicators).not.toContain('dark');
            });

            it('says the forecast does not reach a ride, and nothing of its weather', () => {
                const cell = cellsWith(() => ({ rainMm: 5, headShare: 1, covered: false }))[3];
                expect(cell.indicators).toContain('unknown');
                expect(cell.indicators).not.toContain('rain');
                expect(cell.indicators).not.toContain('wind');
            });

            it('keeps the order: rain, wind, sun, dark', () => {
                const dark = departureStrip({
                    chosenAt: sunset.getTime() - HOUR,
                    now: DAY - 24 * HOUR,
                    source,
                    inputs,
                    lat: LAT,
                    lon: LON,
                    weather: () => ({ rainMm: 1, headShare: 0.5, covered: true })
                });
                expect(dark[12].indicators).toEqual(['rain', 'wind', 'dark']);
            });

            it('has none without a forecast, but the dark', () => {
                expect(cellsWith(undefined)[3].indicators).toEqual([]);
            });
        });

        it('never stars a departure the forecast does not reach, which would score better for knowing nothing', () => {
            // 3 points of rain before noon, none known after
            const cells = cellsWith((at) => ({ rainMm: 1, headShare: 0, covered: at < noon }));
            const best = cells.find(({ best: starred }) => starred);
            expect(best?.uncovered).toBe(false);
            expect(best?.at).toBeLessThan(noon);
        });

        it('rates a departure the forecast does not reach unknown, whatever its darkness says', () => {
            const cells = cellsWith((at) => ({ rainMm: 1, headShare: 0, covered: at < noon }));
            expect(cells.filter(({ uncovered }) => uncovered).every(({ level }) => level === 'unknown')).toBe(true);
            expect(cells.filter(({ uncovered }) => uncovered === false).every(({ level }) => level !== 'unknown')).toBe(true);
        });

        it('rates the others by their own range, the ones not known left out of it', () => {
            const cells = cellsWith((at) => ({ rainMm: at < noon - HOUR ? 0 : 2, headShare: 0, covered: at < noon + HOUR }));
            const covered = cells.filter(({ uncovered }) => uncovered === false);
            expect(covered.some(({ level }) => level === 'good')).toBe(true);
            expect(covered.some(({ level }) => level === 'poor')).toBe(true);
        });

        it('leaves a departure the forecast does not cover to its darkness, and says so', () => {
            const cells = cellsWith((at) => ({ rainMm: 5, headShare: 1, covered: at < noon + HOUR }));
            const without = cellsWith(undefined);
            expect(cells[9].uncovered).toBe(true);
            expect(cells[9].score).toBeCloseTo(without[9].score, 5);
            expect(cells[7].uncovered).toBe(false);
            expect(cellsWith(undefined)[8].uncovered).toBeUndefined();
        });
    });
});
