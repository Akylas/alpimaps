import { describe, expect, it } from 'vitest';
import { surfaceLegend } from './legend';

const translate = (key: string) => `t:${key}`;
const palette = { surface_paved: '#D7D7D7', surface_gravel: '#A89070' };

describe('surfaceLegend', () => {
    it('says nothing on a route without surfaces', () => {
        expect(surfaceLegend({ palette, surfaces: [], translate })).toBeNull();
    });

    it('draws a surface the palette does not know in the colour the map does', () => {
        expect(surfaceLegend({ palette, surfaces: ['lava'], translate })?.items[0].lines[0].color).toBe('#8D96A3');
    });

    it('lists the surfaces of the route, in the colour the map draws them', () => {
        const section = surfaceLegend({ palette, surfaces: ['gravel', 'paved'], translate });
        expect(section.label).toBe('t:lens_surface');
        expect(section.items.map(({ label, lines }) => [label, lines[0].color])).toEqual([
            ['t:gravel', '#A89070'],
            ['t:paved', '#D7D7D7']
        ]);
    });
});
