import { describe, expect, it } from 'vitest';
import { lensPalette } from '~/routeFeatures/lens/lensPalette';
import { rainPalette } from './palette';
import { weatherLegend } from './legend';

const translate = (key: string) => `t:${key}`;
const light = lensPalette('light', [rainPalette]);
const eink = lensPalette('eink', [rainPalette]);

describe('weatherLegend', () => {
    it('lists the four rain classes in the colours the map draws them, then the weather plate', () => {
        const section = weatherLegend({ palette: light, translate, variant: 'light' });
        expect(section.label).toBe('t:lens_weather');
        const lines = section.items.filter((item) => item.kind === 'line');
        expect(lines.map(({ label, lines: swatch }) => [label, swatch[0].color])).toEqual([
            ['t:legend_dry', light.rain_dry],
            ['t:legend_rain_light', light.rain_light],
            ['t:legend_rain', light.rain_steady],
            ['t:legend_rain_heavy', light.rain_heavy]
        ]);
        expect(section.items[4]).toMatchObject({ kind: 'shield', label: 't:legend_weather_plate', plate: { color: '#ffffff', border: light.rain_heavy } });
    });

    it('draws the rain as greys on e-ink, the darker the harder', () => {
        const lines = weatherLegend({ palette: eink, translate, variant: 'eink' }).items.filter((item) => item.kind === 'line');
        const greys = lines.map((item) => item.lines[1].color);
        expect(greys).toEqual([eink.rain_dry, eink.rain_light, eink.rain_steady, eink.rain_heavy]);
        expect([...greys].sort().reverse()).toEqual(greys);
    });
});
