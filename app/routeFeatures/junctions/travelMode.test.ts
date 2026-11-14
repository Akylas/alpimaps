import { describe, expect, it } from 'vitest';
import { travelProfile } from './travelMode';

describe('travelProfile', () => {
    it('is the chosen mode as a routing profile', () => {
        expect(travelProfile('walk', 'bicycle', 'auto')).toBe('pedestrian');
        expect(travelProfile('bike', 'auto', 'auto')).toBe('bicycle');
        expect(travelProfile('car', 'pedestrian', 'bicycle')).toBe('auto');
    });

    it('follows the route when set to auto', () => {
        expect(travelProfile('auto', 'bicycle', 'pedestrian')).toBe('bicycle');
        expect(travelProfile('auto', 'pedestrian', 'auto')).toBe('pedestrian');
    });

    it('maps the other motor profiles to a car', () => {
        expect(travelProfile('auto', 'motorcycle', 'bicycle')).toBe('auto');
        expect(travelProfile('auto', 'truck', 'bicycle')).toBe('auto');
        expect(travelProfile('auto', 'bus', 'bicycle')).toBe('auto');
    });

    it('falls back to the default directions profile without a route', () => {
        expect(travelProfile('auto', undefined, 'bicycle')).toBe('bicycle');
        expect(travelProfile('auto', undefined, 'pedestrian')).toBe('pedestrian');
    });
});
