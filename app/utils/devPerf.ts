/* DEV ONLY: performance workloads (from spike/perf/perf.ts of the sqlite repo) plus big JSON documents (routes with positions and
 * instructions), run against sqlite-core. Triggered from Settings (DEV_LOG builds). Logs are tagged [PERF]. */
import { File, knownFolders } from '@nativescript/core';

declare const __ANDROID__: boolean;

const log = (...a: any[]) => console.log('[PERF]', ...a);
const now = (): number => performance.now();

function median(xs: number[]) {
    const s = xs.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

interface Result { ms: number; min: number; info?: any }

async function measure(fn: () => Promise<any>, runs: number, prepare?: () => Promise<any>, warmup = 1): Promise<Result> {
    const t: number[] = [];
    let info: any;
    for (let i = 0; i < warmup + runs; i++) {
        if (prepare) await prepare();
        const t0 = now();
        info = await fn();
        const dt = now() - t0;
        if (i >= warmup) t.push(dt);
    }
    return { ms: +median(t).toFixed(1), min: +Math.min(...t).toFixed(1), info };
}

function removeDb(file: string) {
    for (const s of ['', '-wal', '-shm', '-journal']) {
        try {
            if (File.exists(file + s)) File.fromPath(file + s).removeSync();
        } catch (e) {
            // ignore
        }
    }
}

const CTE = (n: number) => `WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < ${n})`;

export interface Variant {
    label: string;
    /** called before the database is opened */
    setup?: () => void;
    /** skip the workloads that run statements inside a transaction (they hang with the 3.x worker mode: the transaction belongs to the JS thread's connection session) */
    skipTransactions?: boolean;
    /** point lookups through select()[0]: `get` of the 3.x iOS plugin never worked (it reads a row before calling next()) */
    pointViaSelect?: boolean;
    /** skip the 100000 row select: with the 3.x iOS plugin it is quadratic (rows = [...rows, row]) and takes many minutes */
    skipBigSelect?: boolean;
    options?: any;
}

/** Longest gap between two ticks of a 4 ms timer while `fn` runs: how long the JS (UI) thread was blocked. */
async function jank(fn: () => Promise<any>) {
    let last = now();
    let max = 0;
    const timer = setInterval(() => {
        const t = now();
        max = Math.max(max, t - last);
        last = t;
    }, 4);
    const t0 = now();
    last = t0;
    await fn();
    const total = now() - t0;
    max = Math.max(max, now() - last);
    clearInterval(timer);
    return { maxGapMs: +max.toFixed(1), totalMs: +total.toFixed(1) };
}

export async function runPerf(variant: Variant, openOrCreate: (path: string, options?: any) => any) {
    const name = variant.label;
    const file = `${knownFolders.documents().path}/perf-${name}.db`;
    removeDb(file);
    variant.setup && variant.setup();
    const db: any = openOrCreate(file, variant.options || {});
    const out: Record<string, Result | any> = {};
    const report = (key: string, r: any) => {
        out[key] = r;
        log(name, key, JSON.stringify(r));
    };
    try {
        await db.execute('CREATE TABLE narrow(id INTEGER PRIMARY KEY, name TEXT, score REAL)');
        await db.execute(`${CTE(20000)} INSERT INTO narrow SELECT x, 'name_' || x, x * 0.25 FROM c`);
        await db.execute('CREATE TABLE wide(i1, i2, i3, i4, r1, r2, r3, t1, t2, t3, n1, n2)');
        await db.execute(
            `${CTE(5000)} INSERT INTO wide SELECT x, x * 3, x % 7, x * 1000003, x / 3.0, x * 1.5, -x * 0.125, printf('%024d', x), 'description of item ' || x || ' in the catalog', 'x' || (x % 100) || '/' || abs(random() % 1000000), CASE WHEN x % 2 THEN NULL ELSE x END, NULL FROM c`
        );
        await db.execute('CREATE TABLE txt(a TEXT, b TEXT, c TEXT)');
        await db.execute(
            `${CTE(5000)} INSERT INTO txt SELECT printf('%0200d', x), CASE WHEN x % 10 = 0 THEN substr(printf('%0200d', x), 1, 150) || 'é€ ünïcode ' || x ELSE printf('%0200d', x * 2) END, printf('%0100d', x) || printf('%0100d', x) FROM c`
        );
        await db.execute('CREATE TABLE bl(id INTEGER, data BLOB)');
        await db.execute(`${CTE(1000)} INSERT INTO bl SELECT x, randomblob(2048) FROM c`);
        await db.execute('CREATE TABLE ins(id INTEGER PRIMARY KEY, a TEXT, b REAL)');
        const clearIns = () => db.execute('DELETE FROM ins');

        // --- writes
        report(
            'insert 500 rows, one awaited execute each, autocommit',
            await measure(async () => {
                for (let i = 0; i < 500; i++) await db.execute('INSERT INTO ins(a, b) VALUES (?, ?)', ['row ' + i, i * 0.5]);
            }, 3, clearIns)
        );
        if (!variant.skipTransactions) report(
            'insert 5000 rows in a transaction, awaited one by one',
            await measure(async () => {
                await db.transaction(async () => {
                    for (let i = 0; i < 5000; i++) await db.execute('INSERT INTO ins(a, b) VALUES (?, ?)', ['row ' + i, i * 0.5]);
                });
            }, 5, clearIns)
        );
        if (!variant.skipTransactions) report(
            'insert 5000 rows in a transaction, all started at once',
            await measure(async () => {
                await db.transaction(async () => {
                    await Promise.all(Array.from({ length: 5000 }, (_, i) => db.execute('INSERT INTO ins(a, b) VALUES (?, ?)', ['row ' + i, i * 0.5])));
                });
            }, 5, clearIns)
        );
        if (typeof db.batch === 'function') {
            const items = Array.from({ length: 5000 }, (_, i) => ['INSERT INTO ins(a, b) VALUES (?, ?)', ['row ' + i, i * 0.5]]);
            report('insert 5000 rows with batch() (new API only)', await measure(() => db.batch(items), 5, clearIns));
        }

        // --- blocking calls (new API only, Node-API binding only)
        let hasSync = false;
        try {
            hasSync = typeof db.getSync === 'function' && !!db.getSync('SELECT 1 AS one');
        } catch (e) {
            hasSync = false;
        }
        if (hasSync) {
            report(
                'insert 5000 rows in a transaction, blocking executeSync (new API only)',
                await measure(async () => {
                    await db.transaction(async () => {
                        for (let i = 0; i < 5000; i++) db.executeSync('INSERT INTO ins(a, b) VALUES (?, ?)', ['row ' + i, i * 0.5]);
                    });
                }, 5, clearIns)
            );
        }

        // --- reads
        const sel = async (sql: string, runs = 5) => measure(async () => (await db.select(sql)).length, runs);
        report('select 20000 rows x 3 (int, short text, real)', await sel('SELECT * FROM narrow'));
        report('select 5000 rows x 12 (mixed, nulls)', await sel('SELECT * FROM wide'));
        report('select 5000 rows x 3 (200 char text)', await sel('SELECT * FROM txt'));
        report('select 1000 rows with 2 KB blobs', await sel('SELECT * FROM bl'));
        report(
            '500 small selects (100 rows), one after the other',
            await measure(async () => {
                for (let i = 0; i < 500; i++) await db.select('SELECT id, name FROM narrow WHERE id <= 100');
            }, 5)
        );
        const point = variant.pointViaSelect
            ? async (id: number) => (await db.select('SELECT * FROM narrow WHERE id = ?', [id]))[0]
            : (id: number) => db.get('SELECT * FROM narrow WHERE id = ?', [id]);
        report(
            '1000 get by primary key, one after the other',
            await measure(async () => {
                for (let i = 1; i <= 1000; i++) await point(i);
            }, 5)
        );
        report('1000 get by primary key, all started at once', await measure(async () => (await Promise.all(Array.from({ length: 1000 }, (_, i) => point(i + 1)))).length, 5));
        if (hasSync) {
            report(
                '1000 get by primary key, blocking getSync (new API only)',
                await measure(async () => {
                    for (let i = 1; i <= 1000; i++) db.getSync('SELECT * FROM narrow WHERE id = ?', [i]);
                }, 5)
            );
            report(
                '500 small selects (100 rows), blocking selectSync (new API only)',
                await measure(async () => {
                    for (let i = 0; i < 500; i++) db.selectSync('SELECT id, name FROM narrow WHERE id <= 100');
                }, 5)
            );
        }
        report(
            'each over 20000 rows',
            await measure(async () => {
                let n = 0;
                await db.each('SELECT * FROM narrow', [], () => {
                    n++;
                }, () => {});
                return n;
            }, 5)
        );

        // --- responsiveness: how long is the JS thread blocked by a big query
        const big = 'SELECT a.id, a.name, a.score, k.k FROM narrow a, (SELECT 1 AS k UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) k';
        if (!variant.skipBigSelect) {
            const gaps: any[] = [];
            for (let i = 0; i < 4; i++) {
                const g = await jank(async () => (await db.select(big)).length);
                if (i > 0) gaps.push(g);
            }
            report('jank during select of 100000 rows x 4', { maxGapMs: median(gaps.map((g) => g.maxGapMs)), totalMs: median(gaps.map((g) => g.totalMs)) });
        }
        const gaps2: any[] = [];
        for (let i = 0; i < 4; i++) {
            const g = await jank(async () => {
                for (let k = 0; k < 20; k++) await db.select('SELECT * FROM narrow LIMIT 2000');
            });
            if (i > 0) gaps2.push(g);
        }
        report('jank during 20 selects of 2000 rows', { maxGapMs: median(gaps2.map((g) => g.maxGapMs)), totalMs: median(gaps2.map((g) => g.totalMs)) });

        // --- big JSON documents (a route with positions, instructions and a profile): the decode of long strings
        await bigJson(db, report);
    } catch (e) {
        log(name, 'ERROR', String(e), e && (e as any).stack ? String((e as any).stack).split('\n').slice(0, 3).join(' | ') : '');
    }
    try {
        await db.close();
    } catch (e) {
        // ignore
    }
    removeDb(file);
    return out;
}


/** a route like the app stores it: positions, instructions, elevation profile, as JSON text columns */
function buildBigRoute(points: number, instructions: number) {
    const coordinates: number[][] = new Array(points);
    let lon = 5.7245;
    let lat = 45.1885;
    for (let i = 0; i < points; i++) {
        lon += 0.00004 * Math.cos(i / 500);
        lat += 0.00003 * Math.sin(i / 700);
        coordinates[i] = [+lon.toFixed(6), +lat.toFixed(6), +(300 + 100 * Math.sin(i / 900)).toFixed(1)];
    }
    const inst = new Array(instructions);
    for (let i = 0; i < instructions; i++) {
        inst[i] = { a: i % 19, az: (i * 7) % 360, dist: 120 + (i % 80), index: Math.floor((i * points) / instructions), time: 60 + (i % 40), angle: (i * 13) % 180, name: `Rue de l'Église n°${i} – Avenue des Alpes`, inst: `Tournez à droite sur la rue de l'Église n°${i} puis continuez pendant ${120 + (i % 80)} mètres` };
    }
    const profile = { max: [4000, 450], min: [0, 250], data: Array.from({ length: 4000 }, (_, i) => ({ d: i * 50, a: +(300 + 100 * Math.sin(i / 20)).toFixed(1), g: 0 })), ascents: [] };
    return { geometry: JSON.stringify({ type: 'LineString', coordinates }), instructions: JSON.stringify(inst), profile: JSON.stringify(profile) };
}

async function bigJson(db: any, report: (key: string, r: any) => void) {
    const sizes: Array<[string, number, number]> = [
        ['route 50 000 points, 5 000 instructions', 50000, 5000],
        ['route 200 000 points, 20 000 instructions', 200000, 20000]
    ];
    await db.execute('CREATE TABLE bigjson(id INTEGER PRIMARY KEY, geometry TEXT, instructions TEXT, profile TEXT)');
    for (const [label, points, nInstructions] of sizes) {
        const route = buildBigRoute(points, nInstructions);
        const mb = ((route.geometry.length + route.instructions.length + route.profile.length) / 1e6).toFixed(1);
        await db.execute('DELETE FROM bigjson');
        report(`${label} (${mb} MB): insert one row`, await measure(async () => {
            await db.execute('DELETE FROM bigjson');
            await db.execute('INSERT INTO bigjson(id, geometry, instructions, profile) VALUES (1, ?, ?, ?)', [route.geometry, route.instructions, route.profile]);
        }, 3));
        report(`${label}: select the row (3 text columns)`, await measure(async () => (await db.select('SELECT * FROM bigjson')).length, 5));
        report(`${label}: get geometry only`, await measure(async () => (await db.select('SELECT geometry FROM bigjson'))[0].geometry.length, 5));
        let rows: any[];
        const t0 = now();
        rows = await db.select('SELECT * FROM bigjson');
        const tSelect = now() - t0;
        const t1 = now();
        const geo = JSON.parse(rows[0].geometry);
        const tGeo = now() - t1;
        const t2 = now();
        JSON.parse(rows[0].instructions);
        const tInst = now() - t2;
        report(`${label}: select + JSON.parse`, { selectMs: +tSelect.toFixed(1), parseGeometryMs: +tGeo.toFixed(1), parseInstructionsMs: +(tInst).toFixed(1), points: geo.coordinates.length });
        // non ASCII heavy: the instructions have accents
        report(`${label}: select + JSON.parse, instructions only`, await measure(async () => JSON.parse((await db.select('SELECT instructions FROM bigjson'))[0].instructions).length, 5));
    }
    // a real document, when one was put next to the databases
    const custom = `${knownFolders.documents().path}/bigroute.json`;
    if (File.exists(custom)) {
        const text = await File.fromPath(custom).readText();
        await db.execute('DELETE FROM bigjson');
        report(`bigroute.json (${(text.length / 1e6).toFixed(1)} MB): insert`, await measure(async () => {
            await db.execute('DELETE FROM bigjson');
            await db.execute('INSERT INTO bigjson(id, geometry) VALUES (1, ?)', [text]);
        }, 3));
        report('bigroute.json: select', await measure(async () => (await db.select('SELECT geometry FROM bigjson'))[0].geometry.length, 5));
        report('bigroute.json: select + JSON.parse', await measure(async () => Object.keys(JSON.parse((await db.select('SELECT geometry FROM bigjson'))[0].geometry)).length, 5));
    }
}

/** Runs the workloads (and the big JSON ones) against sqlite-core with the app's configuration. */
export async function runBranchPerf() {
    const { openOrCreate } = require('@nativescript-community/sqlite-core');
    const out = await runPerf({ label: 'branch' }, openOrCreate);
    log('DONE');
    return out;
}
