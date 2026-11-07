import { describe, expect, it } from 'vitest';
import { shadeGrey } from './shades';

describe('shadeGrey', () => {
    it('is the grey a shade of black looks like on white', () => {
        expect(shadeGrey(0)).toBe('#ffffff');
        expect(shadeGrey(255)).toBe('#000000');
        expect(shadeGrey(105)).toBe('#969696');
    });

    it('stays inside the greys', () => {
        expect(shadeGrey(-20)).toBe('#ffffff');
        expect(shadeGrey(400)).toBe('#000000');
    });
});
