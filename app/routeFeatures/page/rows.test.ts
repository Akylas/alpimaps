import { describe, expect, it } from 'vitest';
import type { RoutePageSection } from '~/routeFeatures/registry';
import { isSectionOpen, pageRows } from './rows';

function section(id: string, rowCount: number, lens?: RoutePageSection['lens']): RoutePageSection {
    return {
        id,
        icon: 'mdi-' + id,
        title: () => id,
        summary: () => `${rowCount} rows`,
        lens,
        rows: () => Array.from({ length: rowCount }, (_, index) => ({ key: String(index), data: index })),
        component: async () => ({ default: null })
    };
}

const ctx = { item: { id: 1 } };
// a section of a lens: being that lens' does not open it
const climbs = section('climbs', 1, 'climbs');

describe('isSectionOpen', () => {
    it('keeps every section closed by default, the one of its lens too', () => {
        expect(isSectionOpen(climbs, {})).toBe(false);
        expect(isSectionOpen(climbs, {})).toBe(false);
        expect(isSectionOpen({ id: 'osm' }, {})).toBe(false);
    });

    it('keeps what the user chose over the default', () => {
        expect(isSectionOpen(climbs, { climbs: true })).toBe(true);
        expect(isSectionOpen({ id: 'osm' }, { osm: true })).toBe(true);
    });
});

describe('pageRows', () => {
    const sections = [section('climbs', 2, 'climbs'), section('stats', 1, 'surface'), section('osm', 0)];

    it('starts with the tiles and the profile, ends with the footer', () => {
        const rows = pageRows({ sections, ctx, stored: {}, hasProfile: true });
        expect(rows[0].type).toBe('tiles');
        expect(rows[1].type).toBe('profile');
        expect(rows[rows.length - 1].type).toBe('footer');
    });

    it('has no profile row without a profile', () => {
        const rows = pageRows({ sections, ctx, stored: {}, hasProfile: false });
        expect(rows.map((row) => row.type)).not.toContain('profile');
    });

    it('drops a section that has no rows', () => {
        const rows = pageRows({ sections, ctx, stored: {}, hasProfile: true });
        expect(rows.filter((row) => row.type === 'section').map((row) => row.key)).toEqual(['section:climbs', 'section:stats']);
    });

    it('lists the body of an open section under its header, and only its header when closed', () => {
        const rows = pageRows({ sections, ctx, stored: { climbs: true }, hasProfile: true });
        expect(rows.map((row) => row.key)).toEqual(['tiles', 'profile', 'section:climbs', 'climbs:0', 'climbs:1', 'section:stats', 'footer']);
        const closed = pageRows({ sections, ctx, stored: {}, hasProfile: true });
        expect(closed.map((row) => row.key)).toEqual(['tiles', 'profile', 'section:climbs', 'section:stats', 'footer']);
    });

    it('gives the header its summary and whether it is open', () => {
        const rows = pageRows({ sections, ctx, stored: { stats: true }, hasProfile: true });
        const headers = rows.filter((row) => row.type === 'section');
        expect(headers.map((row) => row.type === 'section' && [row.open, row.summary])).toEqual([
            [false, '2 rows'],
            [true, '1 rows']
        ]);
    });

    it('gives the header the facts of a section that has them', () => {
        const withFacts = { ...sections[0], facts: () => [{ icon: 'mdi-thermometer', text: '5 °C' }] };
        const header = pageRows({ sections: [withFacts], ctx, stored: {}, hasProfile: true }).find((row) => row.type === 'section');
        expect(header?.type === 'section' && header.facts).toEqual([{ icon: 'mdi-thermometer', text: '5 °C' }]);
        const plain = pageRows({ sections, ctx, stored: {}, hasProfile: true }).find((row) => row.type === 'section');
        expect(plain?.type === 'section' && plain.facts).toBeUndefined();
    });

    it('gives the header the icon a section draws for the route, the one it has when it draws none', () => {
        const drawn = { ...sections[0], iconOf: () => 'mdi-weather-rainy' };
        const header = pageRows({ sections: [drawn, sections[1]], ctx, stored: {}, hasProfile: false }).filter((row) => row.type === 'section');
        expect(header.map((row) => row.type === 'section' && row.icon)).toEqual(['mdi-weather-rainy', undefined]);
    });

    it('hands each body row to its section', () => {
        const rows = pageRows({ sections, ctx, stored: { climbs: true }, hasProfile: true });
        const body = rows.find((row) => row.key === 'climbs:1');
        expect(body).toEqual({ type: 'body', key: 'climbs:1', section: 'climbs', row: { key: '1', data: 1 }, last: true });
        expect(rows.find((row) => row.key === 'climbs:0')).toMatchObject({ last: false });
    });

    it('puts the trip strip under the tiles for a route that has a line, and not for one that has none', () => {
        const geometry = {
            type: 'LineString' as const,
            coordinates: [
                [5.7, 45.1],
                [5.71, 45.11],
                [5.72, 45.12]
            ]
        };
        const withLine = pageRows({ sections, ctx: { item: { id: 1, geometry, route: { totalTime: 600 } } }, stored: {}, hasProfile: true });
        expect(withLine.map((row) => row.type).slice(0, 3)).toEqual(['tiles', 'trip', 'profile']);
        expect(pageRows({ sections, ctx, stored: {}, hasProfile: true }).map((row) => row.type)).not.toContain('trip');
    });
});
