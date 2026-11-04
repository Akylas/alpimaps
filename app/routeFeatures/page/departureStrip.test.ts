import { getTimes } from 'suncalc';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PACE } from '~/utils/routeAnalysis/storage';
import { buildTimeline } from '~/utils/routeAnalysis/timeline';
import type { AnalysisInputs } from '~/utils/routeAnalysis/types';
import { darkMinutes, departureStrip } from './departureStrip';

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
});
