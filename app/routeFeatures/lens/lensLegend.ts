/** What the features' legends are built with: a swatch of a slice, the plate of a symbol. Pure: nothing here may import NativeScript. */
import type { LensLegendItem } from '~/routeFeatures/registry';

const SWATCH_WIDTH = 8;

/** The white ticks of eink/routelens.mss by severity: what says how serious a slice is where colour cannot. */
export const SEVERITY_TICKS: Record<1 | 2 | 3, number[]> = { 1: [2, 7], 2: [2, 3], 3: [6, 2] };

/** The swatch of a slice: its colour, and on e-ink the ticks of its severity. */
export function legendLine(id: string, label: string, color: string, ticks?: number[]): LensLegendItem {
    return { id, label, kind: 'line', lines: [{ color, width: SWATCH_WIDTH }, ...(ticks ? [{ color: '#ffffff', width: 1.2, dasharray: ticks }] : [])] };
}
