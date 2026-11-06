/** The colours of the lens slices and symbols, as the style's `lens_pal` table: the features' own, and what no feature owns. Pure: nothing here may import NativeScript. */
import type { LensPaletteContribution, LensPaletteVariant } from '~/routeFeatures/registry';

export type { LensPaletteContribution, LensPaletteVariant };

// what belongs to no feature: the alerts of a followed route and the plates of its symbols
const LIGHT = {
    alert_fast: '#D7263D',
    speed_sign_rim: '#D7263D',
    plate: '#2B2F33',
    // the text on a plate
    plate_text: '#ffffff'
};

// every step lifted: the light ones read as a hole on a dark map
const DARK = {
    alert_fast: '#EF4A5E',
    speed_sign_rim: '#EF4A5E',
    plate: '#E8EAED',
    plate_text: '#1B1C1D'
};

const BLACK = '#000000';
const WHITE = '#ffffff';

/** Every key the style reads, for a theme: the generic ones and the features'. */
export function lensPalette(variant: LensPaletteVariant, contributions: LensPaletteContribution[] = []): Record<string, string> {
    const palette = Object.assign({}, variant === 'dark' ? DARK : LIGHT, ...contributions.map((contribution) => contribution(variant)));
    // nothing can be told apart by colour on e-ink: the style separates slices by ticks. White on a black plate.
    return variant === 'eink' ? Object.fromEntries(Object.keys(palette).map((key) => [key, key === 'plate_text' ? WHITE : BLACK])) : palette;
}

/** The outline of a slice: dark on a dark map, where a white one glares. */
export function lensCase(variant: LensPaletteVariant) {
    return variant === 'dark' ? '#101316' : '#ffffff';
}
