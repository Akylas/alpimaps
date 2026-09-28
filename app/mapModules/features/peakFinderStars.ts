import type { MassifLayer, MassifObject, Subscription } from '@nativescript-community/ui-massifmaps/api';
import { Screen } from '@nativescript/core';
import { get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { isEInk } from '~/helpers/theme';
import { type PeakFinderSkyContext, addTo, celestialLifecycle, clearSkySelection, colour, listenToSkyClicks, refreshSkySelection, skyMoment } from '~/mapModules/features/peakFinderCelestial';
import { type Horizontal, daysSinceJ2000, meanDirection, planetHorizon, toHorizon } from '~/mapModules/features/sky/astronomy';
import { FIGURES, PLANETS, STARS } from '~/mapModules/features/sky/starCatalogue';
import { type SelectedSky, peakFinderConstellations, peakFinderPlanets, peakFinderSelectedSky, peakFinderStars } from '~/stores/terrainStore';

/**
 * THE STARS over the panorama - the SDK demo's sky: the bright stars sized by magnitude, the
 * constellation figures and their names, and the planets, where they are at the chosen moment.
 *
 * One celestial layer under the terrain, like the moon: sky objects are depth-tested, so a ridge
 * hides the stars behind it. Every star is a sprite sharing one look, which the SDK batches into a
 * single draw call; the cost is on this side, one crossing per object placed - so only what moved
 * visibly is placed, and nothing under the horizon.
 */

const TO_HOURS_DEGREES = 15;
// The sky turns a quarter of a degree a minute: 15 s is under a tenth of one.
const TIME_STEP_MS = 15000;
const HIDDEN_BELOW = -2;
// The stars everyone knows get their name: the brightest, and the pole star.
const NAMED_BRIGHTER_THAN = 1.5;
const ALWAYS_NAMED = ['Polaris'];
// dp, the brightest first: they are points, not their real size, and each has to read as a planet.
const PLANET_SIZES = { venus: 10, jupiter: 9, mars: 8, saturn: 8, mercury: 7 };

interface Placed {
    object: MassifObject<'massif::CelestialSprite'>;
    /** Its name in the sky, for the planets and the named stars. */
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
}

let context: PeakFinderSkyContext = null;
let layer: MassifLayer = null;
let stars: Placed[] = [];
let planets: Placed[] = [];
let figures: Figure[] = [];
let placedKey = '';
let styledDark: boolean = null;
let highlighted = -1;
let clickSubscription: Subscription = null;
let generation = 0;

/** A star of this magnitude, in dp: brighter is bigger, on a linear ramp that reads better than the real one. */
function magnitudeToSize(magnitude: number) {
    return Math.max(1.6, 6 - 0.8 * (magnitude + 1.5));
}

interface StarsStyle {
    star: number;
    figure: number;
    figureSelected: number;
    planet: (rgb: [number, number, number]) => number;
    label: { fontName: string; fontSize: number; textColor: number; haloColor: number; haloWidth: number };
    /** A named star's or a planet's: brighter than a figure's, for a point rather than an area. */
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
            planet: ([red, green, blue]) => colour(red, green, blue),
            label: { fontName: 'sans-serif Medium', fontSize: 12, textColor: colour(191, 219, 254, 0.9), haloColor: colour(7, 10, 18, 0.9), haloWidth: 3 },
            nameLabel: { fontName: 'sans-serif Bold', fontSize: 11, textColor: colour(254, 243, 199), haloColor: colour(7, 10, 18, 0.9), haloWidth: 3 }
        };
    }
    return {
        star: colour(15, 23, 42),
        figure: colour(30, 64, 175, 0.45),
        figureSelected: colour(180, 83, 9, 0.9),
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
        figure.arc.set('color', index === highlighted ? style.figureSelected : style.figure);
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
        }
    }
    highlighted = index;
}

function setVisible(placed: { visible: boolean }, object: MassifObject, visible: boolean) {
    if (placed.visible !== visible) {
        placed.visible = visible;
        object.set('visible', visible);
    }
}

/** A point and its name, if it has one, at its direction - or hidden. */
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

/**
 * Places the sky for the moment and the eye. Keyed on both, rounded to what shows, so the camera's
 * every move - which calls this - costs a string compare.
 */
export function updatePeakFinderStars(force = false) {
    if (!context || !layer) {
        return;
    }
    const eye = context.eye();
    if (!eye) {
        return;
    }
    try {
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

/** What the chip shows for a tapped object, and where the ring follows it. */
function resolve(id: string): { selected: SelectedSky; locate: () => Horizontal | null } | null {
    const [kind, value] = id.split(':');
    const index = Number(value);
    if (kind === 'star' && STARS[index]) {
        const entry = STARS[index];
        return {
            selected: { id, kind: 'star', name: entry.name, detail: `${lc('star')} · ${lc('magnitude')} ${entry.mag}`, wikidata: entry.wikidata },
            locate: () => stars[index]?.horizontal ?? null
        };
    }
    if (kind === 'planet' && PLANETS[index]) {
        return {
            selected: { id, kind: 'planet', name: lc(PLANETS[index].key), detail: lc('planet'), wikidata: PLANETS[index].wikidata },
            locate: () => planets[index]?.horizontal ?? null
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
                    clickRadius: 1.5,
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
                clickRadius: 2.5,
                visible: false,
                metaData: { id: `constellation:${index}` }
            })
        );
        const label = addTo(
            layer,
            map.object('celestial', id(`stars.figure.label.${index}`), { type: 'label', text: entry.name, visible: false, clickable: true, metaData: { id: `constellation:${index}` } })
        );
        return { arc, label, ends: ends.filter((end) => end !== undefined), visible: false };
    });
    planets = PLANETS.map((entry, index) => {
        const object = addTo(
            layer,
            map.object('celestial', id(`stars.planet.${index}`), {
                type: 'sprite',
                screenSize: PLANET_SIZES[entry.key] * scale,
                softness: 0.4,
                clickRadius: 2.5,
                visible: false,
                metaData: { id: `planet:${index}` }
            })
        );
        return { object, label: name(`stars.planet.label.${index}`, lc(entry.key), `planet:${index}`, PLANET_SIZES[entry.key] / 2 + 3), horizontal: null, visible: false };
    });
    styledDark = null;
    highlighted = -1;
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
        ...figures.flatMap((figure) => [figure.arc, figure.label]),
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
        [peakFinderSelectedSky, () => applyHighlight()]
    ]
});

export const setupPeakFinderStars = lifecycle.setup;
export const teardownPeakFinderStars = lifecycle.teardown;
