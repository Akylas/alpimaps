import { describe, expect, it } from 'vitest';
import { clearSkyDni, clearness, shadowStrengthFor } from '~/utils/astronomy/clearSky';

describe('clearSkyDni', () => {
    it('is 947 W/m2 for a sun overhead at sea level', () => {
        expect(clearSkyDni(90, 0)).toBeCloseTo(947.1, 0);
    });

    it('is weaker as the sun gets low, through more air', () => {
        expect(clearSkyDni(10, 0)).toBeLessThan(clearSkyDni(30, 0));
    });

    it('is stronger up a mountain', () => {
        expect(clearSkyDni(30, 3000)).toBeGreaterThan(clearSkyDni(30, 0));
    });
});

describe('clearness', () => {
    it('is the irradiance against the clear sky', () => {
        const clear = clearSkyDni(40, 500);
        expect(clearness({ altitude: 40, elevation: 500, dni: clear / 2 })).toBeCloseTo(0.5, 5);
    });

    it('is 0 under a sky that lets no direct light through', () => {
        expect(clearness({ altitude: 40, elevation: 500, dni: 0, cloud: 20 })).toBe(0);
    });

    it('stays at 1 when the forecast says more than the model', () => {
        expect(clearness({ altitude: 40, elevation: 500, dni: 5000 })).toBe(1);
    });

    it('falls back on the cloud cover when the sun is too low for the model', () => {
        expect(clearness({ altitude: 3, elevation: 0, dni: 10, cloud: 75 })).toBeCloseTo(0.25, 5);
    });

    it('falls back on the cloud cover when there is no irradiance', () => {
        expect(clearness({ altitude: 40, elevation: 0, cloud: 100 })).toBe(0);
    });

    it('says nothing when the forecast does not', () => {
        expect(clearness({ altitude: 40, elevation: 0 })).toBeUndefined();
        expect(clearness({ altitude: 2, elevation: 0, dni: 100 })).toBeUndefined();
    });
});

describe('shadowStrengthFor', () => {
    it('is the strength of the user under a clear sky, and under a forecast that says nothing', () => {
        expect(shadowStrengthFor(0.6, 1)).toBeCloseTo(0.6, 5);
        expect(shadowStrengthFor(0.6, undefined)).toBe(0.6);
    });

    it('is as weak as the sun that gets through', () => {
        expect(shadowStrengthFor(0.6, 0.5)).toBeCloseTo(0.3, 5);
    });

    it('is none when the sun hardly gets through, which spares the shadow pass', () => {
        expect(shadowStrengthFor(0.6, 0.07)).toBe(0);
        expect(shadowStrengthFor(0.6, 0.09)).toBeGreaterThan(0);
    });
});
