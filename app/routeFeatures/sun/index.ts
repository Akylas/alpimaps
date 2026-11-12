import { derived, get } from 'svelte/store';
import { formatDistance, formatDuration } from '~/helpers/formatter';
import { formatTime, lc } from '~/helpers/locale';
import { computeLayers, layerStatuses, routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
import { currentLensPalette, lensVariantStore } from '~/routeFeatures/lens/lensStyle';
import { routeCoordinates } from '~/routeFeatures/lens/sections';
import {
    type LensChip,
    type LensFact,
    type LensHeadline,
    type LensProfile,
    type RouteCtx,
    type RouteDeparture,
    type RouteLens,
    type RoutePageSection,
    type TripChip,
    type TripFigures,
    registerRouteFeature
} from '~/routeFeatures/registry';
import { type SunChip, eventChip, figureChip } from '~/routeFeatures/sun/chips';
import { SUN_COLORS } from '~/routeFeatures/sun/colors';
import { explainChip } from '~/routeFeatures/sun/explain';
import { sunLegend } from '~/routeFeatures/sun/legend';
import { sunSymbols } from '~/routeFeatures/sun/symbols';
import { sunPalette } from '~/routeFeatures/sun/palette';
import { sunProfileOverlay } from '~/routeFeatures/sun/profileOverlay';
import { SUN_CLASS_ORDER, SUN_PALETTE_KEYS, type SunRead, readSun } from '~/routeFeatures/sun/read';
import { sunRows } from '~/routeFeatures/sun/rows';
import { freshTerrain } from '~/routeFeatures/sun/terrain/layer';
import { type TerrainPhase, terrainPhase } from '~/routeFeatures/sun/terrain/phase';
import { terrainShadeAvailable } from '~/routeFeatures/sun/terrain/service';
import { sunStage } from '~/routeFeatures/sun/terrain/stage';
import { sunTrip } from '~/routeFeatures/sun/trip';
import '~/routeFeatures/sun/sunMode';
import { mapCapabilities } from '~/mapModules/CustomLayersModule';
import { routeFeatureSun, sunGlareAngle, sunMoonMin, sunSettingRows, sunSettingsKey, sunTerrain } from '~/routeFeatures/sun/settings';
import type { IItem } from '~/models/Item';
import { utcOffsetAt } from '~/utils/timezone';
import { weakMemo } from '~/utils/weakMemo';

const MINUTE = 60000;

// the lens asks for the same read several times a refresh (chip, line, headline...): one per route state and minute
let memo: { item: IItem; analysis: unknown; key: string; read: SunRead | null };

function readOf(item: IItem): SunRead | null {
    const glare = get(sunGlareAngle);
    const moon = get(sunMoonMin);
    const terrain = get(sunTerrain);
    const key = [Math.floor(Date.now() / MINUTE), glare, moon, terrain].join();
    if (memo?.item !== item || memo.analysis !== item.analysis || memo.key !== key) {
        // the shade of the terrain is of the ride as the inputs time it: a layer of another departure is not read
        memo = {
            item,
            analysis: item.analysis,
            key,
            read: readSun(item, Date.now(), { glareBelow: glare, moonMin: moon, zoneOffset: utcOffsetAt, terrain: terrain ? freshTerrain(item.analysis) : undefined })
        };
    }
    return memo.read;
}

// the same object while the read is: the chart redraws for a new one
const profileOf = weakMemo(
    (read: SunRead): LensProfile => ({ fade: true, legend: profileLegend(), overlay: sunProfileOverlay(read, (isEInk) => currentLensPalette(isEInk ? 'eink' : get(lensVariantStore))) })
);

/** The line under the profile: what the ribbon's colours mean, and their greys on e-ink. */
function profileLegend() {
    const light = currentLensPalette('light');
    const eink = currentLensPalette('eink');
    return SUN_CLASS_ORDER.map((sunClass) => ({ label: lc(`legend_sun_${sunClass}`), color: light[SUN_PALETTE_KEYS[sunClass]], eink: eink[SUN_PALETTE_KEYS[sunClass]] }));
}

const timeOf = (read: SunRead, at: number) => formatTime(at, 'LT', read.offsetAt(at));

function phaseOf(item: IItem): TerrainPhase {
    return terrainPhase({ available: terrainShadeAvailable(), enabled: get(sunTerrain), state: layerStatuses(item).sun.state, hasLayer: !!item.analysis?.layers.sun });
}

const computeSun = (item: IItem) => computeLayers(item, ['sun']);

const CHIP_STATES: Partial<Record<TerrainPhase, LensChip['state']>> = { running: 'running', update: 'outdated', failed: 'missing' };
const SHADE_ACTIONS: Partial<Record<TerrainPhase, string>> = { compute: 'sun_compute_shade', update: 'sun_update_shade', failed: 'sun_update_shade' };

/** What the terrain adds to the figures: how far of the ride is in its shade, how much of it was read, and where it stands. */
function terrainFacts(item: IItem, read: SunRead, phase: TerrainPhase): LensFact[] {
    switch (phase) {
        case 'running':
            return [{ icon: 'mdi-image-filter-hdr', text: lc('sun_computing') }];
        case 'failed':
            return [{ icon: 'mdi-image-filter-hdr', text: lc('sun_terrain_failed'), alert: true }];
        default: {
            const result: LensFact[] = [];
            const coverage = item.analysis?.layers.sun?.data.coverage;
            if (read.shaded && coverage !== undefined && coverage < 1) {
                result.push({ icon: 'mdi-image-filter-hdr', text: lc('sun_terrain_coverage', Math.round(coverage * 100) + ' %') });
            }
            return result;
        }
    }
}

const factOf = ({ alert, color, icon, text }: SunChip): LensFact => ({ icon, text, color, alert });

function facts(item: IItem, read: SunRead): LensFact[] {
    const { darkMs, glareDistance, moonlitMs, sunrise, sunset } = read.summary;
    const result: LensFact[] = [];
    // each a figure in its colour, the icon saying what it is: the words would only widen the chip
    if (sunrise) {
        result.push(factOf(eventChip({ id: 'sunrise', at: sunrise.at, relation: 'during', distance: sunrise.distance }, (at) => timeOf(read, at))));
    }
    if (sunset) {
        result.push(factOf(eventChip({ id: 'sunset', at: sunset.at, relation: 'during', distance: sunset.distance }, (at) => timeOf(read, at))));
    }
    if (darkMs > 0) {
        result.push(factOf(figureChip('dark', darkMs)));
    }
    if (moonlitMs > 0) {
        result.push(factOf(figureChip('moonlit', moonlitMs)));
    }
    if (glareDistance > 0) {
        result.push(factOf(figureChip('glare', glareDistance)));
    }
    result.push(...terrainFacts(item, read, phaseOf(item)));
    return result.length ? result : [{ icon: 'mdi-white-balance-sunny', text: lc('sun_daylight') }];
}

const sunLens: RouteLens = {
    id: 'sun',
    icon: 'mdi-white-balance-sunny',
    label: () => lc('lens_sun'),
    available: ({ item }: RouteCtx) => !!item?.route && routeCoordinates(item.geometry).length > 1,
    chip: ({ item }): LensChip => {
        const read = readOf(item);
        if (!read) {
            return {};
        }
        // dark before the end of the ride is the serious figure; else the sunset, when it is on the way
        const phase = phaseOf(item);
        return {
            value: read.summary.sunset ? timeOf(read, read.summary.sunset.at) : undefined,
            alert: read.summary.darkMs > 0,
            state: CHIP_STATES[phase]
        };
    },
    headline: ({ item }): LensHeadline => {
        const read = readOf(item);
        if (!read) {
            return { facts: [] };
        }
        const phase = phaseOf(item);
        const label = SHADE_ACTIONS[phase];
        return { facts: facts(item, read), action: label ? { label: lc(label), run: () => computeSun(item) } : undefined };
    },
    // the user asks for the shade again, from the long press menu
    refresh: ({ item }) => {
        const phase = phaseOf(item);
        return phase === 'off' || phase === 'running' ? undefined : computeSun(item);
    },
    readout: ({ index, item }) => {
        const point = readOf(item)?.at(index);
        if (!point) {
            return undefined;
        }
        if (point.class === 'twilight' || point.class === 'moonlit' || point.class === 'night') {
            return lc(`sun_readout_${point.class}`);
        }
        return point.side ? lc('sun_readout', String(Math.round(point.altitude)), lc(`sun_side_${point.side}`)) : lc('sun_readout_up', String(Math.round(point.altitude)));
    },
    profile: ({ item }): LensProfile => {
        const read = readOf(item);
        if (!read) {
            return {};
        }
        return profileOf(read);
    },
    slices: ({ item }) => readOf(item)?.slices ?? [],
    // where the sun goes down and rises on the ride, at the time it does there
    symbols: ({ item }) => {
        const read = readOf(item);
        return read ? sunSymbols(read, (at) => timeOf(read, at)) : [];
    },
    legend: ({ palette, translate, variant }) => sunLegend({ palette, translate, variant })
};

const sunPageSection: RoutePageSection = {
    id: 'sun',
    icon: 'mdi-white-balance-sunny',
    title: () => lc('lens_sun'),
    lens: 'sun',
    facts: ({ item }) => {
        const read = readOf(item);
        return read ? facts(item, read) : [];
    },
    // the preview needs the 3D map, which needs a terrain
    rows: ({ item }) => sunRows(readOf(item), { preview: get(mapCapabilities).hasTerrain }),
    component: () => import('~/routeFeatures/sun/SunRow.svelte')
};

/** The sun's say under the tiles: its events as chips, the moon's lit part after them, and a line for where the sun goes down and how long it is dark. */
const tripOf = weakMemo((read: SunRead): TripFigures => {
    const trip = sunTrip(read);
    const eventChips = (ids: string[]): TripChip[] => trip.events.filter((event) => ids.includes(event.id)).map((event) => eventChip(event, (at) => timeOf(read, at)));
    const chips: TripChip[] = [
        ...eventChips(['sunrise', 'sunset']),
        ...(trip.moon
            ? [{ key: 'moon', icon: trip.moon.glyph, text: `${trip.moon.illumination}%`, color: SUN_COLORS.moon, help: explainChip({ kind: 'moon', length: `${trip.moon.illumination} %` }, lc) }]
            : []),
        ...eventChips(['moonrise', 'moonset'])
    ];
    const notes = trip.events.flatMap((event) =>
        event.relation === 'during' && (event.id === 'sunrise' || event.id === 'sunset') ? [lc(`sun_trip_${event.id}`, formatDistance(event.distance))] : []
    );
    if (trip.darkMs > 0) {
        notes.push(lc('sun_dark_for', formatDuration(trip.darkMs / 1000)));
    }
    return { chips, note: notes.join(' · ') };
});

// a departure the user took, or a pace that settled, moves the ride in the sky: the shade that was read is read again, once there is one
const readShadeAgain = ({ item }: RouteCtx) => {
    if (item.analysis?.layers.sun && phaseOf(item) === 'update') {
        computeSun(item);
    }
};
const sunDeparture: RouteDeparture = {
    indicators: {},
    assess: () => undefined,
    taken: readShadeAgain,
    paced: readShadeAgain
};

registerRouteFeature({
    id: 'sun',
    order: 15,
    setting: { title: () => lc('lens_sun'), store: routeFeatureSun },
    settings: sunSettingRows,
    // a new departure or pace moves the ride in the sky, and so does the glare angle
    changes: derived([routeAnalysisChanges, sunSettingsKey, derived(mapCapabilities, (capabilities) => capabilities.hasTerrain)], (values) => values.join()),
    lensPalette: sunPalette,
    lenses: [sunLens],
    trip: ({ item }) => {
        const read = readOf(item);
        return read ? tripOf(read) : {};
    },
    departure: sunDeparture,
    compute: sunStage,
    pageSections: [sunPageSection]
});
