import { describe, expect, it } from 'vitest';
import { HEADWIND_HARD_COLOR, SUN_COLOR, cloudBand, cloudTint, rainBarHeight, rainBarTint, rainColor, rainTint, skyBand, sunTint, tempColor, tint, windColor, windWash } from './colors';

describe('tempColor', () => {
    it('says only the cold and the heat: the rest is neutral', () => {
        expect(tempColor(-5)).toBeDefined();
        expect(tempColor(0)).toBeDefined();
        expect(tempColor(12)).toBeUndefined();
        expect(tempColor(24)).toBeUndefined();
        expect(tempColor(27)).toBeDefined();
        expect(tempColor(35)).not.toBe(tempColor(27));
    });

    it('is blue under freezing and warm over', () => {
        expect(tempColor(-3)).toBe('#3F8FE0');
        expect(tempColor(30)).toBe('#F29D38');
        expect(tempColor(36)).toBe('#D7263D');
    });
});

describe('rainColor', () => {
    it('is the blue of the profile, darker the harder it rains', () => {
        expect(rainColor(0)).toBeUndefined();
        expect(rainColor(0.5)).toBe('#4A90D9');
        expect(rainColor(5)).not.toBe(rainColor(0.5));
    });
});

describe('windColor', () => {
    it('is orange against the ride from 10 km/h and red from 20', () => {
        expect(windColor(12)).toBe('#F29D38');
        expect(windColor(25)).toBe('#D7263D');
    });

    it('is green with a wind of 10 km/h or more behind', () => {
        expect(windColor(-12)).toBe('#2E9E5B');
    });

    it('has none for what is not worth one', () => {
        expect(windColor(5)).toBeUndefined();
        expect(windColor(-5)).toBeUndefined();
        expect(windColor(undefined)).toBeUndefined();
    });
});

describe('tint', () => {
    it('is the colour at a share of its opacity, as the #RRGGBBAA the views read', () => {
        expect(tint('#4A90D9', 0.5)).toBe('#4A90D980');
        expect(tint('#4A90D9', 1)).toBe('#4A90D9FF');
        expect(tint('#4A90D9', 0)).toBe('#4A90D900');
    });
});

describe('cloudTint and rainTint', () => {
    const alpha = (hex: string) => parseInt(hex.slice(7), 16);

    it('wash the chip more the more there is of it, as oss-weather tints its data', () => {
        expect(alpha(cloudTint(100))).toBeGreaterThan(alpha(cloudTint(10)));
        expect(alpha(rainTint(4))).toBeGreaterThan(alpha(rainTint(0.2)));
    });

    it('never go clear, nor past the wash a figure can be read on', () => {
        expect(alpha(cloudTint(0))).toBeGreaterThan(0);
        expect(alpha(cloudTint(100))).toBeLessThanOrEqual(0x66);
        expect(alpha(rainTint(40))).toBe(alpha(rainTint(4)));
    });

    it('are the colour of the sky and of the rain', () => {
        expect(cloudTint(50).startsWith('#8D96A3')).toBe(true);
        expect(rainTint(1).startsWith('#4A90D9')).toBe(true);
    });
});

describe('windWash', () => {
    it('is red under a burst that is worth a warning, whatever the wind along the ride', () => {
        expect(windWash(0, 60, 50)).toBe(tint(HEADWIND_HARD_COLOR, 0.2));
        expect(windWash(-15, 60, 50)).toBe(tint(HEADWIND_HARD_COLOR, 0.2));
    });

    it('is the colour of a wind that is worth one, a chip a plain wind has none of', () => {
        expect(windWash(22, 30, 50)?.startsWith(windColor(22) as string)).toBe(true);
        expect(windWash(5, 30, 50)).toBeUndefined();
        expect(windWash(undefined, undefined, 50)).toBeUndefined();
    });
});

describe('the rain bar of a sample', () => {
    const alpha = (hex: string) => parseInt(hex.slice(7), 16);

    it('is plainer the less likely the rain is, and not clear', () => {
        expect(alpha(rainBarTint(90))).toBeGreaterThan(alpha(rainBarTint(30)));
        expect(alpha(rainBarTint(0))).toBeGreaterThan(0);
    });

    it('is half sure when the forecast does not say how likely', () => {
        expect(rainBarTint(undefined)).toBe(rainBarTint(55));
    });

    it('is as high as the rain, from 14 for a drizzle to 42 from 5 mm/h', () => {
        expect(rainBarHeight(0.1)).toBeGreaterThanOrEqual(14);
        expect(rainBarHeight(1)).toBeGreaterThan(rainBarHeight(0.1));
        expect(rainBarHeight(2.5)).toBeCloseTo(28, 5);
        expect(rainBarHeight(50)).toBe(42);
    });
});

describe('cloudBand', () => {
    const alpha = (hex: string) => parseInt(hex.slice(7), 16);

    it('is the grey of the cloud, the stronger the more cover, and never clear so the band reads as one across the samples', () => {
        expect(alpha(cloudBand(90))).toBeGreaterThan(alpha(cloudBand(20)));
        expect(alpha(cloudBand(0))).toBeGreaterThan(0);
        expect(cloudBand(50).startsWith('#8D96A3')).toBe(true);
    });
});

describe('sunTint and skyBand', () => {
    const alpha = (hex: string) => parseInt(hex.slice(7), 16);

    it('wash a sun chip the more the clearer the sky, in the colour of the sun', () => {
        expect(sunTint(0).startsWith(SUN_COLOR)).toBe(true);
        expect(alpha(sunTint(0))).toBeGreaterThan(alpha(sunTint(35)));
    });

    it('make the band over the samples the sun under 40 % of cloud, the grey of the cloud over it', () => {
        expect(skyBand(10).startsWith(SUN_COLOR)).toBe(true);
        expect(skyBand(39).startsWith(SUN_COLOR)).toBe(true);
        expect(skyBand(40)).toBe(cloudBand(40));
        expect(skyBand(90).startsWith('#8D96A3')).toBe(true);
        expect(alpha(skyBand(0))).toBeGreaterThan(alpha(skyBand(39)));
    });
});
