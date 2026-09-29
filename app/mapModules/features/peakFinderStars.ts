import type { MassifLayer, MassifObject } from '@nativescript-community/ui-massifmaps/api';
import { Screen } from '@nativescript/core';
import { get } from 'svelte/store';
import { formatTime, lc } from '~/helpers/locale';
import { isEInk } from '~/helpers/theme';
import {
    type PeakFinderSkyContext,
    type SkyClicks,
    addTo,
    celestialLifecycle,
    clearSkySelection,
    colour,
    listenToSkyClicks,
    refreshSkySelection,
    skyMoment
} from '~/mapModules/features/peakFinderCelestial';
import { type Horizontal, type Pass, daysSinceJ2000, fixedPass, meanDirection, planetEquatorial, planetHorizon, planetPass, toHorizon } from '~/mapModules/features/sky/astronomy';
import { constellationArtUrl, forgetConstellationArt } from '~/mapModules/features/peakFinderConstellationArt';
import { FULL_FIGURES } from '~/mapModules/features/sky/fullFigures';
import { FIGURES, FIGURE_ART, PLANETS, STARS } from '~/mapModules/features/sky/starCatalogue';
import { type SelectedSky, peakFinderConstellationArt, peakFinderConstellations, peakFinderPlanets, peakFinderSelectedSky, peakFinderStars } from '~/stores/terrainStore';

// One celestial layer under the terrain: sky objects are depth-tested, so a ridge hides the stars. Sprites
// batch into one draw call; the cost is one crossing per object placed, so only what moved is placed.

const TO_HOURS_DEGREES = 15;
const TO_RADIANS = Math.PI / 180;
// The sky turns a quarter of a degree a minute: 15 s is under a tenth of one.
const TIME_STEP_MS = 15000;
const HIDDEN_BELOW = -2;
// The stars everyone knows get their name: the brightest, and the pole star.
const NAMED_BRIGHTER_THAN = 1.5;
const ALWAYS_NAMED = ['Polaris'];
// dp a tap may miss by and still hit: a figure's line is thin, so a tap beside it deselects rather than picks it.
const STAR_TAP_DP = 12;
const FIGURE_TAP_DP = 8;
// An artwork that failed to download (offline) is not asked for again before this.
const ART_RETRY_MS = 60000;
// dp, the brightest first: they are points, not their real size, and each has to read as a planet.
const PLANET_SIZES = { venus: 10, jupiter: 9, mars: 8, saturn: 8, mercury: 7 };

interface Placed {
    object: MassifObject<'massif::CelestialSprite'>;
    label?: MassifObject<'massif::CelestialLabel'>;
    horizontal: Horizontal;
    visible: boolean;
}

interface Figure {
    arc: MassifObject<'massif::CelestialArc'>;
    label: MassifObject<'massif::CelestialLabel'>;
    /** Indices into STARS, two per segment. */
    ends: number[];
    visible: boolean;
    /** Stellarium's artwork, created once its file is on disk. */
    art?: MassifObject<'massif::CelestialImage'>;
    artVisible: boolean;
    artLoading: boolean;
    artRetryAt: number;
    /** The full figure's stars STARS lacks, created on its first selection; they tap as the figure. */
    extra?: { object: MassifObject<'massif::CelestialSprite'>; star: number }[];
    extraVisible: boolean;
}

let context: PeakFinderSkyContext = null;
let layer: MassifLayer = null;
let stars: Placed[] = [];
let planets: Placed[] = [];
let figures: Figure[] = [];
let placedKey = '';
let styledDark: boolean = null;
let highlighted = -1;
let clickDegreesPerDp = 0;
let clickSubscription: SkyClicks = null;
let generation = 0;

/** dp: a linear ramp reads better than the real magnitude scale. */
function magnitudeToSize(magnitude: number) {
    return Math.max(2.6, 8 - (magnitude + 1.5));
}

interface StarsStyle {
    star: number;
    figure: number;
    figureSelected: number;
    /** Multiplied by the artwork's brightness, which peaks at 0.4: faint by construction. */
    art: number;
    artSelected: number;
    planet: (rgb: [number, number, number]) => number;
    label: { fontName: string; fontSize: number; textColor: number; haloColor: number; haloWidth: number };
    nameLabel: { fontName: string; fontSize: number; textColor: number; haloColor: number; haloWidth: number };
}

/** Dark: a night sky. Light: a star chart, ink on the pale sky. E-ink: the ink alone. */
function starsStyle(dark: boolean): StarsStyle {
    if (isEInk) {
        const ink = dark ? colour(255, 255, 255) : colour(0, 0, 0);
        const paper = dark ? colour(0, 0, 0) : colour(255, 255, 255);
        return {
            star: ink,
            figure: ink,
            figureSelected: ink,
            art: ink,
            artSelected: ink,
            planet: () => ink,
            label: { fontName: 'sans-serif Medium', fontSize: 12, textColor: ink, haloColor: paper, haloWidth: 3 },
            nameLabel: { fontName: 'sans-serif Bold', fontSize: 11, textColor: ink, haloColor: paper, haloWidth: 3 }
        };
    }
    if (dark) {
        return {
            star: colour(255, 255, 250),
            figure: colour(120, 170, 255, 0.45),
            figureSelected: colour(251, 191, 36, 0.9),
            art: colour(191, 219, 254, 0.5),
            artSelected: colour(191, 219, 254, 0.9),
            planet: ([red, green, blue]) => colour(red, green, blue),
            label: { fontName: 'sans-serif Medium', fontSize: 12, textColor: colour(191, 219, 254, 0.9), haloColor: colour(7, 10, 18, 0.9), haloWidth: 3 },
            nameLabel: { fontName: 'sans-serif Bold', fontSize: 11, textColor: colour(254, 243, 199), haloColor: colour(7, 10, 18, 0.9), haloWidth: 3 }
        };
    }
    return {
        star: colour(15, 23, 42),
        figure: colour(30, 64, 175, 0.45),
        figureSelected: colour(180, 83, 9, 0.9),
        art: colour(30, 64, 175, 0.5),
        artSelected: colour(30, 64, 175, 0.9),
        // Their night colours, darkened to read on the pale sky.
        planet: ([red, green, blue]) => colour(Math.round(red * 0.5), Math.round(green * 0.5), Math.round(blue * 0.5)),
        label: { fontName: 'sans-serif Medium', fontSize: 12, textColor: colour(30, 58, 138), haloColor: colour(255, 255, 255, 0.85), haloWidth: 3 },
        nameLabel: { fontName: 'sans-serif Bold', fontSize: 11, textColor: colour(15, 23, 42), haloColor: colour(255, 255, 255, 0.85), haloWidth: 3 }
    };
}

function applyStyles() {
    const dark = context.dark();
    if (dark === styledDark) {
        return;
    }
    styledDark = dark;
    const style = starsStyle(dark);
    for (const star of stars) {
        star.object.set('color', style.star);
        star.label?.apply(style.nameLabel);
    }
    figures.forEach((figure, index) => {
        figure.extra?.forEach(({ object }) => object.set('color', style.star));
        figure.arc.set('color', index === highlighted ? style.figureSelected : style.figure);
        figure.art?.set('color', index === highlighted ? style.artSelected : style.art);
        figure.label.apply(style.label);
    });
    planets.forEach((planet, index) => {
        planet.object.set('color', style.planet(PLANETS[index].colour));
        planet.label.apply(style.nameLabel);
    });
}

/** The selected figure drawn wider and warmer: a figure has no one point for the ring. */
function applyHighlight() {
    const selected = get(peakFinderSelectedSky);
    const index = selected?.kind === 'constellation' ? Number(selected.id.split(':')[1]) : -1;
    if (index === highlighted || !context) {
        return;
    }
    const style = starsStyle(context.dark());
    const scale = Screen.mainScreen.scale;
    for (const [figureIndex, selectedNow] of [
        [highlighted, false],
        [index, true]
    ] as const) {
        const figure = figures[figureIndex];
        if (figure) {
            figure.arc.set('color', selectedNow ? style.figureSelected : style.figure);
            figure.arc.set('width', (selectedNow ? 3 : 1.5) * scale);
            figure.art?.set('color', selectedNow ? style.artSelected : style.art);
        }
    }
    highlighted = index;
}

function loadArt(index: number) {
    const figure = figures[index];
    if (figure.artLoading || Date.now() < figure.artRetryAt) {
        return;
    }
    figure.artLoading = true;
    const built = generation;
    const file = FIGURE_ART[FIGURES[index].name].file;
    constellationArtUrl(file)
        .then((url) => {
            // The layer was rebuilt or dropped while it downloaded.
            if (built !== generation || !layer) {
                return;
            }
            const style = starsStyle(context.dark());
            const art = context.map.object('celestial', `stars.figure.art.${index}.${generation}`, {
                type: 'image',
                luminanceAlpha: true,
                visible: false,
                color: index === highlighted ? style.artSelected : style.art
            });
            try {
                art.set('bitmap', { type: 'url', url });
            } catch (error) {
                art.destroy();
                forgetConstellationArt(file);
                throw error;
            }
            figure.art = addTo(layer, art);
            placeArts();
        })
        .catch((error) => {
            figure.artRetryAt = Date.now() + ART_RETRY_MS;
            DEV_LOG && console.log('peakFinder: constellation art', error);
        })
        .finally(() => (figure.artLoading = false));
}

/** The selected figure's artwork, or every visible figure's under the toggle, pinned by its three stars. */
function placeArts() {
    const eye = context?.eye();
    if (!eye) {
        return;
    }
    const n = daysSinceJ2000(skyMoment());
    const showAll = get(peakFinderConstellationArt);
    figures.forEach((figure, index) => {
        const art = FIGURE_ART[FIGURES[index].name];
        const wanted = !!art && figure.visible && (showAll || index === highlighted);
        if (wanted && !figure.art) {
            loadArt(index);
        }
        if (!figure.art) {
            return;
        }
        if (wanted) {
            const [width, height] = art.size;
            figure.art.call(
                'setAnchors',
                art.anchors.flatMap(([x, y, ra, dec]) => {
                    const { altitude, azimuth } = toHorizon(ra * TO_HOURS_DEGREES, dec, n, eye.lat, eye.lon);
                    return [x / width, y / height, azimuth, altitude];
                })
            );
        }
        if (figure.artVisible !== wanted) {
            figure.artVisible = wanted;
            figure.art.set('visible', wanted);
        }
    });
}

function isCatalogueStar(ra: number, dec: number) {
    return STARS.some((entry) => Math.abs(entry.dec - dec) < 0.05 && Math.abs((entry.ra - ra) * TO_HOURS_DEGREES * Math.cos(dec * TO_RADIANS)) < 0.05);
}

/** The selected figure drawn in full: Stellarium's lines, and dots for their stars STARS does not have. */
function placeFullFigure() {
    const eye = context?.eye();
    if (!eye) {
        return;
    }
    const n = daysSinceJ2000(skyMoment());
    figures.forEach((figure, index) => {
        const full = FULL_FIGURES[FIGURES[index].name];
        if (!full || !figure.visible || index !== highlighted) {
            if (figure.extraVisible) {
                figure.extraVisible = false;
                figure.extra.forEach(({ object }) => object.set('visible', false));
            }
            return;
        }
        const directions: Horizontal[] = [];
        for (let offset = 0; offset < full.stars.length; offset += 3) {
            directions.push(toHorizon(full.stars[offset] * TO_HOURS_DEGREES, full.stars[offset + 1], n, eye.lat, eye.lon));
        }
        figure.arc.call(
            'setSegments',
            full.segments.flatMap((star) => [directions[star].azimuth, directions[star].altitude])
        );
        if (!figure.extra) {
            const scale = Screen.mainScreen.scale;
            const color = starsStyle(context.dark()).star;
            figure.extra = [];
            for (let star = 0; star < directions.length; star++) {
                const [ra, dec, magnitude] = full.stars.slice(star * 3, star * 3 + 3);
                if (isCatalogueStar(ra, dec)) {
                    continue;
                }
                const object = addTo(
                    layer,
                    context.map.object('celestial', `stars.figure.extra.${index}.${star}.${generation}`, {
                        type: 'sprite',
                        screenSize: magnitudeToSize(magnitude) * scale,
                        softness: 0.45,
                        clickRadius: STAR_TAP_DP * clickDegreesPerDp,
                        color,
                        visible: false,
                        metaData: { id: `constellation:${index}` }
                    })
                );
                figure.extra.push({ object, star });
            }
        }
        figure.extraVisible = true;
        for (const { object, star } of figure.extra) {
            const { altitude, azimuth } = directions[star];
            const visible = altitude > HIDDEN_BELOW;
            if (visible) {
                object.call('setDirection', azimuth, altitude, 0);
            }
            object.set('visible', visible);
        }
    });
}

/** Click radii are angles: kept at a fixed touch size in dp as the field of view changes. */
function applyClickRadii() {
    const degreesPerDp = context.degreesPerDp();
    if (!(degreesPerDp > 0) || Math.abs(degreesPerDp - clickDegreesPerDp) < 1e-4) {
        return;
    }
    clickDegreesPerDp = degreesPerDp;
    for (const object of [...stars.map((star) => star.object), ...planets.map((planet) => planet.object), ...figures.flatMap((figure) => figure.extra?.map(({ object }) => object) ?? [])]) {
        object.set('clickRadius', STAR_TAP_DP * degreesPerDp);
    }
    for (const figure of figures) {
        figure.arc.set('clickRadius', FIGURE_TAP_DP * degreesPerDp);
    }
}

function setVisible(placed: { visible: boolean }, object: MassifObject, visible: boolean) {
    if (placed.visible !== visible) {
        placed.visible = visible;
        object.set('visible', visible);
    }
}

function place(placed: Placed, visible: boolean) {
    if (visible) {
        const { altitude, azimuth } = placed.horizontal;
        placed.object.call('setDirection', azimuth, altitude, 0);
        placed.label?.call('setDirection', azimuth, altitude, 0);
    }
    if (placed.label && placed.visible !== visible) {
        placed.label.set('visible', visible);
    }
    setVisible(placed, placed.object, visible);
}

/** Keyed on the moment and the eye rounded to what shows, so the per-move call costs a string compare. */
export function updatePeakFinderStars(force = false) {
    if (!context || !layer) {
        return;
    }
    const eye = context.eye();
    if (!eye) {
        return;
    }
    try {
        applyClickRadii();
        applyStyles();
        applyHighlight();
        const moment = skyMoment();
        const showFigures = get(peakFinderConstellations);
        const showPlanets = get(peakFinderPlanets);
        const key = `${Math.round(moment / TIME_STEP_MS)}|${eye.lat.toFixed(3)}|${eye.lon.toFixed(3)}|${showFigures}|${showPlanets}`;
        if (!force && key === placedKey) {
            return;
        }
        placedKey = key;
        const started = DEV_LOG ? Date.now() : 0;
        const n = daysSinceJ2000(moment);

        STARS.forEach((entry, index) => {
            const star = stars[index];
            star.horizontal = toHorizon(entry.ra * TO_HOURS_DEGREES, entry.dec, n, eye.lat, eye.lon);
            // Under the ground: not drawn, not clickable, not paid for.
            place(star, star.horizontal.altitude > HIDDEN_BELOW);
        });

        for (const figure of figures) {
            const visible = showFigures && figure.ends.some((end) => stars[end].visible);
            if (visible) {
                const directions = figure.ends.flatMap((end) => [stars[end].horizontal.azimuth, stars[end].horizontal.altitude]);
                figure.arc.call('setSegments', directions);
                const centre = meanDirection(directions);
                const labelVisible = !!centre && centre.altitude > 0;
                if (labelVisible) {
                    figure.label.call('setDirection', centre.azimuth, centre.altitude, 0);
                }
                figure.label.set('visible', labelVisible);
            } else if (figure.visible) {
                figure.label.set('visible', false);
            }
            setVisible(figure, figure.arc, visible);
        }
        placeArts();
        placeFullFigure();

        planets.forEach((planet, index) => {
            planet.horizontal = planetHorizon(index, n, eye.lat, eye.lon);
            place(planet, showPlanets && planet.horizontal.altitude > HIDDEN_BELOW);
        });
        refreshSkySelection();
        DEV_LOG && console.log('peakFinder: stars placed in', Date.now() - started, 'ms');
    } catch (error) {
        DEV_LOG && console.log('peakFinder: stars', error);
    }
}

const KM_PER_AU = 149597870.7;

function passText(pass: Pass) {
    if (pass === 'always') {
        return lc('never_sets');
    }
    if (pass === 'never') {
        return lc('never_rises');
    }
    return `↑ ${formatTime(pass.rise)} · ↓ ${formatTime(pass.set)}`;
}

/** What the chip shows for a tapped object, and where the ring follows it. */
function resolve(id: string): { selected: SelectedSky; locate: () => Horizontal | null; pass?: () => string | null } | null {
    const [kind, value] = id.split(':');
    const index = Number(value);
    if (kind === 'star' && STARS[index]) {
        const entry = STARS[index];
        return {
            selected: { id, kind: 'star', name: entry.name, detail: `${lc('star')} · ${lc('magnitude')} ${entry.mag} · ${lc('light_years', entry.ly)}`, wikidata: entry.wikidata },
            locate: () => stars[index]?.horizontal ?? null,
            pass: () => {
                const eye = context?.eye();
                return eye ? passText(fixedPass(entry.ra * TO_HOURS_DEGREES, entry.dec, skyMoment(), eye.lat, eye.lon)) : null;
            }
        };
    }
    if (kind === 'planet' && PLANETS[index]) {
        return {
            selected: { id, kind: 'planet', name: lc(PLANETS[index].key), detail: lc('planet'), wikidata: PLANETS[index].wikidata },
            locate: () => planets[index]?.horizontal ?? null,
            // Its distance changes with the moment, so it rides with the pass.
            pass: () => {
                const eye = context?.eye();
                if (!eye) {
                    return null;
                }
                const moment = skyMoment();
                const distance = Math.round((planetEquatorial(index, daysSinceJ2000(moment)).distance * KM_PER_AU) / 1e6);
                return `${passText(planetPass(index, moment, eye.lat, eye.lon))} · ${lc('million_km', distance)}`;
            }
        };
    }
    if (kind === 'constellation' && FIGURES[index]) {
        return {
            selected: { id, kind: 'constellation', name: FIGURES[index].name, detail: lc('constellation'), wikidata: FIGURES[index].wikidata },
            locate: () => null
        };
    }
    return null;
}

function build(starsContext: PeakFinderSkyContext) {
    context = starsContext;
    const map = context.map;
    const scale = Screen.mainScreen.scale;
    generation += 1;
    const id = (name: string) => `${name}.${generation}`;
    layer = map.buildLayer(id('layer.stars'), { type: 'celestial' });
    // First, so the terrain draws over it and the summit names over that.
    map.add(layer, 0);

    // A name is tapped like what it names: same id, so the same selection.
    const name = (label: string, text: string, objectId: string, lift: number) => {
        const created = addTo(layer, map.object('celestial', id(label), { type: 'label', text, visible: false, clickable: true, metaData: { id: objectId } }));
        // Over the point, clear of it.
        created.call('setOffset', 0, lift);
        return created;
    };
    const starIndex = new Map(STARS.map((entry, index) => [entry.name, index]));
    stars = STARS.map((entry, index) => {
        const size = magnitudeToSize(entry.mag);
        return {
            object: addTo(
                layer,
                map.object('celestial', id(`stars.star.${index}`), {
                    type: 'sprite',
                    screenSize: size * scale,
                    softness: 0.45,
                    visible: false,
                    metaData: { id: `star:${index}` }
                })
            ),
            label: entry.mag < NAMED_BRIGHTER_THAN || ALWAYS_NAMED.includes(entry.name) ? name(`stars.star.label.${index}`, entry.name, `star:${index}`, size / 2 + 3) : undefined,
            horizontal: null,
            visible: false
        };
    });
    figures = FIGURES.map((entry, index) => {
        const ends = entry.segments.flat().map((name) => starIndex.get(name));
        if (ends.some((end) => end === undefined)) {
            DEV_LOG && console.log('peakFinder: stars, a figure names an unknown star', entry.name);
        }
        const arc = addTo(
            layer,
            map.object('celestial', id(`stars.figure.${index}`), {
                type: 'arc',
                width: 1.5 * scale,
                belowHorizonVisible: false,
                visible: false,
                metaData: { id: `constellation:${index}` }
            })
        );
        const label = addTo(
            layer,
            map.object('celestial', id(`stars.figure.label.${index}`), { type: 'label', text: entry.name, visible: false, clickable: true, metaData: { id: `constellation:${index}` } })
        );
        return { arc, label, ends: ends.filter((end) => end !== undefined), visible: false, artVisible: false, artLoading: false, artRetryAt: 0, extraVisible: false };
    });
    planets = PLANETS.map((entry, index) => {
        const object = addTo(
            layer,
            map.object('celestial', id(`stars.planet.${index}`), {
                type: 'sprite',
                screenSize: PLANET_SIZES[entry.key] * scale,
                softness: 0.4,
                visible: false,
                metaData: { id: `planet:${index}` }
            })
        );
        return { object, label: name(`stars.planet.label.${index}`, lc(entry.key), `planet:${index}`, PLANET_SIZES[entry.key] / 2 + 3), horizontal: null, visible: false };
    });
    styledDark = null;
    highlighted = -1;
    clickDegreesPerDp = 0;
    placedKey = '';
    clickSubscription = listenToSkyClicks(layer, resolve);
}

function drop() {
    clearSkySelection(['star', 'planet', 'constellation']);
    clickSubscription?.remove();
    clickSubscription = null;
    if (layer) {
        try {
            context?.map.removeLayer(layer);
        } catch (error) {
            DEV_LOG && console.log('peakFinder: stars layer', error);
        }
    }
    for (const object of [
        layer,
        ...stars.flatMap((star) => [star.object, star.label]),
        ...figures.flatMap((figure) => [figure.arc, figure.label, figure.art, ...(figure.extra?.map(({ object }) => object) ?? [])]),
        ...planets.flatMap((planet) => [planet.object, planet.label])
    ]) {
        object?.destroy();
    }
    layer = null;
    stars = [];
    figures = [];
    planets = [];
    placedKey = '';
    context = null;
}

const lifecycle = celestialLifecycle({
    enabled: peakFinderStars,
    clockMs: TIME_STEP_MS,
    start: build,
    update: updatePeakFinderStars,
    drop,
    triggers: [
        [
            peakFinderConstellations,
            () => {
                clearSkySelection(['constellation']);
                updatePeakFinderStars();
            }
        ],
        [
            peakFinderPlanets,
            () => {
                clearSkySelection(['planet']);
                updatePeakFinderStars();
            }
        ],
        [
            peakFinderSelectedSky,
            // In full, re-placed: the figure left goes back to its outline.
            () => updatePeakFinderStars(true)
        ],
        [peakFinderConstellationArt, () => placeArts()]
    ]
});

export const setupPeakFinderStars = lifecycle.setup;
export const teardownPeakFinderStars = lifecycle.teardown;
