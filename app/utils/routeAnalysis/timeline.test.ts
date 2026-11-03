import { describe, expect, it } from 'vitest';
import { activityFromRoute } from './activity';
import { departurePassed, resolveStart, routeTimeZone, withRouteTimeZone } from './departure';
import { flatSpeedKmh, gradeSpeedKmh } from './speeds';
import { DEFAULT_PACE } from './storage';
import { buildTimeline, cumulativeDistances, timelineSource } from './timeline';
import type { Activity, AnalysisInputs } from './types';

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);
const HOUR = 3600;
const hike: Activity = { kind: 'hike', subtype: 'walk', origin: 'user' };
const road: Activity = { kind: 'bike', subtype: 'road', origin: 'user' };

function inputs(overrides: Partial<AnalysisInputs> = {}): AnalysisInputs {
    return { activity: hike, departure: { mode: 'now' }, pace: { ...DEFAULT_PACE }, geometryKey: 'k', ...overrides };
}

describe('departure', () => {
    it('starts now, at the plan, or at the recording', () => {
        expect(resolveStart({ mode: 'now' }, NOW)).toBe(NOW);
        expect(resolveStart({ mode: 'planned', at: NOW + 5000 }, NOW)).toBe(NOW + 5000);
        expect(resolveStart({ mode: 'recorded', at: NOW - 5000 }, NOW)).toBe(NOW - 5000);
    });
    it('reads a plan that is in the past as now (decision 03.2)', () => {
        expect(resolveStart({ mode: 'planned', at: NOW - 5000 }, NOW)).toBe(NOW);
    });
    it('tells when a plan has passed, not a recording or now', () => {
        expect(departurePassed({ mode: 'planned', at: NOW - 1 }, NOW)).toBe(true);
        expect(departurePassed({ mode: 'planned', at: NOW + 1 }, NOW)).toBe(false);
        expect(departurePassed({ mode: 'recorded', at: NOW - 1 }, NOW)).toBe(false);
        expect(departurePassed({ mode: 'now' }, NOW)).toBe(false);
    });
    it('uses the route zone, else the phone zone flagged', () => {
        expect(routeTimeZone({ mode: 'now' }, 'Europe/Paris')).toEqual({ tz: 'Europe/Paris', fromPhone: true });
        const known = withRouteTimeZone({ mode: 'now', tzFromPhone: true }, 'America/Denver');
        expect(known.tzFromPhone).toBe(false);
        expect(routeTimeZone(known, 'Europe/Paris')).toEqual({ tz: 'America/Denver', fromPhone: false });
    });
});

describe('speeds', () => {
    it('knows a flat speed per activity', () => {
        expect(flatSpeedKmh(undefined)).toBe(4);
        expect(flatSpeedKmh({ kind: 'hike', subtype: 'run', origin: 'user' })).toBe(12);
        expect(flatSpeedKmh(road)).toBe(20);
        expect(flatSpeedKmh({ kind: 'bike', origin: 'user' })).toBe(15);
    });
    it('gives the directions panel its speeds', () => {
        const walks = { normal: 4, mountainairing: 4, running: 12 };
        Object.entries(walks).forEach(([subtype, speed]) => expect(flatSpeedKmh(activityFromRoute({ type: 'pedestrian', subtype }))).toBe(speed));
        const rides = { enduro: 10, mountain: 12, gravel: 18, road: 20, normal: 15 };
        Object.entries(rides).forEach(([subtype, speed]) => expect(flatSpeedKmh(activityFromRoute({ type: 'bicycle', subtype }))).toBe(speed));
    });
    it('slows a hiker on a climb and on a steep descent, fastest on a gentle descent', () => {
        const flat = gradeSpeedKmh(hike, 0);
        expect(gradeSpeedKmh(hike, 0.15)).toBeLessThan(flat);
        expect(gradeSpeedKmh(hike, -0.05)).toBeGreaterThan(flat);
        expect(gradeSpeedKmh(hike, -0.3)).toBeLessThan(flat);
    });
    it('slows a bike on a climb and speeds it on a descent', () => {
        const flat = gradeSpeedKmh(road, 0);
        expect(flat).toBe(20);
        expect(gradeSpeedKmh(road, 0.06)).toBeLessThan(flat / 1.5);
        expect(gradeSpeedKmh(road, -0.06)).toBeGreaterThan(flat);
    });
});

describe('buildTimeline', () => {
    const distances = [0, 1000, 3000, 4000];

    it('spreads the routed time by distance (the default)', () => {
        const timeline = buildTimeline({ distances, totalTime: 2000 }, inputs(), NOW);
        expect(Array.from(timeline.t)).toEqual([0, 500, 1500, 2000]);
        expect(timeline.model).toBe('proportional');
        expect(timeline.startAt).toBe(NOW);
        expect(timeline.totalSec).toBe(2000);
        expect(timeline.at(2)).toBe(NOW + 1500_000);
    });
    it('applies the pace and the stops on top, the moving time only takes the pace', () => {
        const pace = { multiplier: 1.25, stopsMinPerHour: 6, model: 'proportional' as const };
        const timeline = buildTimeline({ distances, totalTime: 2000 }, inputs({ pace }), NOW);
        expect(timeline.totalSec).toBeCloseTo(2000 * 1.25 * 1.1);
        expect(timeline.movingSec).toBeCloseTo(2500);
    });
    it('starts at the plan, or now when the plan went by', () => {
        const future = buildTimeline({ distances, totalTime: 100 }, inputs({ departure: { mode: 'planned', at: NOW + 60_000 } }), NOW);
        expect(future.startAt).toBe(NOW + 60_000);
        const past = buildTimeline({ distances, totalTime: 100 }, inputs({ departure: { mode: 'planned', at: NOW - 60_000 } }), NOW);
        expect(past.startAt).toBe(NOW);
    });
    it('rides on the grade when nothing was routed', () => {
        const flat = buildTimeline({ distances: [0, 2000, 4000] }, inputs(), NOW);
        expect(flat.model).toBe('gradeAware');
        expect(flat.totalSec).toBeCloseTo(HOUR, 0);
        const climb = buildTimeline({ distances: [0, 2000, 4000], altitudes: [0, 300, 600] }, inputs(), NOW);
        expect(climb.totalSec).toBeGreaterThan(flat.totalSec);
        const bike = buildTimeline({ distances: [0, 2000, 4000] }, inputs({ activity: road }), NOW);
        expect(bike.totalSec).toBeCloseTo(720, 0);
    });
    it('rides on the grade when the pace says so, even if a time was routed', () => {
        const pace = { ...DEFAULT_PACE, model: 'gradeAware' as const };
        const timeline = buildTimeline({ distances: [0, 4000], totalTime: 99 }, inputs({ pace }), NOW);
        expect(timeline.model).toBe('gradeAware');
        expect(timeline.totalSec).toBeCloseTo(HOUR, 0);
    });
    describe('by maneuver', () => {
        const pace = { ...DEFAULT_PACE, model: 'valhalla' as const };
        const route = { distances: [0, 1, 2, 3, 4], totalTime: 400 };
        const instructions = [
            { index: 0, time: 100 },
            { index: 2, time: 300 },
            { index: 4, time: 0 }
        ];
        it('spends each maneuver time over its own stretch', () => {
            const timeline = buildTimeline({ ...route, instructions }, inputs({ pace }), NOW);
            expect(timeline.model).toBe('valhalla');
            expect(Array.from(timeline.t)).toEqual([0, 50, 100, 250, 400]);
        });
        it('scales the maneuver times to the routed total', () => {
            const timeline = buildTimeline({ ...route, totalTime: 800, instructions }, inputs({ pace }), NOW);
            expect(Array.from(timeline.t)).toEqual([0, 100, 200, 500, 800]);
        });
        it('waits at the start until the first maneuver', () => {
            const partial = [
                { index: 1, time: 100 },
                { index: 3, time: 100 }
            ];
            const timeline = buildTimeline({ ...route, totalTime: 200, instructions: partial }, inputs({ pace }), NOW);
            expect(Array.from(timeline.t)).toEqual([0, 0, 50, 100, 200]);
        });
        it('is opt-in: the default pace keeps the distance spread', () => {
            const timeline = buildTimeline({ ...route, instructions }, inputs(), NOW);
            expect(timeline.model).toBe('proportional');
            expect(Array.from(timeline.t)).toEqual([0, 100, 200, 300, 400]);
        });
        it('falls back to the distance spread when the maneuvers do not fit the route', () => {
            const outOfOrder = [
                { index: 2, time: 100 },
                { index: 1, time: 300 }
            ];
            const outOfRange = [{ index: 9, time: 100 }];
            const noTime = [{ index: 0, time: 0 }];
            [outOfOrder, outOfRange, noTime, []].forEach((bad) => {
                expect(buildTimeline({ ...route, instructions: bad }, inputs({ pace }), NOW).model).toBe('proportional');
            });
            expect(buildTimeline({ ...route }, inputs({ pace }), NOW).model).toBe('proportional');
        });
        it('is not used without a routed time', () => {
            expect(buildTimeline({ distances: route.distances, instructions }, inputs({ pace }), NOW).model).toBe('gradeAware');
        });
        it('is read off the item', () => {
            const geometry = {
                type: 'LineString' as const,
                coordinates: [
                    [6, 45],
                    [6, 45.01]
                ]
            };
            expect(timelineSource({ geometry, instructions }).instructions).toBe(instructions);
        });
    });
    it('prefers the recording', () => {
        const recorded = { t: [0, 100, 250, 400], startedAt: NOW - 1_000_000 };
        const timeline = buildTimeline({ distances, totalTime: 2000, recorded }, inputs(), NOW);
        expect(timeline.model).toBe('recorded');
        expect(timeline.startAt).toBe(recorded.startedAt);
        expect(Array.from(timeline.t)).toEqual(recorded.t);
    });
    it('ignores a recording of another length', () => {
        const timeline = buildTimeline({ distances, totalTime: 2000, recorded: { t: [0, 5], startedAt: 0 } }, inputs(), NOW);
        expect(timeline.model).toBe('proportional');
    });
    it('copes with an empty route', () => {
        const timeline = buildTimeline({ distances: [], totalTime: 10 }, inputs(), NOW);
        expect(timeline.totalSec).toBe(0);
        expect(timeline.indexAt(NOW + 5000)).toBe(0);
        expect(timeline.at(3)).toBe(NOW);
    });

    describe('days', () => {
        // 2 h of riding in 30 min steps, one hour a day
        const route = { distances: [0, 1, 2, 3, 4], totalTime: 2 * HOUR };
        const days = [{ startAt: NOW, maxHours: 1 }, { startAt: NOW + 24 * HOUR * 1000 }];
        it('jumps to the next day once the hours of the day are used', () => {
            const timeline = buildTimeline(route, inputs({ departure: { mode: 'planned', at: NOW, days } }), NOW);
            expect(Array.from(timeline.t)).toEqual([0, 1800, 3600, 24 * HOUR + 1800, 24 * HOUR + 3600]);
            expect(timeline.model).toBe('proportional');
        });
        it('never starts a day before the previous one ended', () => {
            const early = [{ startAt: NOW, maxHours: 1 }, { startAt: NOW + 10 * 60_000 }];
            const timeline = buildTimeline(route, inputs({ departure: { mode: 'planned', at: NOW, days: early } }), NOW);
            expect(Array.from(timeline.t)).toEqual([0, 1800, 3600, 5400, 7200]);
        });
        it('counts the days from the start actually used', () => {
            const late = buildTimeline(route, inputs({ departure: { mode: 'planned', at: NOW - 1000, days } }), NOW);
            expect(late.startAt).toBe(NOW);
            expect(late.t[3]).toBe(24 * HOUR + 1800);
        });
    });

    describe('indexAt', () => {
        const timeline = buildTimeline({ distances, totalTime: 2000 }, inputs(), NOW);
        it('finds the first vertex at or after a time', () => {
            expect(timeline.indexAt(NOW)).toBe(0);
            expect(timeline.indexAt(NOW + 500_000)).toBe(1);
            expect(timeline.indexAt(NOW + 500_001)).toBe(2);
            expect(timeline.indexAt(NOW - 10_000)).toBe(0);
        });
        it('stops at the last vertex after the end', () => {
            expect(timeline.indexAt(NOW + 9_999_000)).toBe(3);
        });
    });

    describe('reanchor', () => {
        const timeline = buildTimeline({ distances: [0, 1, 2, 3], totalTime: 1800 }, inputs(), NOW);
        const later = NOW + 3 * HOUR * 1000;
        it('puts the user at now and keeps the planned pace', () => {
            const anchored = timeline.reanchor(2, later);
            expect(anchored.startAt).toBe(later);
            expect(Array.from(anchored.t)).toEqual([-1200, -600, 0, 600]);
            expect(anchored.indexAt(later)).toBe(2);
            expect(anchored.totalSec).toBe(600);
        });
        it('rescales what is left by the speed factor, clamped (above 1 is faster)', () => {
            expect(Array.from(timeline.reanchor(1, later, 1.5).t)).toEqual([-600, 0, 400, 800]);
            expect(timeline.reanchor(0, later, 9).totalSec).toBeCloseTo(1800 / 1.5);
            expect(timeline.reanchor(0, later, 0.1).totalSec).toBeCloseTo(1800 / 0.7);
        });
        it('leaves the original alone', () => {
            timeline.reanchor(2, later, 1.5);
            expect(timeline.totalSec).toBe(1800);
        });
    });
});

describe('timelineSource', () => {
    const geometry = {
        type: 'LineString' as const,
        coordinates: [
            [6, 45],
            [6, 45.01],
            [6, 45.02]
        ]
    };
    it('measures the geometry when there is no profile', () => {
        const source = timelineSource({ geometry, route: { totalTime: 100 } });
        expect(source.distances[2]).toBeCloseTo(2226.4, 0);
        expect(source.altitudes).toBeUndefined();
        expect(source.totalTime).toBe(100);
        expect(Array.from(cumulativeDistances(geometry.coordinates))).toEqual(Array.from(source.distances));
    });
    it('uses the profile when it covers every vertex', () => {
        const profile = {
            data: [
                { d: 0, a: 100 },
                { d: 1500, a: 200 },
                { d: 3000, a: 150 }
            ]
        };
        const source = timelineSource({ geometry, profile });
        expect(Array.from(source.distances)).toEqual([0, 1500, 3000]);
        expect(Array.from(source.altitudes)).toEqual([100, 200, 150]);
    });
    it('does not trust a profile of another length', () => {
        const source = timelineSource({
            geometry,
            profile: {
                data: [
                    { d: 0, a: 1 },
                    { d: 9, a: 2 }
                ]
            }
        });
        expect(source.distances).toHaveLength(3);
        expect(source.altitudes).toBeUndefined();
    });
    it('flattens a MultiLineString and carries the recording', () => {
        const recorded = { t: [0, 1, 2, 3], startedAt: 5 };
        const source = timelineSource({
            geometry: { type: 'MultiLineString', coordinates: [geometry.coordinates.slice(0, 2), geometry.coordinates.slice(1)] },
            analysis: { v: 1, inputs: inputs(), layers: {}, recorded }
        });
        expect(source.distances).toHaveLength(4);
        expect(source.recorded).toBe(recorded);
    });
});
