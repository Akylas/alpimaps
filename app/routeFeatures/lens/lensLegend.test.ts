import { describe, expect, it } from 'vitest';
import { lensPalette } from './lensPalette';
import { lensLegend } from './lensLegend';

const translate = (key: string) => `t:${key}`;
const surfaceColors = { paved: '#D7D7D7', gravel: '#A89070' };
const light = lensPalette('light', surfaceColors);
const eink = lensPalette('eink', surfaceColors);

describe('lensLegend', () => {
    it('says nothing of a lens that colours nothing', () => {
        expect(lensLegend('overview', 'light', light, translate, [])).toBeNull();
        expect(lensLegend('road', 'light', light, translate, [])).toBeNull();
    });

    it('lists the eight grade buckets of the climbs lens in the profile colours, then the climb plate', () => {
        const section = lensLegend('climbs', 'light', light, translate, []);
        expect(section.id).toBe('route_lens');
        expect(section.label).toBe('t:lens_climbs');
        const lines = section.items.filter((item) => item.kind === 'line');
        expect(lines.map((item) => item.lines[0].color)).toEqual([light.g0, light.g1, light.g2, light.g3, light.g4, light.g5, light.g6, light.g7]);
        expect(lines[0].label).toBe('< −9 %');
        expect(lines[4].label).toBe('3 – 6 %');
        expect(lines[7].label).toBe('≥ 12 %');
        expect(section.items[8]).toMatchObject({ kind: 'shield', label: 't:legend_climb_plate' });
    });

    it('draws the severity of the climbs lens as ticks on e-ink, where the colours are all black', () => {
        const section = lensLegend('climbs', 'eink', eink, translate, []);
        const lines = section.items.filter((item) => item.kind === 'line');
        expect(lines.map((item) => item.label)).toEqual(['t:legend_not_steep', 't:legend_steep', 't:legend_very_steep']);
        // the ticks, from none to nearly solid: the dashes of eink/routelens.mss
        expect(lines.map((item) => item.lines[1]?.dasharray)).toEqual([undefined, [2, 3], [6, 2]]);
        expect(lines[1].lines[0].color).toBe('#000000');
    });

    it('says nothing of the surface lens on a route without surfaces', () => {
        expect(lensLegend('surface', 'light', light, translate, [])).toBeNull();
    });

    it('draws a surface the palette does not know in the colour the map does', () => {
        const section = lensLegend('surface', 'light', light, translate, ['lava']);
        expect(section.items[0].lines[0].color).toBe('#8D96A3');
    });

    it('lists the surfaces of the route, in the colour the map draws them', () => {
        const section = lensLegend('surface', 'light', light, translate, ['gravel', 'paved']);
        expect(section.items.map(({ label, lines }) => [label, lines[0].color])).toEqual([
            ['t:gravel', '#A89070'],
            ['t:paved', '#D7D7D7']
        ]);
    });
});
