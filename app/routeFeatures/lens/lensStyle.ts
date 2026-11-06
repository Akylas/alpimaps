/** The style parameters the route lenses read: the palette in the inner style, the focus in the base map's. */
import { get } from 'svelte/store';
import { type LensPaletteVariant, lensCase, lensPalette } from '~/routeFeatures/lens/lensPalette';
import { routeFeatures } from '~/routeFeatures/registry';

interface StyleDecoder {
    call(method: string, ...args: unknown[]): unknown;
}

// whether the routes network is dimmed, kept to give a decoder made later its value
let routeFocus = false;

/** The palette is by inner style: e-ink is black, the rest the light one. A dark one is in `lensPalette` for the day the base map has a dark look. */
export function lensVariant(innerStyle: string): LensPaletteVariant {
    return innerStyle === 'eink' ? 'eink' : 'light';
}

/** Every colour the enabled features draw their slices and symbols in, and the generic ones. */
export function currentLensPalette(variant: LensPaletteVariant) {
    return lensPalette(
        variant,
        get(routeFeatures).flatMap((feature) => (feature.lensPalette ? [feature.lensPalette] : []))
    );
}

/** What an inner decoder needs when it is made. */
export function lensStyleParameters(innerStyle: string): Record<string, string> {
    const variant = lensVariant(innerStyle);
    return { lens_pal: JSON.stringify(currentLensPalette(variant)), lens_case: lensCase(variant) };
}

/**
 * The hiking and biking network of the base map steps back while a lens colours the route: its reds and
 * purples fight the lens'. `decoder` is the base map's.
 */
export function setRouteFocus(decoder: StyleDecoder | undefined, focused: boolean) {
    if (focused !== routeFocus) {
        routeFocus = focused;
        decoder?.call('setStyleParameter', 'route_focus', focused ? '1' : '0');
    }
}

/** A base map decoder made while the focus is on starts at its default: this gives it the value. */
export function applyRouteFocus(decoder: StyleDecoder | undefined) {
    if (routeFocus) {
        decoder?.call('setStyleParameter', 'route_focus', '1');
    }
}
