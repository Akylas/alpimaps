import { describe, expect, it } from 'vitest';
import { lensPalette } from '~/routeFeatures/lens/lensPalette';
import { gradePalette } from './palette';
import { climbsLegend } from './legend';

const translate = (key: string) => `t:${key}`;
const light = lensPalette('light', [gradePalette]);
const eink = lensPalette('eink', [gradePalette]);

describe('climbsLegend', () => {
    it('lists the eight grade buckets in the profile colours, then the climb plate', () => {
        const section = climbsLegend({ palette: light, translate, variant: 'light' });
        expect(section.id).toBe('route_lens');
        expect(section.label).toBe('t:lens_climbs');
        const lines = section.items.filter((item) => item.kind === 'line');
        expect(lines.map((item) => item.lines[0].color)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((bucket) => light['grade_' + bucket]));
        expect(lines[0].label).toBe('< −9 %');
        expect(lines[4].label).toBe('3 – 6 %');
        expect(lines[7].label).toBe('≥ 12 %');
        expect(section.items[8]).toMatchObject({ kind: 'shield', label: 't:legend_climb_plate' });
    });

    it('draws the severity as ticks on e-ink, where the colours are all black', () => {
        const lines = climbsLegend({ palette: eink, translate, variant: 'eink' }).items.filter((item) => item.kind === 'line');
        expect(lines.map((item) => item.label)).toEqual(['t:legend_not_steep', 't:legend_steep', 't:legend_very_steep']);
        // the ticks, from none to nearly solid: the dashes of eink/routelens.mss
        expect(lines.map((item) => item.lines[1]?.dasharray)).toEqual([undefined, [2, 3], [6, 2]]);
        expect(lines[1].lines[0].color).toBe('#000000');
    });
});
