import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The app's own Massif rules (dev_assets/styles/massif/app-rules.mss) compiled the way
// app.webpack.config.js does: the package's CartoCSS plus the Alpimaps child, through css2xml.
// MASSIF_STYLES_DIR points at another build of @massif-maps/styles (a local dist/npm), e.g. to try
// a Massif PR before it is published.
// Not covered: a render. That the casing lines up on screen is a look at the map with `app_fast_roads` = 1.

const ROOT = resolve(__dirname, '../..');
const PACKAGE = process.env.MASSIF_STYLES_DIR ? resolve(process.env.MASSIF_STYLES_DIR) : join(ROOT, 'node_modules/@massif-maps/styles');
const CSS2XML = join(ROOT, 'node_modules/.bin/massif-style');
const PROJECTS = ['massif', 'alpimaps'];
// every class Massif outlines but the motorway, which the app rule leaves out as Massif's does
const CLASSES = ['trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'];

const work = mkdtempSync(join(tmpdir(), 'massif-app-rules-'));
const xml: Record<string, string> = {};

function styleBlock(doc: string, name: string) {
    const start = doc.indexOf(`<Style name="${name}"`);
    return start < 0 ? '' : doc.slice(start, doc.indexOf('</Style>', start));
}

function styleBlocks(doc: string, pattern: RegExp) {
    return [...doc.matchAll(/<Style name="([^"]+)"/g)]
        .filter((m) => pattern.test(m[1]))
        .map((m) => styleBlock(doc, m[1]));
}

// the compiler hoists a repeated expression into <Define id>, and keeps `a ? a : a` where Massif's table has no variant
function gapWidth(doc: string, block: string) {
    let value = /gap-width="([^"]*)"/.exec(block)?.[1];
    const ref = value && /^@@(\w+)$/.exec(value)?.[1];
    if (ref) {
        value = new RegExp(`<Define id="${ref}" value="([^"]*)"`).exec(doc)?.[1];
    }
    return value?.replace(/\(\[\{'param::road_osm_low'\}\]=1 \? ([\d.]+) : \1\)/g, '$1');
}

beforeAll(() => {
    const src = join(work, 'src');
    mkdirSync(src, { recursive: true });
    const flavour = join(PACKAGE, 'cartocss-iconfont');
    expect(existsSync(flavour), `no cartocss-iconfont in ${PACKAGE}`).toBe(true);
    cpSync(flavour, src, { recursive: true, filter: (p) => !/\/(iconfont|fonts)(\/|$)/.test(p) });
    cpSync(join(ROOT, 'dev_assets/styles/massif'), src, { recursive: true });
    for (const name of PROJECTS) {
        execFileSync(CSS2XML, ['css2xml', join(src, `${name}.json`), join(work, `${name}.xml`)], { stdio: 'pipe' });
        xml[name] = readFileSync(join(work, `${name}.xml`), 'utf8');
    }
}, 120000);

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('the fast-road casing of app-rules.mss', () => {
    it('has the package its rules need: a width per road class in variables.mss', () => {
        const variables = readFileSync(join(work, 'src/variables.mss'), 'utf8');
        for (const cls of CLASSES) {
            expect(variables, `@road_width_${cls} missing: @massif-maps/styles is older than the release that adds it`).toContain(`@road_width_${cls}:`);
        }
    });

    for (const project of PROJECTS) {
        describe(project, () => {
            for (const cls of CLASSES) {
                it(`${cls}: sits outside the road, whose own width it takes`, () => {
                    const rule = styleBlock(xml[project], `transportation::app_fast_road_${cls}`);
                    expect(rule, `no app_fast_road_${cls} in the compiled ${project}`).not.toBe('');
                    // Massif's own casing of that class is drawn at the road's width
                    const own = styleBlocks(xml[project], /transportation::road_casing_b\d+$/).find((b) =>
                        b.includes(`[{'class'}]='${cls}'`)
                    );
                    const width = gapWidth(xml[project], own ?? '');
                    expect(width, `no road_casing for ${cls} in ${project}`).toBeTruthy();
                    const gap = gapWidth(xml[project], rule);
                    expect(gap?.startsWith(`${width}+`), `the gap is not the road's width plus its casing: ${gap}`).toBe(true);
                });
            }

            it('is off until the app sets app_fast_roads, and leaves motorways alone', () => {
                for (const cls of CLASSES) {
                    expect(styleBlock(xml[project], `transportation::app_fast_road_${cls}`)).toContain("[{'param::app_fast_roads'}]=1");
                }
                expect(styleBlock(xml[project], 'transportation::app_fast_road_motorway')).toBe('');
            });
        });
    }
});
