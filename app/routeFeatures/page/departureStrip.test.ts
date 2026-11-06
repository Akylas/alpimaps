import { getTimes } from 'suncalc';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PACE } from '~/utils/routeAnalysis/storage';
import { buildTimeline } from '~/utils/routeAnalysis/timeline';
import type { AnalysisInputs } from '~/utils/routeAnalysis/types';
import { type DepartureAssessor, darkMinutes, departureStrip, stripScrollIndex } from './departureStrip';

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

    describe('with what the features say', () => {
        const noon = DAY;
        // the rain comes at noon: every ride leaving from then on gets 6 points; a feature of its own marks it
        const rainy: DepartureAssessor = (at) => ({ points: { rain: at >= noon ? 6 : 0 }, indicators: at >= noon ? ['test.rain'] : [], covered: true, rainMm: at >= noon ? 2 : undefined });
        const cellsWith = (assessors: DepartureAssessor[] | undefined, chosenAt = noon) => departureStrip({ chosenAt, now: chosenAt - 24 * HOUR, source, inputs, lat: LAT, lon: LON, assessors });

        it('adds their points to the darkness', () => {
            const without = cellsWith(undefined);
            const cells = cellsWith([rainy]);
            expect(cells[2].score).toBeCloseTo(without[2].score, 5);
            expect(cells[8].score).toBeCloseTo(without[8].score + 6, 5);
        });

        it('adds the points of every feature', () => {
            const wind: DepartureAssessor = () => ({ points: { wind: 1 }, indicators: [], covered: true });
            expect(cellsWith([rainy, wind])[8].score).toBeCloseTo(cellsWith(undefined)[8].score + 7, 5);
        });

        it('stars a departure that is good rather than one that gets the rain', () => {
            expect(cellsWith([rainy]).find(({ best: starred }) => starred)?.at).toBeLessThan(noon);
        });

        it('rates the rainy departures poor and the dry ones good', () => {
            const cells = cellsWith([rainy]);
            expect(cells[2].level).toBe('good');
            expect(cells[10].level).toBe('poor');
        });

        it('marks a departure with the ids they give, the darkness after them, in the order of the features', () => {
            const windy: DepartureAssessor = () => ({ points: {}, indicators: ['test.wind'], covered: true });
            const dark = departureStrip({ chosenAt: sunset.getTime() - HOUR, now: DAY - 24 * HOUR, source, inputs, lat: LAT, lon: LON, assessors: [rainy, windy] });
            expect(dark[12].indicators).toEqual(['test.rain', 'test.wind', 'dark']);
            expect(dark[0].indicators).not.toContain('dark');
        });

        it('has no marks without a feature, but the darkness', () => {
            expect(cellsWith(undefined)[3].indicators).toEqual([]);
        });

        it('keeps the rain they expect on each ride, for the cell to show it', () => {
            const cells = cellsWith([rainy]);
            expect(cells[8].rainMm).toBe(2);
            expect(cells[2].rainMm).toBeUndefined();
        });

        describe('a ride a feature knows nothing of', () => {
            const reach: DepartureAssessor = (at) =>
                at < noon + HOUR ? { points: { rain: 3 }, indicators: ['test.rain'], covered: true } : { points: { rain: 99 }, indicators: ['test.rain'], covered: false };
            const cells = cellsWith([reach]);

            it('is marked unknown, its points and marks left out', () => {
                expect(cells[9].uncovered).toBe(true);
                expect(cells[9].indicators).toContain('unknown');
                expect(cells[9].indicators).not.toContain('test.rain');
                expect(cells[9].score).toBeCloseTo(cellsWith(undefined)[9].score, 5);
                expect(cells[7].uncovered).toBe(false);
                expect(cellsWith(undefined)[7].uncovered).toBeUndefined();
            });

            it('is never starred, which it would be for knowing nothing, and is rated unknown', () => {
                const best = cells.find(({ best: starred }) => starred);
                expect(best?.uncovered).toBe(false);
                expect(cells.filter(({ uncovered }) => uncovered).every(({ level }) => level === 'unknown')).toBe(true);
                expect(cells.filter(({ uncovered }) => uncovered === false).every(({ level }) => level !== 'unknown')).toBe(true);
            });

            it('takes no part in the range the others are rated by', () => {
                const mixed = cellsWith([(at) => ({ points: { rain: at < noon - HOUR ? 0 : 2 }, indicators: [], covered: at < noon + HOUR })]);
                const covered = mixed.filter(({ uncovered }) => uncovered === false);
                expect(covered.some(({ level }) => level === 'good')).toBe(true);
                expect(covered.some(({ level }) => level === 'poor')).toBe(true);
            });
        });
    });

    describe('stripScrollIndex', () => {
        const cells = departureStrip({ chosenAt: DAY, now: DAY - 2 * HOUR, source, inputs, lat: LAT, lon: LON });
        const firstToCome = cells.findIndex(({ past }) => !past);

        it('starts at the first departure to come for now: the past is not shown', () => {
            expect(stripScrollIndex(cells, 'now', 5)).toBe(firstToCome);
        });

        it('puts the chosen departure in the middle of the cells that fit for another one', () => {
            const chosen = cells.findIndex(({ chosen }) => chosen);
            expect(stripScrollIndex(cells, 'planned', 5)).toBe(chosen - 2);
            expect(stripScrollIndex(cells, 'planned', 6)).toBe(chosen - 3);
        });

        it('does not scroll past either end of the strip', () => {
            const early = departureStrip({ anchorAt: DAY, chosenAt: DAY - 3 * HOUR, now: DAY - 12 * HOUR, source, inputs, lat: LAT, lon: LON });
            expect(stripScrollIndex(early, 'planned', 7)).toBe(0);
            const late = departureStrip({ anchorAt: DAY, chosenAt: DAY + 3 * HOUR, now: DAY - 12 * HOUR, source, inputs, lat: LAT, lon: LON });
            expect(stripScrollIndex(late, 'planned', 5)).toBe(late.length - 5);
        });

        it('starts at the first cell when they all fit', () => {
            expect(stripScrollIndex(cells, 'planned', 40)).toBe(0);
        });
    });
});
