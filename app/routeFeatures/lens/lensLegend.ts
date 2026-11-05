/** The legend of the lens that colours the route, read off the same palette as the map. Pure: nothing here may import NativeScript. */
import type { LensPaletteVariant } from '~/routeFeatures/lens/lensPalette';
import { gradeKey, surfaceKey } from '~/routeFeatures/lens/lensPalette';
import type { LensId } from '~/routeFeatures/registry';
import { gradeBuckets } from '~/utils/grade';

// the shape `MapLegend.svelte` draws
export interface LensLegendItem {
    id: string;
    label: string;
    kind: 'line' | 'shield';
    lines?: { color: string; width: number; dasharray?: number[] }[];
    plate?: { color: string; radius?: number };
    text?: { value: string; color: string };
}

export interface LensLegendSection {
    id: 'route_lens';
    label: string;
    items: LensLegendItem[];
}

const SWATCH_WIDTH = 8;
const MINUS = '−';
// what the style draws a surface the palette has no colour for
const UNKNOWN_SURFACE = '#8D96A3';

function gradeLabel(bucket: number) {
    const from = gradeBuckets[bucket].from;
    const to = gradeBuckets[bucket + 1]?.from;
    const signed = (value: number) => (value < 0 ? MINUS + Math.abs(value) : String(value));
    if (to === undefined) {
        return `≥ ${signed(from)} %`;
    }
    return from === -Infinity ? `< ${signed(to)} %` : `${signed(from)} – ${signed(to)} %`;
}

// the white ticks of eink/routelens.mss, by severity
const TICKS: Record<'steep' | 'verySteep', number[]> = { steep: [2, 3], verySteep: [6, 2] };

/**
 * What the lens' slices mean. `translate` words a key, `surfaces` are the surfaces of the selected route:
 * a lens that draws nothing the legend could explain gives `null`.
 */
export function lensLegend(lens: LensId, variant: LensPaletteVariant, palette: Record<string, string>, translate: (key: string) => string, surfaces: string[]): LensLegendSection | null {
    const line = (id: string, label: string, color: string, ticks?: number[]): LensLegendItem => ({
        id,
        label,
        kind: 'line',
        lines: [{ color, width: SWATCH_WIDTH }, ...(ticks ? [{ color: '#ffffff', width: 1.2, dasharray: ticks }] : [])]
    });
    if (lens === 'climbs') {
        const plate: LensLegendItem = {
            id: 'climb',
            label: translate('legend_climb_plate'),
            kind: 'shield',
            plate: { color: palette.plate, radius: 4 },
            text: { value: '1', color: palette.plate_text }
        };
        // on e-ink every colour is black: the ticks say how steep
        const items =
            variant === 'eink'
                ? [
                      line('not_steep', translate('legend_not_steep'), palette.g3),
                      line('steep', translate('legend_steep'), palette.g6, TICKS.steep),
                      line('very_steep', translate('legend_very_steep'), palette.g7, TICKS.verySteep)
                  ]
                : gradeBuckets.map((_, bucket) => line(gradeKey(bucket), gradeLabel(bucket), palette[gradeKey(bucket)]));
        return { id: 'route_lens', label: translate('lens_climbs'), items: [...items, plate] };
    }
    if (lens === 'surface' && surfaces.length) {
        return { id: 'route_lens', label: translate('lens_surface'), items: surfaces.map((id) => line(surfaceKey(id), translate(id), palette[surfaceKey(id)] ?? UNKNOWN_SURFACE)) };
    }
    return null;
}
