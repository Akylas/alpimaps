import type { MassifLayer, MassifObject, Subscription } from '@nativescript-community/ui-massifmaps/api';
import { Screen } from '@nativescript/core';
import { getPosition } from 'suncalc';
import { get, writable } from 'svelte/store';
import { formatTime, lc } from '~/helpers/locale';
import { type PeakFinderSkyContext, addTo, celestialLifecycle, clearSkySelection, colour, listenToSkyClicks, refreshSkySelection, skyMoment } from '~/mapModules/features/peakFinderCelestial';
import { SUN_WIKIDATA } from '~/mapModules/features/sky/starCatalogue';
import { peakFinderElevation, peakFinderSun, peakFinderSunHours } from '~/stores/terrainStore';
import type { MapPos } from '~/utils/geo';

// Sky objects are depth-tested, so ridges hide the path; drawn as the whole day's circle, it runs into
// the terrain. Two layers because layer order is z order, labels included: the path under the summit
// names, the sun and its times over them.

const TO_DEGREES = 180 / Math.PI;
const TO_RADIANS = Math.PI / 180;
const SAMPLE_MINUTES = 2;
// Where the sun can meet the skyline: a little under the flat horizon (a skyline seen from high up is
// below it) to well above it (a valley's).
const LOW = -4;
const HIGH = 40;
const HORIZON_DISTANCE = 200000;
// also re-measured when the panorama goes idle: terrain keeps arriving for a while after a move
const IDLE_DEBOUNCE_MS = 300;

interface Sample {
    time: number;
    az: number;
    alt: number;
}

export interface SunPosition {
    azimuth: number;
    altitude: number;
}

/** Where the sun is, degrees: azimuth clockwise from north, geometric altitude. */
export function sunPositionAt(time: number, position: MapPos): SunPosition {
    const { altitude, azimuth } = getPosition(new Date(time), position.lat, position.lon);
    // suncalc's azimuth runs from the SOUTH, towards the west.
    return { azimuth: (azimuth * TO_DEGREES + 180 + 360) % 360, altitude: altitude * TO_DEGREES };
}

/** Where the air lifts the sun to (Saemundsson), so it is compared with an apparent skyline. */
function apparent(altitude: number) {
    return altitude + (altitude > -2 ? 1.02 / Math.tan((altitude + 10.3 / (altitude + 5.11)) * TO_RADIANS) / 60 : 0);
}

function dayStart(time: number) {
    const date = new Date(time);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/** The rise and set of the day drawn, over the terrain, for the settings row. ms, or null. */
export const peakFinderSunTimes = writable<{ rise: number; set: number }>({ rise: null, set: null });

let context: PeakFinderSkyContext = null;
// The map's terrain options as an object of our own, for calculateHorizon: the map's `terrain()` is a
// property group, which reads and writes but has no methods.
let terrain: MassifObject<'massif::TerrainOptions'> = null;
let sky: MassifLayer = null;
let skyTop: MassifLayer = null;
let path: MassifObject<'massif::CelestialArc'> = null;
let marks: MassifObject<'massif::CelestialArc'> = null;
let disc: MassifObject<'massif::CelestialSprite'> = null;
let glow: MassifObject<'massif::CelestialSprite'> = null;
let riseLabel: MassifObject<'massif::CelestialLabel'> = null;
let setLabel: MassifObject<'massif::CelestialLabel'> = null;
let hourLabels: MassifObject<'massif::CelestialLabel'>[] = [];
let samples: Sample[] = [];
let dayKey = '';
let planKey = '';
let lastSignature = '';
let styledDark: boolean = null;
let idleSubscription: Subscription = null;
let clickSubscription: Subscription = null;

function labelStyle(plate: boolean, dark: boolean) {
    if (plate) {
        return {
            fontName: 'sans-serif Bold',
            fontSize: 15,
            textColor: dark ? colour(251, 191, 36) : colour(146, 64, 14),
            backgroundColor: dark ? colour(24, 24, 27, 0.9) : colour(255, 255, 255, 0.9),
            backgroundRadius: 7,
            paddingX: 7,
            paddingY: 3,
            haloWidth: 0
        };
    }
    return {
        fontName: 'sans-serif Medium',
        fontSize: 13,
        textColor: dark ? colour(251, 191, 36) : colour(180, 83, 9),
        haloColor: dark ? colour(24, 24, 27, 0.95) : colour(255, 255, 255, 0.95),
        haloWidth: 4
    };
}

function applyStyles() {
    const dark = context.dark();
    if (dark === styledDark) {
        return;
    }
    styledDark = dark;
    for (const label of [riseLabel, setLabel]) {
        label.apply(labelStyle(true, dark));
    }
    for (const label of hourLabels) {
        label.apply(labelStyle(false, dark));
    }
    marks.set('color', dark ? colour(251, 191, 36) : colour(180, 83, 9));
}

function showLabel(label: MassifObject<'massif::CelestialLabel'>, text: string, sample?: { az: number; alt: number }) {
    if (!text || !sample) {
        label.set('visible', false);
        return;
    }
    label.set('text', text);
    label.call('setDirection', sample.az, sample.alt, 0);
    label.set('visible', true);
}

function planPath(eye: MapPos, time: number) {
    const start = dayStart(time);
    const key = `${start}|${eye.lat.toFixed(3)}|${eye.lon.toFixed(3)}`;
    if (key === dayKey) {
        return;
    }
    dayKey = key;
    samples = [];
    for (let minute = 0; minute <= 1440; minute += SAMPLE_MINUTES) {
        const sampleTime = start + minute * 60000;
        const { altitude, azimuth } = sunPositionAt(sampleTime, eye);
        samples.push({ time: sampleTime, az: azimuth, alt: apparent(altitude) });
    }
    path.call(
        'setDirections',
        samples.flatMap((sample) => [sample.az, sample.alt])
    );
}

/**
 * calculateHorizon is synchronous, so stay cheap: a coarse skyline (every 8 minutes, only where the sun
 * is low enough to meet it), then fine only across the interval where the sun crosses it.
 */
function planCrossings(eye: MapPos) {
    const eyeHeight = Math.max(0, get(peakFinderElevation));
    const skylineOf = (list: Sample[]): number[] => {
        if (!list.length || !terrain) {
            return list.map(() => -90);
        }
        const result = terrain.call(
            'calculateHorizon',
            [eye.lon, eye.lat],
            eyeHeight,
            list.map((sample) => sample.az),
            HORIZON_DISTANCE
        );
        return Array.from(result ?? []);
    };
    const step = 8 / SAMPLE_MINUTES;
    const coarse = samples.filter((sample, index) => index % step === 0 && sample.alt > LOW && sample.alt < HIGH);
    const coarseSkyline = skylineOf(coarse);
    const signature = `${planKey}|${coarseSkyline.map((value) => value.toFixed(2)).join(',')}`;
    if (signature === lastSignature) {
        return; // same skyline: nothing to move, and no redraw to set off another idle
    }
    lastSignature = signature;
    const coarseTimes = coarse.map((sample) => sample.time);
    const known = coarseSkyline.map((value) => (value > -90 ? value : 0));
    // Linear between the coarse measures; under LOW the sun is under any skyline, over HIGH above it.
    const skylineAt = (sample: Sample) => {
        let after = coarseTimes.findIndex((time) => time >= sample.time);
        if (after < 0) {
            after = coarseTimes.length - 1;
        }
        const before = Math.max(0, coarseTimes[after] === sample.time ? after : after - 1);
        const t0 = coarseTimes[before];
        const t1 = coarseTimes[after];
        const h0 = known[before] ?? 0;
        const h1 = known[after] ?? 0;
        return t1 === t0 ? h0 : h0 + ((h1 - h0) * (sample.time - t0)) / (t1 - t0);
    };
    const margin = (sample: Sample) => (sample.alt <= LOW ? -1 : sample.alt >= HIGH ? 1 : sample.alt - skylineAt(sample));

    let rise: Sample = null;
    let set: Sample = null;
    for (let index = step; index < samples.length; index += step) {
        const wasUp = margin(samples[index - step]) >= 0;
        if (wasUp === margin(samples[index]) >= 0) {
            continue;
        }
        // The crossing, measured finely: every sample of the interval against its own skyline.
        const fine = samples.slice(index - step, index + 1);
        const fineSkyline = skylineOf(fine);
        const fineMargin = fine.map((sample, k) => sample.alt - (fineSkyline[k] > -90 ? fineSkyline[k] : 0));
        let k = 1;
        while (k < fine.length - 1 && fineMargin[k] >= 0 === wasUp) {
            k++;
        }
        const m0 = fineMargin[k - 1];
        const m1 = fineMargin[k];
        const fraction = Math.max(0, Math.min(1, m0 / (m0 - m1 || 1)));
        const crossing: Sample = {
            time: fine[k - 1].time + fraction * (fine[k].time - fine[k - 1].time),
            az: fine[k - 1].az + fraction * (fine[k].az - fine[k - 1].az),
            alt: fine[k - 1].alt + fraction * (fine[k].alt - fine[k - 1].alt)
        };
        if (wasUp) {
            set = crossing;
        } else {
            rise = rise ?? crossing;
        }
    }
    showLabel(riseLabel, rise && `↑ ${formatTime(rise.time)}`, rise);
    showLabel(setLabel, set && `↓ ${formatTime(set.time)}`, set);
    const times = get(peakFinderSunTimes);
    if (times.rise !== (rise?.time ?? null) || times.set !== (set?.time ?? null)) {
        peakFinderSunTimes.set({ rise: rise?.time ?? null, set: set?.time ?? null });
    }

    // On the hour, a short stroke across the path and its time, where the sun is over the skyline
    // and not next to a rise or a set, whose own label is there.
    const hours = get(peakFinderSunHours);
    const ticks: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
        const sample = samples[(hour * 60) / SAMPLE_MINUTES];
        const next = samples[(hour * 60) / SAMPLE_MINUTES + 1];
        const clear = [rise, set].every((crossing) => !crossing || Math.abs(crossing.time - sample.time) > 40 * 60000);
        if (!hours || !clear || margin(sample) < 0.5) {
            showLabel(hourLabels[hour], null);
            continue;
        }
        showLabel(hourLabels[hour], formatTime(sample.time), sample);
        // Perpendicular to the path, a third of a degree each way.
        const dAz = (next.az - sample.az) * Math.cos(sample.alt * TO_RADIANS);
        const dAlt = next.alt - sample.alt;
        const length = Math.hypot(dAz, dAlt) || 1;
        const nAz = ((-dAlt / length) * 0.35) / Math.cos(sample.alt * TO_RADIANS);
        const nAlt = (dAz / length) * 0.35;
        ticks.push(sample.az - nAz, sample.alt - nAlt, sample.az + nAz, sample.alt + nAlt);
    }
    marks.call('setSegments', ticks);
}

let placed = { azimuth: NaN, altitude: NaN };
function placeSun(eye: MapPos, time: number) {
    const { altitude, azimuth } = sunPositionAt(time, eye);
    // Only a visible move: each write is a redraw, and a redraw ends in the idle that calls this again.
    if (Math.abs(azimuth - placed.azimuth) < 0.02 && Math.abs(altitude - placed.altitude) < 0.02) {
        return;
    }
    placed = { azimuth, altitude };
    for (const sprite of [disc, glow]) {
        sprite.call('setDirection', azimuth, apparent(altitude), 0);
        sprite.set('visible', altitude > -1.5);
    }
}

/** `force` re-measures the skyline even when nothing moved: the terrain under it may have. */
export function updatePeakFinderSun(force = false) {
    if (!context || !path) {
        return;
    }
    const eye = context.eye();
    if (!eye) {
        return;
    }
    try {
        applyStyles();
        const time = skyMoment();
        planPath(eye, time);
        const key = `${dayKey}|${eye.lat.toFixed(5)}|${eye.lon.toFixed(5)}|${get(peakFinderElevation).toFixed(1)}|${get(peakFinderSunHours)}`;
        if (force || key !== planKey) {
            planKey = key;
            planCrossings(eye);
        }
        placeSun(eye, time);
        refreshSkySelection();
    } catch (error) {
        DEV_LOG && console.log('peakFinder: sun', error);
    }
}

// Ids carry a generation: the sun switched off and back on builds again on the same map, which still
// holds the ids it registered.
let generation = 0;

function build(sunContext: PeakFinderSkyContext) {
    context = sunContext;
    const map = context.map;
    const scale = Screen.mainScreen.scale;
    generation += 1;
    const id = (name: string) => `${name}.${generation}`;
    sky = map.buildLayer(id('layer.sky'), { type: 'celestial' });
    // FIRST, so the terrain draws over the path...
    map.add(sky, 0);
    // ...and LAST, so the sun and its times read over the summit names.
    // Out of the post-process, so the outline's ink does not cross the rise and set labels sitting on
    // the ridge: drawn after the effect, over the lines.
    skyTop = map.buildLayer(id('layer.sky.top'), { type: 'celestial', postProcessed: false });
    map.add(skyTop);
    // Widths are device pixels.
    path = addTo(sky, map.object('celestial', id('sky.path'), { type: 'arc', color: colour(245, 158, 11, 0.82), width: 3 * scale, belowHorizonVisible: true }));
    marks = addTo(sky, map.object('celestial', id('sky.marks'), { type: 'arc', color: colour(180, 83, 9), width: 2 * scale, belowHorizonVisible: true }));
    // In pixels, not its real half degree: a marker for where the sun is, visible at any field of view.
    glow = addTo(skyTop, map.object('celestial', id('sky.glow'), { type: 'sprite', screenSize: 56 * scale, color: colour(251, 191, 36, 0.4), softness: 1 }));
    disc = addTo(skyTop, map.object('celestial', id('sky.sun'), { type: 'sprite', screenSize: 20 * scale, color: colour(245, 158, 11), softness: 0.15, clickRadius: 3, metaData: { id: 'sun' } }));
    // Anchored bottom-middle, so it stands above its point. Rise/set are lifted and drawn OVER the terrain:
    // the rendered terrain is flat where the times take the earth's curve, so the ridge draws a touch higher.
    const label = (name: string, lift: number) => {
        // Tapped like the sun itself.
        const created = addTo(skyTop, map.object('celestial', id(name), { type: 'label', visible: false, clickable: true, metaData: { id: 'sun' } }));
        created.call('setOffset', 0, lift);
        return created;
    };
    riseLabel = label('sky.rise', 14);
    setLabel = label('sky.set', 14);
    for (const sunLabel of [riseLabel, setLabel]) {
        sunLabel.set('occludedByMap', false);
    }
    hourLabels = Array.from({ length: 24 }, (unused, hour) => label(`sky.hour.${hour}`, 4));
    styledDark = null;
    terrain = map.child('terrainOptions');
    clickSubscription = listenToSkyClicks(skyTop, (clicked) =>
        clicked === 'sun'
            ? {
                  selected: { id: 'sun', kind: 'sun', name: lc('sun'), wikidata: SUN_WIKIDATA },
                  locate: () => {
                      const eye = context?.eye();
                      if (!eye) {
                          return null;
                      }
                      const { altitude, azimuth } = sunPositionAt(skyMoment(), eye);
                      return { azimuth, altitude: apparent(altitude) };
                  }
              }
            : null
    );
}

/** Keeps the sun's top layer over a rebuilt summit layer. */
export function raisePeakFinderSun() {
    if (!context || !skyTop) {
        return;
    }
    context.map.removeLayer(skyTop);
    context.map.add(skyTop);
}

function drop() {
    clearSkySelection(['sun']);
    idleSubscription?.remove();
    idleSubscription = null;
    clickSubscription?.remove();
    clickSubscription = null;
    for (const layer of [sky, skyTop]) {
        if (layer) {
            try {
                context?.map.removeLayer(layer);
            } catch (error) {
                DEV_LOG && console.log('peakFinder: sun layer', error);
            }
        }
    }
    // released now rather than with the panorama's map, so a sun switched off costs nothing
    for (const object of [sky, skyTop, path, marks, disc, glow, riseLabel, setLabel, ...hourLabels]) {
        object?.destroy();
    }
    sky = skyTop = null;
    terrain?.destroy();
    terrain = null;
    path = marks = disc = glow = riseLabel = setLabel = null;
    hourLabels = [];
    samples = [];
    dayKey = planKey = lastSignature = '';
    placed = { azimuth: NaN, altitude: NaN };
    peakFinderSunTimes.set({ rise: null, set: null });
    context = null;
}

const lifecycle = celestialLifecycle({
    enabled: peakFinderSun,
    // The sun moves a quarter of a degree a minute.
    clockMs: 60000,
    start(sunContext) {
        build(sunContext);
        idleSubscription = context.map.onIdle(() => updatePeakFinderSun(true), { debounce: IDLE_DEBOUNCE_MS });
    },
    update: updatePeakFinderSun,
    drop,
    triggers: [
        [peakFinderSunHours, () => updatePeakFinderSun(true)],
        [peakFinderElevation, () => updatePeakFinderSun()]
    ]
});

export const setupPeakFinderSun = lifecycle.setup;
export const teardownPeakFinderSun = lifecycle.teardown;
