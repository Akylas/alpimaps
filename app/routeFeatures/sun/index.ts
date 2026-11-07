import { derived, get } from 'svelte/store';
import { formatDistance, formatDuration } from '~/helpers/formatter';
import { formatTime, lc } from '~/helpers/locale';
import { routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
import { routeCoordinates } from '~/routeFeatures/lens/sections';
import { type LensChip, type LensFact, type LensHeadline, type RouteCtx, type RouteLens, registerRouteFeature } from '~/routeFeatures/registry';
import { sunLegend } from '~/routeFeatures/sun/legend';
import { sunPalette } from '~/routeFeatures/sun/palette';
import { type SunRead, readSun } from '~/routeFeatures/sun/read';
import { routeFeatureSun, sunGlareAngle, sunSettingRows, sunSettingsKey } from '~/routeFeatures/sun/settings';
import type { IItem } from '~/models/Item';

const MINUTE = 60000;

// the lens asks for the same read several times a refresh (chip, line, headline...): one per route state and minute
let memo: { item: IItem; analysis: unknown; minute: number; glare: number; read: SunRead | null };

function readOf(item: IItem): SunRead | null {
    const minute = Math.floor(Date.now() / MINUTE);
    const glare = get(sunGlareAngle);
    if (memo?.item !== item || memo.analysis !== item.analysis || memo.minute !== minute || memo.glare !== glare) {
        memo = { item, analysis: item.analysis, minute, glare, read: readSun(item, Date.now(), { glareBelow: glare }) };
    }
    return memo.read;
}

const timeOf = (read: SunRead, at: number) => formatTime(at, 'LT', read.offset);

function facts(read: SunRead): LensFact[] {
    const { darkMs, glareDistance, sunset } = read.summary;
    const result: LensFact[] = [];
    if (sunset) {
        result.push({ icon: 'mdi-weather-sunset-down', text: lc('sun_sunset_at', timeOf(read, sunset.at), formatDistance(sunset.distance)) });
    }
    if (darkMs > 0) {
        result.push({ icon: 'mdi-weather-night', text: lc('sun_dark_for', formatDuration(darkMs / 1000)) });
    }
    if (glareDistance > 0) {
        result.push({ icon: 'mdi-white-balance-sunny', text: lc('sun_glare_for', formatDistance(glareDistance)), alert: true });
    }
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
        return { value: read.summary.sunset ? timeOf(read, read.summary.sunset.at) : undefined, alert: read.summary.darkMs > 0 };
    },
    headline: ({ item }): LensHeadline => {
        const read = readOf(item);
        return { facts: read ? facts(read) : [] };
    },
    readout: ({ index, item }) => {
        const point = readOf(item)?.at(index);
        if (!point) {
            return undefined;
        }
        if (point.class === 'twilight' || point.class === 'night') {
            return lc(`sun_readout_${point.class}`);
        }
        return point.side ? lc('sun_readout', String(Math.round(point.altitude)), lc(`sun_side_${point.side}`)) : lc('sun_readout_up', String(Math.round(point.altitude)));
    },
    slices: ({ item }) => readOf(item)?.slices ?? [],
    legend: ({ palette, translate, variant }) => sunLegend({ palette, translate, variant })
};

registerRouteFeature({
    id: 'sun',
    order: 15,
    setting: { title: () => lc('lens_sun'), store: routeFeatureSun },
    settings: sunSettingRows,
    // a new departure or pace moves the ride in the sky, and so does the glare angle
    changes: derived([routeAnalysisChanges, sunSettingsKey], (values) => values.join()),
    lensPalette: sunPalette,
    lenses: [sunLens]
});
