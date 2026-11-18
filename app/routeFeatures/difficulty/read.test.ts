import { describe, expect, it } from 'vitest';
import type { DifficultyRun } from '~/utils/routeAnalysis/types';
import { legendLevels, readDifficulty } from './read';
import { UNKNOWN_LEVEL } from './scale';

// a vertex every 100 m
const profile = Array.from({ length: 21 }, (_, index) => ({ d: index * 100 }));
const run = (start: number, end: number, level: number): DifficultyRun => ({ start, end, level });
const read = (runs: DifficultyRun[], comfort = 2) => readDifficulty({ scale: 'sac', runs }, profile, comfort);

describe('readDifficulty', () => {
    it('measures each run on the profile', () => {
        const result = read([run(0, 4, 1), run(4, 10, 3)]);
        expect(result.lengths).toEqual([400, 600]);
        expect(result.total).toBe(1000);
    });

    it('takes the highest level for the hardest stretch, the longest when two share it', () => {
        const result = read([run(0, 2, 4), run(2, 10, 1), run(10, 16, 4), run(16, 18, 2)]);
        expect(result.hardest).toEqual({ level: 4, length: 600, run: run(10, 16, 4) });
    });

    it('never takes a stretch that is not rated for the hardest', () => {
        expect(read([run(0, 10, UNKNOWN_LEVEL), run(10, 12, 1)]).hardest?.level).toBe(1);
        expect(read([run(0, 10, UNKNOWN_LEVEL)]).hardest).toBeUndefined();
    });

    it('counts what is above the comfort level, which is not the comfort level itself', () => {
        const result = read([run(0, 4, 2), run(4, 6, 3), run(6, 10, 5), run(10, 20, UNKNOWN_LEVEL)]);
        expect(result.above).toBe(600);
        expect(result.aboveShare).toBeCloseTo(0.3);
        expect(read([run(0, 4, 2), run(4, 6, 3)], 3).above).toBe(0);
    });

    it('keeps what is not rated apart: neither easy nor above anything', () => {
        const result = read([run(0, 5, UNKNOWN_LEVEL), run(5, 10, 1)]);
        expect(result.unknown).toBe(500);
        expect(result.unknownShare).toBeCloseTo(0.5);
        expect(result.rated).toBe(500);
        expect(result.above).toBe(0);
    });

    it('adds up the runs of a level, lowest level first and the unknown last', () => {
        const result = read([run(0, 2, 3), run(2, 4, UNKNOWN_LEVEL), run(4, 8, 1), run(8, 9, 3)]);
        expect(result.byLevel).toEqual([
            { level: 1, meters: 400 },
            { level: 3, meters: 300 },
            { level: UNKNOWN_LEVEL, meters: 200 }
        ]);
    });

    it('lists the runs above the comfort level, to be looked at one by one', () => {
        const result = read([run(0, 4, 1), run(4, 6, 3), run(6, 10, 2), run(10, 12, 4)]);
        expect(result.harder).toEqual([
            { run: run(4, 6, 3), length: 200 },
            { run: run(10, 12, 4), length: 200 }
        ]);
    });

    it('has nothing to read without a profile, and nothing to say of no runs', () => {
        expect(readDifficulty({ scale: 'sac', runs: [run(0, 2, 1)] }, [], 2)).toBeNull();
        expect(read([])).toMatchObject({ total: 0, aboveShare: 0, unknownShare: 0, byLevel: [], harder: [] });
        expect(read([]).hardest).toBeUndefined();
    });

    it('leaves out a run that goes past the profile', () => {
        expect(read([run(0, 4, 1), run(18, 40, 3)]).lengths).toEqual([400]);
    });
});

describe('legendLevels', () => {
    const byLevel = [
        { level: 0, meters: 50 },
        { level: 1, meters: 900 },
        { level: 2, meters: 300 },
        { level: 3, meters: 120 },
        { level: UNKNOWN_LEVEL, meters: 500 }
    ];

    it('keeps the biggest, in the order of the levels with the unknown last', () => {
        expect(legendLevels(byLevel, 3).map(({ level }) => level)).toEqual([1, 2, UNKNOWN_LEVEL]);
    });

    it('keeps them all when there is room', () => {
        expect(legendLevels(byLevel, 8)).toHaveLength(5);
    });
});
