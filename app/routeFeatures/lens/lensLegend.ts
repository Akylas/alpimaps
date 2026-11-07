/** What the features' legends are built with: a swatch of a slice, the plate of a symbol. Pure: nothing here may import NativeScript. */
import type { LensLegendItem, LensPaletteVariant } from '~/routeFeatures/registry';

const SWATCH_WIDTH = 8;
const OUTLINE_WIDTH = 2;

/** The swatch of a slice: its colour; on e-ink, where it is a grey as the map's line is, in the black outline that line has. */
export function legendLine(id: string, label: string, color: string, variant?: LensPaletteVariant): LensLegendItem {
    return {
        id,
        label,
        kind: 'line',
        lines:
            variant === 'eink'
                ? [
                      { color: '#000000', width: SWATCH_WIDTH + OUTLINE_WIDTH },
                      { color, width: SWATCH_WIDTH }
                  ]
                : [{ color, width: SWATCH_WIDTH }]
    };
}
