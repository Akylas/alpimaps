import type { MassifLayer, MassifObject } from '@nativescript-community/ui-massifmaps/api';
import { Canvas, Paint, Path, Style } from '@nativescript-community/ui-canvas';
import { ImageSource, Screen, path as filePath, knownFolders } from '@nativescript/core';
import { getMoonIllumination, getMoonPosition } from 'suncalc';
import { lc } from '~/helpers/locale';
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
import { sunPositionAt } from '~/mapModules/features/peakFinderSun';
import { direction } from '~/mapModules/features/sky/astronomy';
import { MOON_WIKIDATA } from '~/mapModules/features/sky/starCatalogue';
import { peakFinderMoon } from '~/stores/terrainStore';
import type { MapPos } from '~/utils/geo';

// Celestial layer under the terrain: sky objects are depth-tested, so a ridge hides the moon.

const TO_DEGREES = 180 / Math.PI;
const TO_RADIANS = Math.PI / 180;
const PATH_STEP_DEGREES = 1;
const PATH_REPLAN_MS = 10 * 60000;
const BITMAP_SIZE = 96;

let context: PeakFinderSkyContext = null;
let layer: MassifLayer = null;
let path: MassifObject<'massif::CelestialArc'> = null;
let disc: MassifObject<'massif::CelestialSprite'> = null;
let dayKey = '';
let bitmapKey = '';
let styledDark: boolean = null;
let clickSubscription: SkyClicks = null;
let generation = 0;

function moonPositionAt(time: number, eye: MapPos) {
    // Refraction included by suncalc. Its azimuth runs from the SOUTH, towards the west.
    const { altitude, azimuth } = getMoonPosition(new Date(time), eye.lat, eye.lon);
    return { azimuth: (azimuth * TO_DEGREES + 180 + 360) % 360, altitude: altitude * TO_DEGREES };
}

/**
 * Lit limb direction on screen, degrees clockwise from up. The sprite is screen-aligned and the
 * panorama never rolls, so screen up is the zenith's side.
 */
function litLimbAngle(moon: [number, number, number], sun: [number, number, number]) {
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const along = (vector: [number, number, number]) => {
        const projection = dot(vector, moon);
        return [vector[0] - projection * moon[0], vector[1] - projection * moon[1], vector[2] - projection * moon[2]];
    };
    const toSun = along(sun);
    const up = along([0, 0, 1]);
    // moon x zenith: to the right when facing the moon.
    const right = [moon[1], -moon[0], 0];
    return Math.atan2(dot(toSun, right), dot(toSun, up)) * TO_DEGREES;
}

/** The phase, drawn: the lit side pointing `angle` degrees clockwise from up, `fraction` of it lit. */
function moonBitmapUrl(fraction: number, angle: number, dark: boolean) {
    const key = `${dark ? 'd' : 'l'}.${Math.round(fraction * 50)}.${Math.round(angle / 3)}`;
    if (key === bitmapKey) {
        return null;
    }
    bitmapKey = key;
    const size = BITMAP_SIZE;
    const radius = size * 0.46;
    const canvas = new Canvas(size, size);
    const paint = new Paint();
    paint.setAntiAlias(true);
    paint.setStyle(Style.FILL);
    canvas.translate(size / 2, size / 2);
    canvas.rotate(angle - 90);
    // Lit towards +x: the limb's half circle, back along the terminator, a half ellipse.
    const lit = new Path();
    const steps = 32;
    for (let step = 0; step <= steps; step++) {
        const theta = -Math.PI / 2 + (Math.PI * step) / steps;
        const x = radius * Math.cos(theta);
        const y = radius * Math.sin(theta);
        if (step === 0) {
            lit.moveTo(x, y);
        } else {
            lit.lineTo(x, y);
        }
    }
    for (let step = steps; step >= 0; step--) {
        const theta = -Math.PI / 2 + (Math.PI * step) / steps;
        lit.lineTo((1 - 2 * fraction) * radius * Math.cos(theta), radius * Math.sin(theta));
    }
    lit.close();
    // The lit part alone, the rest transparent: a faint dark side hid a thin crescent on e-ink.
    paint.setColor(dark ? '#f1f5f9' : '#94a3b8');
    canvas.drawPath(lit, paint);
    if (!dark) {
        // A pale moon on white paper needs an edge.
        paint.setStyle(Style.STROKE);
        paint.setStrokeWidth(size * 0.03);
        paint.setColor('#334155');
        canvas.drawPath(lit, paint);
    }
    const file = filePath.join(knownFolders.temp().path, `peakFinderMoon.${key.replace('-', 'm')}.png`);
    new ImageSource(canvas.getImage()).saveToFile(file, 'png');
    return `file://${file}`;
}

/**
 * The moon's direction swept once round the celestial pole, like a star's: its real path never closes
 * (~50 minutes later each day), so a day of it would leave a gap.
 */
function planPath(eye: MapPos, time: number) {
    const centre = Math.round(time / PATH_REPLAN_MS) * PATH_REPLAN_MS;
    const key = `${centre}|${eye.lat.toFixed(3)}|${eye.lon.toFixed(3)}`;
    if (key === dayKey) {
        return;
    }
    dayKey = key;
    const moon = moonPositionAt(centre, eye);
    const vector = direction(moon.azimuth, moon.altitude);
    const latitude = eye.lat * TO_RADIANS;
    const pole = [0, Math.cos(latitude), Math.sin(latitude)];
    const along = pole[0] * vector[0] + pole[1] * vector[1] + pole[2] * vector[2];
    // pole x vector
    const cross = [pole[1] * vector[2] - pole[2] * vector[1], pole[2] * vector[0] - pole[0] * vector[2], pole[0] * vector[1] - pole[1] * vector[0]];
    const directions: number[] = [];
    for (let degree = 0; degree <= 360; degree += PATH_STEP_DEGREES) {
        const angle = degree * TO_RADIANS;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // Rodrigues: the vector turned by `angle` about the pole.
        const [east, north, up] = [0, 1, 2].map((axis) => vector[axis] * cos + cross[axis] * sin + pole[axis] * along * (1 - cos));
        directions.push((Math.atan2(east, north) * TO_DEGREES + 360) % 360, Math.asin(Math.max(-1, Math.min(1, up))) * TO_DEGREES);
    }
    path.call('setDirections', directions);
}

function placeMoon(eye: MapPos, time: number, dark: boolean) {
    const moon = moonPositionAt(time, eye);
    const sun = sunPositionAt(time, eye);
    const { fraction } = getMoonIllumination(new Date(time));
    const url = moonBitmapUrl(fraction, litLimbAngle(direction(moon.azimuth, moon.altitude), direction(sun.azimuth, sun.altitude)), dark);
    if (url) {
        disc.set('bitmap', { type: 'url', url });
    }
    disc.call('setDirection', moon.azimuth, moon.altitude, 0);
    disc.set('visible', moon.altitude > -1);
}

export function updatePeakFinderMoon() {
    if (!context || !path) {
        return;
    }
    const eye = context.eye();
    if (!eye) {
        return;
    }
    try {
        const dark = context.dark();
        if (dark !== styledDark) {
            styledDark = dark;
            path.set('color', dark ? colour(203, 213, 225, 0.7) : colour(71, 85, 105, 0.7));
        }
        const time = skyMoment();
        planPath(eye, time);
        placeMoon(eye, time, dark);
        refreshSkySelection();
    } catch (error) {
        DEV_LOG && console.log('peakFinder: moon', error);
    }
}

function build(moonContext: PeakFinderSkyContext) {
    context = moonContext;
    const map = context.map;
    const scale = Screen.mainScreen.scale;
    generation += 1;
    const id = (name: string) => `${name}.${generation}`;
    layer = map.buildLayer(id('layer.moon'), { type: 'celestial' });
    // First, so the terrain draws over it.
    map.add(layer, 0);
    path = map.object('celestial', id('moon.path'), { type: 'arc', color: colour(203, 213, 225, 0.7), width: 2 * scale, belowHorizonVisible: true });
    // In pixels, not its real half degree, like the sun: a marker visible at any field of view.
    disc = map.object('celestial', id('moon.disc'), { type: 'sprite', screenSize: 26 * scale, color: colour(255, 255, 255), clickRadius: 3, metaData: { id: 'moon' } });
    addTo(layer, path);
    addTo(layer, disc);
    clickSubscription = listenToSkyClicks(layer, (clicked) =>
        clicked === 'moon'
            ? {
                  selected: { id: 'moon', kind: 'moon', name: lc('moon'), wikidata: MOON_WIKIDATA },
                  locate: () => {
                      const eye = context?.eye();
                      if (!eye) {
                          return null;
                      }
                      return moonPositionAt(skyMoment(), eye);
                  }
              }
            : null
    );
}

function drop() {
    clearSkySelection(['moon']);
    clickSubscription?.remove();
    clickSubscription = null;
    if (layer) {
        try {
            context?.map.removeLayer(layer);
        } catch (error) {
            DEV_LOG && console.log('peakFinder: moon layer', error);
        }
    }
    for (const object of [layer, path, disc]) {
        object?.destroy();
    }
    layer = path = disc = null;
    dayKey = bitmapKey = '';
    styledDark = null;
    context = null;
}

const lifecycle = celestialLifecycle({
    enabled: peakFinderMoon,
    clockMs: 60000,
    start: build,
    update: () => updatePeakFinderMoon(),
    drop
});

export const setupPeakFinderMoon = lifecycle.setup;
export const teardownPeakFinderMoon = lifecycle.teardown;
