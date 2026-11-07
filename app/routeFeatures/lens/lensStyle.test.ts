import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerRouteFeature } from '~/routeFeatures/registry';
import { get } from 'svelte/store';
import { applyRouteFocus, lensStyleParameters, lensVariantStore, setLensVariant, setRouteFocus } from './lensStyle';

// a feature of its own colours: the style knows none of its features
registerRouteFeature({ id: 'palette-test', order: 1, lensPalette: (variant) => ({ test_swatch: variant === 'eink' ? '#969696' : '#7BC96F' }) });

describe('lensStyleParameters', () => {
    it('writes the palette as the JSON the style reads, with the colours of the features in it', () => {
        const parameters = lensStyleParameters('voyager');
        const palette = JSON.parse(parameters.lens_pal);
        expect(palette.test_swatch).toBe('#7BC96F');
        expect(palette.plate).toBe('#2B2F33');
        expect(parameters.lens_case).toBe('#ffffff');
    });

    it('is the features greys, outlined in black, on the e-ink inner style', () => {
        const parameters = lensStyleParameters('eink');
        const palette = JSON.parse(parameters.lens_pal);
        expect(palette.test_swatch).toBe('#969696');
        expect(palette.plate).toBe('#000000');
        expect(parameters.lens_case).toBe('#000000');
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

describe('setLensVariant', () => {
    it('follows the inner style, so what draws the lenses is drawn again when the style changes', () => {
        const seen: string[] = [];
        const unsubscribe = lensVariantStore.subscribe((variant) => seen.push(variant));
        setLensVariant('eink');
        setLensVariant('eink');
        setLensVariant('voyager');
        unsubscribe();
        expect(seen.slice(-2)).toEqual(['eink', 'light']);
        expect(seen.filter((variant) => variant === 'eink')).toHaveLength(1);
        expect(get(lensVariantStore)).toBe('light');
    });
});
