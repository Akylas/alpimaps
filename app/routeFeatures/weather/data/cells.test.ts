import { describe, expect, it } from 'vitest';
import type { WeatherRead } from '~/routeFeatures/weather/data/read';
import { aheadCells, windMark } from './cells';

const MINUTE = 60000;
const NOW = 1_000_000 * MINUTE;
// a vertex a minute from the one before, so the rider is at the vertex `n` in `n` minutes; the rider starts at 10
const read = {
    timeAt: (index: number) => NOW + (index - 10) * MINUTE,
    at: (index: number) => ({ temp: index, wind: 20, dir: 0, head: 5, cross: -3, code: 61, precip: 1.2, cloud: 80 }),
    rows: [
        { i0: 0, i1: 40, moon: undefined },
        { i0: 41, i1: 100, moon: 'M' }
    ]
} as unknown as Pick<WeatherRead, 'at' | 'rows' | 'timeAt'>;

describe('aheadCells', () => {
    it('reads the weather where the rider is every 20 minutes', () => {
        const cells = aheadCells(read, { fromIndex: 10, lastIndex: 100 }, NOW);
        expect(cells.map(({ at, vertex }) => [(at - NOW) / MINUTE, vertex])).toEqual([0, 20, 40, 60, 80, 100].map((minutes) => [minutes, 10 + minutes]).filter(([, vertex]) => vertex <= 100));
        expect(cells[1]).toMatchObject({ temp: 30, wind: 20, head: 5, cross: -3, code: 61, precip: 1.2, cloud: 80 });
    });
    it('stops where the route ends, it does not repeat the last place', () => {
        expect(aheadCells(read, { fromIndex: 10, lastIndex: 45 }, NOW).map(({ vertex }) => vertex)).toEqual([10, 30]);
    });
    it('takes the first vertex at or past the time', () => {
        const coarse = { ...read, timeAt: (index: number) => NOW + (index - 10) * 15 * MINUTE } as typeof read;
        expect(aheadCells(coarse, { fromIndex: 10, lastIndex: 100 }, NOW, 3).map(({ vertex }) => vertex)).toEqual([10, 12, 13]);
    });
    it('says the moon of the stretch the vertex is in', () => {
        const cells = aheadCells(read, { fromIndex: 10, lastIndex: 100 }, NOW, 4);
        expect(cells.map(({ moon }) => moon)).toEqual([undefined, undefined, 'M', 'M']);
    });
    it('is empty when the rider is past the end', () => {
        expect(aheadCells(read, { fromIndex: 101, lastIndex: 100 }, NOW)).toEqual([]);
    });
});

describe('windMark', () => {
    it('says the biggest part of the wind, and where it blows to', () => {
        expect(windMark({ head: 18, cross: 4 })).toEqual({ arrow: '↓', speed: 18 });
        expect(windMark({ head: -12, cross: 3 })).toEqual({ arrow: '↑', speed: 12 });
        expect(windMark({ head: 2, cross: 9 })).toEqual({ arrow: '←', speed: 9 });
        expect(windMark({ head: 2, cross: -9 })).toEqual({ arrow: '→', speed: 9 });
    });
    it('says nothing of a breeze', () => {
        expect(windMark({ head: 2, cross: -1 })).toBeUndefined();
        expect(windMark({})).toBeUndefined();
    });
});
