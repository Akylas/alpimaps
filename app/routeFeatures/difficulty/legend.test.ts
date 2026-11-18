import { describe, expect, it } from 'vitest';
import { difficultyLegend, difficultyProfileLegend } from './legend';
import { difficultyPalette } from './palette';
import { UNKNOWN_LEVEL } from './scale';

const translate = (key: string) => `<${key}>`;
const palette = difficultyPalette('light');

describe('difficultyLegend', () => {
    it('lists the levels of the route, the hardest first and what is not rated last, in the colours of the map', () => {
        const legend = difficultyLegend({ levels: [1, UNKNOWN_LEVEL, 3, 1], palette, scale: 'sac', translate });
        expect(legend.label).toBe('<lens_difficulty>');
        expect(legend.items.map(({ label }) => label)).toEqual(['T3 · <difficulty_sac_3>', 'T1 · <difficulty_sac_1>', '<difficulty_unknown>']);
        expect(legend.items[0].lines[0].color).toBe(palette.difficulty_3);
    });

    it('has the outline of a grey on e-ink', () => {
        const legend = difficultyLegend({ levels: [2], palette: difficultyPalette('eink'), scale: 'mtb', translate, variant: 'eink' });
        expect(legend.items[0].lines).toHaveLength(2);
    });

    it('has none for a route with no levels', () => {
        expect(difficultyLegend({ levels: [], palette, scale: 'sac', translate })).toBeNull();
    });
});

describe('difficultyProfileLegend', () => {
    it('gives each level its distance, in the colour of the fill and its grey for e-ink', () => {
        const entries = difficultyProfileLegend(
            [
                { level: 2, meters: 1500 },
                { level: UNKNOWN_LEVEL, meters: 400 }
            ],
            'mtb',
            translate,
            (meters) => `${meters / 1000} km`
        );
        expect(entries.map(({ label }) => label)).toEqual(['S2 · 1.5 km', '<difficulty_unknown> · 0.4 km']);
        expect(entries[0].color).toBe(palette.difficulty_2);
        expect(entries[0].eink).toMatch(/^#[0-9a-f]{6}$/);
    });
});
