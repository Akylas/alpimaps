import { describe, expect, it } from 'vitest';
import { legendLine } from './lensLegend';

describe('legendLine', () => {
    it('is a swatch of the colour', () => {
        expect(legendLine('dry', 'dry', '#8D96A3')).toEqual({ id: 'dry', label: 'dry', kind: 'line', lines: [{ color: '#8D96A3', width: 8 }] });
    });

    it('is outlined in black on e-ink, where the grey of a light slice would vanish', () => {
        const { lines } = legendLine('dry', 'dry', '#e1e1e1', 'eink');
        expect(lines).toEqual([
            { color: '#000000', width: 10 },
            { color: '#e1e1e1', width: 8 }
        ]);
    });
});
