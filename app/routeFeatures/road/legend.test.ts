import { describe, expect, it } from 'vitest';
import { lensPalette } from '~/routeFeatures/lens/lensPalette';
import { roadLegend } from './legend';
import { roadPalette } from './palette';

const translate = (key: string) => `t:${key}`;

describe('roadLegend', () => {
    it('lists the red and the amber run in their colours, then the speed sign with its rim', () => {
        const palette = lensPalette('light', [roadPalette]);
        const section = roadLegend({ palette, translate, variant: 'light' });
        expect(section.label).toBe('t:lens_road');
        expect(section.items.map((item) => item.id)).toEqual(['risk_3', 'risk_2', 'speed_sign']);
        expect(section.items[0].lines[0].color).toBe(palette.risk_3);
        expect(section.items[1].lines[0].color).toBe(palette.risk_2);
        expect(section.items[2]).toMatchObject({ kind: 'shield', plate: { border: palette.speed_sign_rim } });
    });

    it('says the levels with ticks on e-ink, where the colours are all black', () => {
        const palette = lensPalette('eink', [roadPalette]);
        const [high, medium] = roadLegend({ palette, translate, variant: 'eink' }).items;
        expect(high.lines.map((line) => line.dasharray)).toEqual([undefined, [6, 2]]);
        expect(medium.lines.map((line) => line.dasharray)).toEqual([undefined, [2, 3]]);
        expect(high.lines[0].color).toBe('#000000');
    });
});
