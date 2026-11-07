import { describe, expect, it } from 'vitest';
import { lensPalette } from '~/routeFeatures/lens/lensPalette';
import { sunLegend } from '~/routeFeatures/sun/legend';
import { sunPalette } from '~/routeFeatures/sun/palette';
import { SUN_PALETTE_KEYS } from '~/routeFeatures/sun/read';

const translate = (key: string) => `t:${key}`;
const light = lensPalette('light', [sunPalette]);
const eink = lensPalette('eink', [sunPalette]);

describe('sunPalette', () => {
    it('has a colour for every class, in every variant', () => {
        (['light', 'dark', 'eink'] as const).forEach((variant) => {
            const palette = lensPalette(variant, [sunPalette]);
            Object.values(SUN_PALETTE_KEYS).forEach((key) => expect(palette[key]).toMatch(/^#[0-9a-f]{6}$/i));
        });
    });
});

describe('sunLegend', () => {
    it('lists the classes in the colours the map draws them', () => {
        const section = sunLegend({ palette: light, translate, variant: 'light' });
        expect(section.label).toBe('t:lens_sun');
        expect(section.items.map(({ label, lines }) => [label, lines[0].color])).toEqual([
            ['t:legend_sun_day', light.sun_day],
            ['t:legend_sun_overcast', light.sun_overcast],
            ['t:legend_sun_low', light.sun_low],
            ['t:legend_sun_glare', light.sun_glare],
            ['t:legend_sun_twilight', light.sun_twilight],
            ['t:legend_sun_moonlit', light.sun_moonlit],
            ['t:legend_sun_night', light.sun_night]
        ]);
    });

    it('draws the classes as greys on e-ink, the darker the less light', () => {
        const greys = sunLegend({ palette: eink, translate, variant: 'eink' }).items.map((item) => item.lines[1].color);
        expect(greys).toEqual([eink.sun_day, eink.sun_overcast, eink.sun_low, eink.sun_glare, eink.sun_twilight, eink.sun_moonlit, eink.sun_night]);
        expect([...greys].sort().reverse()).toEqual(greys);
    });
});
