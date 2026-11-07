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

// what no feature owns on e-ink: black, white on a black plate. The features' own are shades of grey.
const EINK = {
    alert_fast: BLACK,
    speed_sign_rim: BLACK,
    plate: BLACK,
    plate_text: WHITE
};

/** Every key the style reads, for a theme: the generic ones and the features'. */
export function lensPalette(variant: LensPaletteVariant, contributions: LensPaletteContribution[] = []): Record<string, string> {
    return Object.assign({}, variant === 'dark' ? DARK : variant === 'eink' ? EINK : LIGHT, ...contributions.map((contribution) => contribution(variant)));
}

/** The outline of a slice: dark on a dark map, where a white one glares; black on e-ink, where the greys of the slices are the line. */
export function lensCase(variant: LensPaletteVariant) {
    return variant === 'dark' ? '#101316' : variant === 'eink' ? BLACK : WHITE;
}
