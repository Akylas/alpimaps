#!/usr/bin/env node
// Massif's icon font (MassifIcons) drawn with the osm font's glyphs, on Massif's codepoints, built into
// dev_assets/styles/massif/fonts: `yarn massif-iconfont [--massif <cartocss-iconfont/iconfont>]`
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const MASSIF = args.includes('--massif') ? args[args.indexOf('--massif') + 1] : 'node_modules/@massif-maps/styles/cartocss-iconfont/iconfont';
const OSM = 'iconotype/osm.iconotype.json';
const OUT = 'iconotype/massif.iconotype.json';
const PROJECTS = ['dev_assets/styles/massif/massif.json', 'dev_assets/styles/massif/alpimaps.json'];

// Massif's name -> the osm glyph drawing it, where the osm font names it otherwise. A Massif name in
// neither keeps Massif's own glyph (pylon, cairn, tree...).
const ALIAS = {
    bicycle_rental: 'rental_bicycle',
    railway_light: 'rail_light',
    railway_metro: 'rail_metro',
    sushi: 'restaurant_sushi',
    water: 'droplet',
    wayside_cross: 'cross',
    wayside_shrine: 'shrine',
    wind_turbine: 'generator_wind'
};
// osm glyphs that are no POI class: map symbols, route markers, the Japanese variants
const NOT_A_CLASS = /^(symbol-|uni[0-9A-F]{4}|.*_jp$|arrow$|marker|circle|square|star|triangle|oneway|alert-|flag-|heart$|location_on$|diamond$)/;

const { project } = await import(pathToFileURL(join(MASSIF, 'iconotype-project.mjs')).href);
const massif = JSON.parse(readFileSync(join(MASSIF, 'MassifIcons.iconotype.json'), 'utf8'));
const osm = JSON.parse(readFileSync(OSM, 'utf8'));

// IcoMoon-era names list several, `cave, cave_entrance, adit`: each is a name of the glyph
const art = new Map();
for (const icon of osm.icons) {
    if (icon.selected === false) continue;
    for (const name of icon.name.split(/,\s*/).map((n) => n.replace(/svg$/, ''))) {
        if (!art.has(name)) art.set(name, icon.paths);
    }
}

const icons = [];
const fromOsm = [];
for (const icon of massif.icons.filter((i) => i.selected !== false)) {
    const paths = art.get(ALIAS[icon.name] ?? icon.name);
    icons.push({ name: icon.name, paths: paths ?? icon.paths });
    if (paths) fromOsm.push(icon.name);
}
const taken = new Set(icons.map((i) => i.name));
const extras = [...art.keys()].filter((name) => !taken.has(name) && !NOT_A_CLASS.test(name) && /^[a-z0-9_]+$/.test(name)).sort();
for (const name of extras) icons.push({ name, paths: art.get(name) });

// Massif's codes first, so its names land on its characters; then this file's own, so an extra keeps its
// code unless a later Massif icon took it (the child projects' glyph.<name> are rewritten below anyway)
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { icons: [] };
const massifNames = new Set(massif.icons.map((i) => i.name));
const massifCodes = new Set(massif.icons.map((i) => i.code));
const lock = { icons: [...massif.icons, ...previous.icons.filter((i) => !massifNames.has(i.name) && !massifCodes.has(i.code))] };
const doc = project('MassifIcons', icons, lock);
doc.output = { fonts: { dir: '../dev_assets/styles/massif/fonts', formats: ['ttf'] } };
doc.credits = osm.credits;
writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');

// the extras are names Massif's `glyph` table lacks: the child projects add them as `glyph.<name>`
const glyphs = Object.fromEntries(doc.icons.filter((i) => extras.includes(i.name) && i.selected !== false)
    .map((i) => ['glyph.' + i.name, String.fromCodePoint(parseInt(i.code, 16))]));
for (const file of PROJECTS) {
    const child = JSON.parse(readFileSync(file, 'utf8'));
    const params = Object.fromEntries(Object.entries(child.styleparameters ?? {}).filter(([key]) => !key.startsWith('glyph-') && !key.startsWith('glyph.')));
    child.styleparameters = { ...params, ...glyphs };
    writeFileSync(file, JSON.stringify(child, null, 2) + '\n');
}
const build = spawnSync('npx', ['--yes', '@iconotype/cli@0.3.0', 'build', '--input', OUT, '--lock', join(tmpdir(), 'massif-codepoints.lock')],
    { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
process.stdout.write(`MassifIcons: ${fromOsm.length}/${taken.size} Massif names drawn from osm, ${extras.length} osm names added -> ${OUT}\n`);
process.stdout.write(`Massif's own glyph kept for: ${[...taken].filter((n) => !fromOsm.includes(n)).join(' ')}\n`);
