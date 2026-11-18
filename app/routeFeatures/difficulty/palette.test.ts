import { describe, expect, it } from 'vitest';
import { DIFFICULTY_COLORS, DIFFICULTY_UNKNOWN_COLOR, difficultyKey, difficultyPalette, difficultyShade } from './palette';
import { UNKNOWN_LEVEL } from './scale';

describe('difficultyPalette', () => {
    it('has a colour for each level of both scales, and one for what is not rated', () => {
        const palette = difficultyPalette('light');
        expect(Object.keys(palette).sort()).toEqual(['difficulty_0', 'difficulty_1', 'difficulty_2', 'difficulty_3', 'difficulty_4', 'difficulty_5', 'difficulty_6', 'difficulty_unknown']);
        expect(palette[difficultyKey(UNKNOWN_LEVEL)]).toBe(DIFFICULTY_UNKNOWN_COLOR);
    });

    it('tells every level apart, the unknown too', () => {
        expect(new Set([...DIFFICULTY_COLORS, DIFFICULTY_UNKNOWN_COLOR]).size).toBe(8);
    });

    it('is greys on e-ink, darker the harder, and the lightest for what is not rated', () => {
        const palette = difficultyPalette('eink');
        const lightness = (level: number) => parseInt(palette[difficultyKey(level)].slice(1, 3), 16);
        const greys = [0, 1, 2, 3, 4, 5, 6].map(lightness);
        expect(greys).toEqual([...greys].sort((first, second) => second - first));
        expect(new Set(greys).size).toBe(7);
        expect(lightness(UNKNOWN_LEVEL)).toBeGreaterThan(greys[0]);
        expect(palette[difficultyKey(3)]).toMatch(/^#([0-9a-f]{2})\1\1$/);
    });

    it('has a shade for each level', () => {
        expect(difficultyShade(0)).toBeLessThan(difficultyShade(6));
        expect(difficultyShade(UNKNOWN_LEVEL)).toBeLessThan(difficultyShade(0));
    });
});
