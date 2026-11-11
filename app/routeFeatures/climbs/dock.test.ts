import { describe, expect, it } from 'vitest';
import type { Climb, SteepSection } from './steep';
import { climbNow, steepNow } from './dock';

// a vertex every 100 m, 10 m higher each
const data = Array.from({ length: 21 }, (_, index) => ({ d: index * 100, a: 500 + index * 10 }));
const climb = (startIndex: number, endIndex: number): Climb => ({
    startIndex,
    endIndex,
    startDistance: startIndex * 100,
    endDistance: endIndex * 100,
    length: (endIndex - startIndex) * 100,
    gain: (endIndex - startIndex) * 10,
    avgGrade: 10,
    maxGrade: 12,
    category: 3
});
const climbs = [climb(4, 8), climb(12, 16)];
const steepSection = (startIndex: number, endIndex: number, direction: 'up' | 'down' = 'up'): SteepSection =>
    ({ startIndex, endIndex, startDistance: startIndex * 100, endDistance: endIndex * 100, length: (endIndex - startIndex) * 100, direction, avgGrade: direction === 'up' ? 11 : -11 }) as SteepSection;

describe('climbNow', () => {
    it('says what is left of the climb the rider is in', () => {
        expect(climbNow(climbs, data, 6)).toEqual({ mode: 'on', climb: climbs[0], gain: 20, distance: 200 });
    });
    it('says what the next climb is and how far, between climbs', () => {
        expect(climbNow(climbs, data, 9)).toEqual({ mode: 'next', climb: climbs[1], gain: 40, distance: 300 });
    });
    it('is the next climb from the first vertex of it, before the summit it is still on', () => {
        expect(climbNow(climbs, data, 4)?.mode).toBe('on');
        expect(climbNow(climbs, data, 8)?.mode).toBe('next');
    });
    it('is null when no climb is left, or the rider is nowhere', () => {
        expect(climbNow(climbs, data, 17)).toBeNull();
        expect(climbNow(climbs, data, -1)).toBeNull();
        expect(climbNow([], data, 3)).toBeNull();
    });
});

describe('steepNow', () => {
    const steep = [steepSection(2, 3), steepSection(6, 8, 'down'), steepSection(10, 12)];
    it('is the next steep way up, how far to its start', () => {
        expect(steepNow(steep, data, 0)).toEqual({ grade: 11, distance: 200, inside: false });
    });
    it('skips a descent', () => {
        expect(steepNow(steep, data, 4)).toEqual({ grade: 11, distance: 600, inside: false });
    });
    it('says what is left of the one the rider is in', () => {
        expect(steepNow(steep, data, 11)).toEqual({ grade: 11, distance: 100, inside: true });
    });
    it('is null when there is none left', () => {
        expect(steepNow(steep, data, 12)).toBeNull();
        expect(steepNow(steep, data, -1)).toBeNull();
    });
});
