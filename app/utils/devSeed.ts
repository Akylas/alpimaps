// DEV ONLY: fills the items database with a lot of data to test loading, the items list and the groups.
// Triggered from Settings (DEV_LOG builds only). Everything it creates is marked `seed: true` and removed by clearSeedData.
import { get } from 'svelte/store';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import type ItemsModule from '~/mapModules/ItemsModule';
import { fonts } from '~/variables';

declare const MATERIAL_MAP_FONT_FAMILY: string;

const CENTER = { lon: 5.7245, lat: 45.1885 }; // Grenoble
const SEED_GROUP_PREFIX = 'seed-';

export interface SeedOptions {
    /** number of markers, spread over `groups` groups */
    markers?: number;
    groups?: number;
    /** number of points of the very long route */
    routePoints?: number;
    /** number of points of the elevation profile (the app charts a reduced profile) */
    profilePoints?: number;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** small deterministic generator: the same seed gives the same data */
function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function markerProperties(i: number, mdi: string, group: string) {
    return {
        name: `Seed marker ${i}`,
        seed: true,
        class: 'place',
        style: { fontFamily: mdi, mapFontFamily: MATERIAL_MAP_FONT_FAMILY, icon: 'mdi-map-marker' },
        address: { city: 'Grenoble', street: `Rue du test ${i}`, country: 'France' },
        categories: [group, 'seed'],
        description: 'x'.repeat(200)
    };
}

/** A route that walks a wide spiral with small wiggles, ~ every 4 m, with elevation. */
function buildRoute(points: number, profilePoints: number) {
    const rand = rng(42);
    const coordinates: number[][] = new Array(points);
    let lon = CENTER.lon;
    let lat = CENTER.lat;
    let heading = 0;
    let dist = 0;
    const stepDeg = 0.00004; // ~4.4 m
    const elevations: number[] = new Array(points);
    for (let i = 0; i < points; i++) {
        heading += 0.002 + (rand() - 0.5) * 0.05;
        lon += Math.cos(heading) * stepDeg * 1.4;
        lat += Math.sin(heading) * stepDeg;
        const ele = 300 + 150 * Math.sin(i / 900) + 40 * Math.sin(i / 97) + rand() * 2;
        elevations[i] = ele;
        coordinates[i] = [+lon.toFixed(6), +lat.toFixed(6), +ele.toFixed(1)];
        dist += 4.4;
    }
    const step = Math.max(1, Math.floor(points / profilePoints));
    const data: { d: number; a: number; g?: number }[] = [];
    let min = Infinity;
    let max = -Infinity;
    let dplus = 0;
    let dmin = 0;
    for (let i = 0; i < points; i += step) {
        const a = +elevations[i].toFixed(1);
        if (data.length) {
            const diff = a - data[data.length - 1].a;
            diff > 0 ? (dplus += diff) : (dmin -= diff);
        }
        min = Math.min(min, a);
        max = Math.max(max, a);
        data.push({ d: Math.round(i * 4.4), a, g: 0 });
    }
    const totalDistance = Math.round(dist);
    const totalTime = Math.round(dist / 1.3);
    return {
        geometry: { type: 'LineString', coordinates },
        route: { type: 'pedestrian', totalDistance, totalTime },
        profile: { max: [data.length, max], min: [0, min], dplus: Math.round(dplus), dmin: Math.round(dmin), data, ascents: [] },
        stats: {
            waytypes: [{ perc: 100, dist: totalDistance, id: 'path' }],
            surfaces: [{ perc: 100, dist: totalDistance, id: 'unknown' }]
        },
        bounds: { southwest: { lat: CENTER.lat - 0.05, lon: CENTER.lon - 0.05 }, northeast: { lat: CENTER.lat + 0.05, lon: CENTER.lon + 0.05 } }
    };
}

export async function seedTestData(itemsModule: ItemsModule, options: SeedOptions = {}) {
    const { markers = 1000, groups = 5, routePoints = 200000, profilePoints = 4000 } = options;
    const { mdi } = get(fonts);
    const db = itemsModule.db.db;
    const timings: Record<string, number> = {};
    const log = (...args) => console.log('[seed]', ...args);

    let t0 = now();
    await clearSeedData(itemsModule);
    timings.clear = now() - t0;

    // --- markers, groups: one atomic batch
    t0 = now();
    const rand = rng(7);
    const base = Date.now();
    const statements: Array<[string, any[]]> = [];
    const groupNames: string[] = [];
    for (let g = 0; g < groups; g++) {
        const name = `${SEED_GROUP_PREFIX}${g + 1}`;
        groupNames.push(name);
        statements.push(['INSERT OR REPLACE INTO Groups (id, name, onMap, collapse) VALUES (?, ?, 1, 0)', [name, name]]);
    }
    for (let i = 0; i < markers; i++) {
        const id = base + i;
        const group = groupNames[i % groups];
        const geometry = { type: 'Point', coordinates: [+(CENTER.lon + (rand() - 0.5) * 0.3).toFixed(6), +(CENTER.lat + (rand() - 0.5) * 0.2).toFixed(6)] };
        statements.push([
            'INSERT INTO Items (id, creation_date, onMap, image_path, properties, route, profile, instructions, stats, geometry) VALUES (?, ?, 1, NULL, ?, NULL, NULL, NULL, NULL, ?)',
            [id, id, JSON.stringify(markerProperties(i, mdi, group)), JSON.stringify(geometry)]
        ]);
        statements.push(['INSERT INTO ItemsGroups (item_id, group_id) VALUES (?, ?)', [id, group]]);
    }
    await db.batch(statements);
    timings.insertMarkers = now() - t0;

    // --- the long route
    t0 = now();
    const built = buildRoute(routePoints, profilePoints);
    timings.buildRoute = now() - t0;
    t0 = now();
    const routeId = base + markers + 1;
    const geometryStr = JSON.stringify(built.geometry);
    const profileStr = JSON.stringify(built.profile);
    timings.stringifyRoute = now() - t0;
    t0 = now();
    await db.execute('INSERT INTO Items (id, creation_date, onMap, image_path, properties, route, profile, instructions, stats, geometry) VALUES (?, ?, 1, NULL, ?, ?, ?, ?, ?, ?)', [
        routeId,
        routeId,
        JSON.stringify({ name: 'Seed very long route', seed: true, class: 'pedestrian', route: { type: 'pedestrian' }, zoomBounds: built.bounds }),
        JSON.stringify(built.route),
        profileStr,
        '[]',
        JSON.stringify(built.stats),
        geometryStr
    ]);
    await db.execute('INSERT INTO ItemsGroups (item_id, group_id) VALUES (?, ?)', [routeId, groupNames[0]]);
    timings.insertRoute = now() - t0;

    timings.reloadMap = await reloadMapItems(itemsModule);
    log(`geometry ${(geometryStr.length / 1e6).toFixed(1)} MB, profile ${(profileStr.length / 1e6).toFixed(2)} MB`);
    log('timings (ms)', JSON.stringify(Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v)]))));
    return timings;
}

export async function clearSeedData(itemsModule: ItemsModule) {
    const db = itemsModule.db.db;
    await db.batch([
        [`DELETE FROM ItemsGroups WHERE item_id IN (SELECT id FROM Items WHERE properties LIKE '%"seed":true%')`],
        [`DELETE FROM Items WHERE properties LIKE '%"seed":true%'`],
        [`DELETE FROM Groups WHERE id LIKE '${SEED_GROUP_PREFIX}%'`]
    ]);
    // the items on the map
    for (const item of itemsModule.currentItems.slice()) {
        if ((item.properties as any)?.seed) {
            const index = itemsModule.currentItems.indexOf(item);
            itemsModule.currentItems.splice(index, 1);
            itemsModule.getLocalVectorDataSource().removeFeature(1, item.id);
        }
    }
}

/** Times what the app does with that data: the on-map query, the items list query, the groups. */
export async function benchmarkQueries(itemsModule: ItemsModule) {
    const repo = itemsModule.itemRepository;
    const db = itemsModule.db.db;
    const results: Record<string, string> = {};
    const time = async (name: string, fn: () => Promise<any>) => {
        const t0 = now();
        const r = await fn();
        results[name] = `${Math.round(now() - t0)} ms${typeof r === 'number' ? ` (${r} rows)` : ''}`;
    };
    const sql = SqlQuery.createFromTemplateString;

    await time('count items', async () => (await db.get('SELECT COUNT(*) AS c FROM Items')).c);
    await time('on map query (searchItem, all columns)', async () => (await repo.searchItem({ where: sql`"onMap" = 1` })).length);
    await time('markers list query (with groups)', async () =>
        (
            await repo.searchItem({
                where: sql`"route" IS NULL`,
                postfix: sql`i LEFT JOIN (SELECT it.item_id AS id,group_concat(t.name) AS groups FROM ItemsGroups it JOIN Groups t ON t.id = it.group_id GROUP BY it.item_id) t USING (id)`
            })
        ).length
    );
    await time('routes list query (with groups)', async () =>
        (
            await repo.searchItem({
                where: sql`"route" IS NOT NULL`,
                postfix: sql`i LEFT JOIN (SELECT it.item_id AS id,group_concat(t.name) AS groups FROM ItemsGroups it JOIN Groups t ON t.id = it.group_id GROUP BY it.item_id) t USING (id)`
            })
        ).length
    );
    await time('select only ids and names (no big columns)', async () => (await db.select(`SELECT id, json_extract(properties, '$.name') AS name FROM Items WHERE onMap = 1`)).length);
    await time('hide group seed-1 (UPDATE onMap)', async () => (await db.execute(`UPDATE Items SET onMap = 0 WHERE id IN (SELECT item_id FROM ItemsGroups WHERE group_id = 'seed-1')`)).changes);
    await time('show group seed-1 (UPDATE onMap)', async () => (await db.execute(`UPDATE Items SET onMap = 1 WHERE id IN (SELECT item_id FROM ItemsGroups WHERE group_id = 'seed-1')`)).changes);
    console.log('[seed] benchmark', JSON.stringify(results, null, 2));
    return results;
}

/** What initDb does at startup: loads the items shown on the map and gives them to the vector layer. Returns the ms. */
export async function reloadMapItems(itemsModule: ItemsModule) {
    const t0 = now();
    const items = await itemsModule.itemRepository.searchItem({ where: SqlQuery.createFromTemplateString`"onMap" = 1` });
    const tQuery = now();
    itemsModule.currentItems.length = 0;
    items.forEach((i) => itemsModule.addItemToLayer(i));
    itemsModule.setLayerGeoJSONString();
    const t1 = now();
    console.log('[seed] reload map items', items.length, 'query', Math.round(tQuery - t0), 'ms, layer', Math.round(t1 - tQuery), 'ms');
    return t1 - t0;
}
