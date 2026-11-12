import { describe, expect, it } from 'vitest';
import { barGradient } from './barGradient';

describe('barGradient', () => {
    it('gives each segment the share of the bar its size is of the total', () => {
        expect(
            barGradient([
                { color: '#f00', size: 1 },
                { color: '#0f0', size: 3 }
            ])
        ).toBe('linear-gradient(to right, #f00 0.00%, #f00 25.00%, #0f0 25.00%, #0f0 100.00%)');
    });

    it('draws nothing for no segments or no size', () => {
        expect(barGradient([])).toBeNull();
        expect(barGradient([{ color: '#f00', size: 0 }])).toBeNull();
    });
});
