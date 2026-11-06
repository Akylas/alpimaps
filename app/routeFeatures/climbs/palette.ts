/** The colours of the climbs lens: a grade slice is the colour of the profile fill bucket it stands for. Pure: nothing here may import NativeScript. */
import type { LensPaletteContribution } from '~/routeFeatures/registry';
import { gradeBuckets } from '~/utils/grade';

/** The key of a grade slice: `gradeBuckets` index. */
export function gradeKey(bucket: number) {
    return 'grade_' + bucket;
}

/** The mark of a steep way up under the profile. */
export const STEEP_MARK_COLOR = '#9E1B18';

const DARK_GRADES = ['#4F7FD0', '#5C98E8', '#93C1F0', '#8CD680', '#F5DA63', '#F4A24A', '#EE6A52', '#D9453F'];

export const gradePalette: LensPaletteContribution = (variant) => Object.fromEntries(gradeBuckets.map(({ color }, bucket) => [gradeKey(bucket), variant === 'dark' ? DARK_GRADES[bucket] : color]));
