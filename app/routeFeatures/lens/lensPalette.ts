/** The colours of the lens slices and plates, as the style's `lens_pal` table. Pure: nothing here may import NativeScript. */
import { gradeBuckets } from '~/utils/grade';

export type LensPaletteVariant = 'light' | 'dark' | 'eink';

/** The key of a grade slice: `gradeBuckets` index. */
export function gradeKey(bucket: number) {
    return 'g' + bucket;
}

/** The key of a surface slice. */
export function surfaceKey(id: string) {
    return 'f_' + id;
}

// r: road risk, w: rain, s: sun and shade
const LIGHT = {
    r0: '#8D96A3',
    r2: '#F29D38',
    r3: '#D7263D',
    w0: '#8D96A3',
    w1: '#B39DDB',
    w2: '#7E57C2',
    w3: '#4527A0',
    s0: '#7C93B0',
    s1: '#F5B82E',
    s2: '#B0B7BF',
    s3: '#243049',
    sign: '#D7263D',
    plate: '#2B2F33'
};

// every step lifted: the light ones read as a hole on a dark map
const DARK = {
    r0: '#5C6570',
    r2: '#F4AE57',
    r3: '#EF4A5E',
    w0: '#5C6570',
    w1: '#C4B3E6',
    w2: '#9C7BE0',
    w3: '#7C5CD6',
    s0: '#7F98B8',
    s1: '#F7C64F',
    s2: '#8E969F',
    s3: '#8FA3D9',
    sign: '#EF4A5E',
    plate: '#E8EAED'
};

const DARK_GRADES = ['#4F7FD0', '#5C98E8', '#93C1F0', '#8CD680', '#F5DA63', '#F4A24A', '#EE6A52', '#D9453F'];

const BLACK = '#000000';

/**
 * Every key the style reads, for a theme. `surfaceColors` is the app's surface table, one `f_<id>` per
 * surface: it lives in a module that imports NativeScript, so the caller hands it over.
 */
export function lensPalette(variant: LensPaletteVariant, surfaceColors: Record<string, string>): Record<string, string> {
    const grades = gradeBuckets.map(({ color }, bucket) => [gradeKey(bucket), variant === 'dark' ? DARK_GRADES[bucket] : color]);
    const surfaces = Object.entries(surfaceColors).map(([id, color]) => [surfaceKey(id), color]);
    const palette = Object.fromEntries([...grades, ...Object.entries(variant === 'dark' ? DARK : LIGHT), ...surfaces]);
    // nothing can be told apart by colour on e-ink: the style separates slices by ticks
    return variant === 'eink' ? Object.fromEntries(Object.keys(palette).map((key) => [key, BLACK])) : palette;
}

/** The outline of a slice: dark on a dark map, where a white one glares. */
export function lensCase(variant: LensPaletteVariant) {
    return variant === 'dark' ? '#101316' : '#ffffff';
}
