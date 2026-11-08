import { describe, expect, it } from 'vitest';
import { EXPOSURE_STATUS, chunkSamples, isShaded, mergeExposure } from '~/routeFeatures/sun/terrain/exposure';

describe('chunkSamples', () => {
    it('cuts the samples in calls of at most the size, in order, with nothing lost', () => {
        const samples = Array.from({ length: 7 }, (_, index) => index);
        expect(chunkSamples(samples, 3)).toEqual([[0, 1, 2], [3, 4, 5], [6]]);
    });

    it('has no call for no sample, and one for a few', () => {
        expect(chunkSamples([], 3)).toEqual([]);
        expect(chunkSamples([1, 2], 250)).toEqual([[1, 2]]);
    });

    it('is 250 points a call by default', () => {
        const chunks = chunkSamples(Array.from({ length: 600 }, (_, index) => index));
        expect(chunks.map((chunk) => chunk.length)).toEqual([250, 250, 100]);
    });
});

describe('mergeExposure', () => {
    it('puts the calls end to end, the share lit in whole percents', () => {
        const merged = mergeExposure([
            { sunFraction: [1, 0.5], status: [0, 0] },
            { sunFraction: [0.123, 0], status: [0, 0] }
        ]);
        expect(merged.lit).toEqual([100, 50, 12, 0]);
        expect(merged.flags).toEqual([]);
        expect(merged.coverage).toBe(1);
    });

    it('keeps what is not known as unknown, and flags it and what came from a coarse ground', () => {
        const merged = mergeExposure([{ sunFraction: [1, -1, 0.4, 0.9], status: [0, EXPOSURE_STATUS.NO_DEM, EXPOSURE_STATUS.COARSE_DEM, EXPOSURE_STATUS.LOW_SUN] }]);
        expect(merged.lit).toEqual([100, -1, 40, 90]);
        expect(merged.flags).toEqual([
            { i: 1, f: EXPOSURE_STATUS.NO_DEM },
            { i: 2, f: EXPOSURE_STATUS.COARSE_DEM },
            { i: 3, f: EXPOSURE_STATUS.LOW_SUN }
        ]);
    });

    it('counts as covered what was read from ground fine enough, the dark and the low sun included', () => {
        const merged = mergeExposure([{ sunFraction: [1, -1, 0.4, 0, 0.9], status: [0, EXPOSURE_STATUS.NO_DEM, EXPOSURE_STATUS.COARSE_DEM, EXPOSURE_STATUS.DARK, EXPOSURE_STATUS.LOW_SUN] }]);
        expect(merged.coverage).toBeCloseTo(3 / 5, 5);
    });

    it('does not flag the dark, which is no weakness of the answer', () => {
        expect(mergeExposure([{ sunFraction: [0], status: [EXPOSURE_STATUS.DARK] }]).flags).toEqual([]);
    });

    it('has full coverage of nothing', () => {
        expect(mergeExposure([]).coverage).toBe(1);
    });
});

describe('isShaded', () => {
    it('is a known share lit under 30 percent', () => {
        expect(isShaded(0)).toBe(true);
        expect(isShaded(29)).toBe(true);
        expect(isShaded(30)).toBe(false);
        expect(isShaded(100)).toBe(false);
    });

    it('is not shade where the share is not known', () => {
        expect(isShaded(-1)).toBe(false);
        expect(isShaded(undefined)).toBe(false);
    });
});
