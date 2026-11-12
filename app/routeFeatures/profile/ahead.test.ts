import { describe, expect, it } from 'vitest';
import type { RouteProfile } from '~/models/Item';
import { indexAtDistance, profileAhead } from './ahead';

// a vertex every 100 m, climbing 5 m each, so `dp` is the index times 5
const data = Array.from({ length: 11 }, (unused, index) => ({ d: index * 100, a: 500 + index * 5, dp: index * 5, dm: 0 }));
const profile = {
    max: [0, 0],
    min: [0, 0],
    data,
    ascents: [
        { startIndex: 1, endIndex: 3, gain: 10, highestElevation: 515, highestPointIndex: 3 },
        { startIndex: 7, endIndex: 9, gain: 10, highestElevation: 535, highestPointIndex: 9 }
    ]
} as RouteProfile;

describe('indexAtDistance', () => {
    it('finds the first vertex at or past the distance', () => {
        expect(indexAtDistance(data, 250)).toBe(3);
        expect(indexAtDistance(data, 300)).toBe(3);
    });
    it('stops at the last vertex when the route ends before', () => {
        expect(indexAtDistance(data, 5000)).toBe(10);
    });
});

describe('profileAhead', () => {
    it('measures the stretch from the rider', () => {
        expect(profileAhead(profile, 2, 400)).toEqual({ fromIndex: 2, toIndex: 6, ascent: 20, climbs: 1 });
    });
    it('counts the climbs it reaches into, even in part', () => {
        expect(profileAhead(profile, 2, 600)?.climbs).toBe(2);
        expect(profileAhead(profile, 3, 300)?.climbs).toBe(0);
    });
    it('ends with the route', () => {
        expect(profileAhead(profile, 9, 15000)).toEqual({ fromIndex: 9, toIndex: 10, ascent: 5, climbs: 0 });
    });
    it('is null without a profile', () => {
        expect(profileAhead(undefined, 0)).toBeNull();
        expect(profileAhead({ ...profile, data: [] }, 0)).toBeNull();
    });
});
