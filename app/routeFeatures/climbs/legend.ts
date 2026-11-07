/** What the colours and the plate of the climbs lens mean. Pure: nothing here may import NativeScript. */
import { legendLine } from '~/routeFeatures/lens/lensLegend';
import { gradeKey } from '~/routeFeatures/climbs/palette';
import type { LensLegendContext, LensLegendSection } from '~/routeFeatures/registry';
import { gradeBuckets } from '~/utils/grade';

const MINUS = '−';

function gradeLabel(bucket: number) {
    const from = gradeBuckets[bucket].from;
    const to = gradeBuckets[bucket + 1]?.from;
    const signed = (value: number) => (value < 0 ? MINUS + Math.abs(value) : String(value));
    if (to === undefined) {
        return `≥ ${signed(from)} %`;
    }
    return from === -Infinity ? `< ${signed(to)} %` : `${signed(from)} – ${signed(to)} %`;
}

/** The eight grade buckets in the profile colours, then the plate of a climb's category; on e-ink three steps, said by ticks. */
export function climbsLegend({ palette, translate, variant }: Pick<LensLegendContext, 'palette' | 'translate' | 'variant'>): LensLegendSection {
    const plate = {
        id: 'climb',
        label: translate('legend_climb_plate'),
        kind: 'shield' as const,
        plate: { color: palette.plate, radius: 4 },
        text: { value: '1', color: palette.plate_text }
    };
    // on e-ink the greys of the eight steps look alike: three, each a darker one
    const items =
        variant === 'eink'
            ? [
                  legendLine('not_steep', translate('legend_not_steep'), palette[gradeKey(3)], variant),
                  legendLine('steep', translate('legend_steep'), palette[gradeKey(6)], variant),
                  legendLine('very_steep', translate('legend_very_steep'), palette[gradeKey(7)], variant)
              ]
            : gradeBuckets.map((_, bucket) => legendLine(gradeKey(bucket), gradeLabel(bucket), palette[gradeKey(bucket)]));
    return { id: 'route_lens', label: translate('lens_climbs'), items: [...items, plate] };
}
