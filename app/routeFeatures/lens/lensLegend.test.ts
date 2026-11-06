import { describe, expect, it } from 'vitest';
import { SEVERITY_TICKS, legendLine } from './lensLegend';

describe('legendLine', () => {
    it('is a swatch of the colour', () => {
        expect(legendLine('dry', 'dry', '#8D96A3')).toEqual({ id: 'dry', label: 'dry', kind: 'line', lines: [{ color: '#8D96A3', width: 8 }] });
    });

    it('adds the ticks that say how serious it is where colour cannot', () => {
        const [swatch, ticks] = legendLine('heavy', 'heavy', '#000000', SEVERITY_TICKS[3]).lines;
        expect(swatch.color).toBe('#000000');
        expect(ticks).toEqual({ color: '#ffffff', width: 1.2, dasharray: [6, 2] });
    });

    it('has ticks from sparse to nearly solid', () => {
        expect(SEVERITY_TICKS).toEqual({ 1: [2, 7], 2: [2, 3], 3: [6, 2] });
    });
});
