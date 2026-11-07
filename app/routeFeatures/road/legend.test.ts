import { describe, expect, it } from 'vitest';
import { lensPalette } from '~/routeFeatures/lens/lensPalette';
import { roadLegend, roadProfileLegend } from './legend';
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

    it('says the levels with two greys on e-ink, each outlined in black', () => {
        const palette = lensPalette('eink', [roadPalette]);
        const [high, medium] = roadLegend({ palette, translate, variant: 'eink' }).items;
        expect(high.lines.map((line) => line.color)).toEqual(['#000000', palette.risk_3]);
        expect(medium.lines.map((line) => line.color)).toEqual(['#000000', palette.risk_2]);
        expect(palette.risk_3).not.toBe(palette.risk_2);
    });
});

describe('roadProfileLegend', () => {
    it('lists the levels the route has, then the rest of the road', () => {
        expect(roadProfileLegend({ high: true, medium: true }, translate).map((entry) => entry.label)).toEqual(['t:road_level_high', 't:road_level_medium', 't:road_bar_rest']);
        expect(roadProfileLegend({ high: false, medium: true }, translate).map((entry) => entry.label)).toEqual(['t:road_level_medium', 't:road_bar_rest']);
        expect(roadProfileLegend({ high: false, medium: false }, translate).map((entry) => entry.label)).toEqual(['t:road_bar_rest']);
    });

    it('swatches the colours of the fill', () => {
        const [high, , rest] = roadProfileLegend({ high: true, medium: true }, translate);
        expect(high.color).toBe('#D7263D');
        expect(rest.color).toBe('#9AA3AE');
    });
});
