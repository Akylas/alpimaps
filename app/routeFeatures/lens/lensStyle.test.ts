import { beforeEach, describe, expect, it, vi } from 'vitest';

// the surface table lives in a module that imports NativeScript
vi.mock('~/utils/routing', () => ({ surfaceColors: { paved: '#D7D7D7' } }));

import { applyRouteFocus, lensStyleParameters, setRouteFocus } from './lensStyle';

describe('lensStyleParameters', () => {
    it('writes the palette as the JSON the style reads, with the surface colours in it', () => {
        const parameters = lensStyleParameters('voyager');
        const palette = JSON.parse(parameters.lens_pal);
        expect(palette.g3).toBe('#7BC96F');
        expect(palette.f_paved).toBe('#D7D7D7');
        expect(parameters.lens_case).toBe('#ffffff');
    });

    it('is black on the e-ink inner style', () => {
        const palette = JSON.parse(lensStyleParameters('eink').lens_pal);
        expect(palette.g3).toBe('#000000');
        expect(palette.f_paved).toBe('#000000');
    });
});

describe('setRouteFocus', () => {
    const decoder = { call: vi.fn() };

    beforeEach(() => {
        setRouteFocus(decoder, false);
        decoder.call.mockClear();
    });

    it('tells the decoder when the focus changes, once', () => {
        setRouteFocus(decoder, true);
        setRouteFocus(decoder, true);
        expect(decoder.call).toHaveBeenCalledTimes(1);
        expect(decoder.call).toHaveBeenCalledWith('setStyleParameter', 'route_focus', '1');
        setRouteFocus(decoder, false);
        expect(decoder.call).toHaveBeenLastCalledWith('setStyleParameter', 'route_focus', '0');
    });

    it('gives a decoder made while the focus is on the value it is at', () => {
        setRouteFocus(decoder, true);
        const made = { call: vi.fn() };
        applyRouteFocus(made);
        expect(made.call).toHaveBeenCalledWith('setStyleParameter', 'route_focus', '1');
    });

    it('leaves a decoder made while it is off at its default', () => {
        const made = { call: vi.fn() };
        applyRouteFocus(made);
        expect(made.call).not.toHaveBeenCalled();
    });
});
