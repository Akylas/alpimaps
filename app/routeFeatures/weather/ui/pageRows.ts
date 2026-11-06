/** The rows of the weather card of the route page. Pure: nothing here may import NativeScript. */
import type { WeatherAttribution } from '~/routeFeatures/weather/providers/provider';
import type { RideRow, WeatherRead, WeatherSummary } from '~/routeFeatures/weather/data/read';
import { CLOUD_GRAY, RAIN_BLUE, SUNNY_CLOUD, SUN_COLOR } from '~/routeFeatures/weather/ui/colors';

export type WeatherRowData =
    | { type: 'summary'; summary: WeatherSummary }
    /** the samples of the ride, side by side */
    | { type: 'strip'; rows: RideRow[] }
    | { type: 'footer'; attribution: WeatherAttribution; updatedAt: number; outdated: boolean; canUpdate: boolean }
    /** nothing fetched: what the first fetch sends, or why it cannot be asked */
    | { type: 'fetch'; state: 'absent' | 'running' | 'failed' | 'offline'; points: number; decimals: number; provider: string };

export interface WeatherRowsInput {
    read: Pick<WeatherRead, 'rows' | 'summary'> | null;
    footer: Omit<Extract<WeatherRowData, { type: 'footer' }>, 'type'>;
    fetch: Omit<Extract<WeatherRowData, { type: 'fetch' }>, 'type'>;
}

/** What the card lists: the summary, the strip of the samples in the order of the ride, then where the forecast comes from. Without a forecast, how to ask for one. */
export function weatherRows({ fetch, footer, read }: WeatherRowsInput): { key: string; data: WeatherRowData }[] {
    if (!read) {
        return [{ key: 'fetch', data: { type: 'fetch', ...fetch } }];
    }
    return [
        { key: 'summary', data: { type: 'summary', summary: read.summary } },
        { key: 'strip', data: { type: 'strip', rows: read.rows } },
        { key: 'footer', data: { type: 'footer', ...footer } }
    ];
}

/** km/h under which there is no wind to speak of */
const CALM = 3;

export interface WindLabel {
    kind: 'head' | 'tail' | 'cross' | 'calm';
    /** km/h of the part of the wind the label is about */
    value: number;
    /** a crosswind: the side it blows to, the way the ride goes */
    side?: 'left' | 'right';
}

/**
 * What the wind is to the rider, in a word and a figure: against, behind or across, whichever is most of it. `head` is the part along the
 * ride, above 0 against, `cross` the part across it, above 0 from the right.
 */
export function windLabel(speed: number | undefined, head: number | undefined, cross: number | undefined): WindLabel | undefined {
    if (speed === undefined || head === undefined || cross === undefined) {
        return undefined;
    }
    if (speed < CALM) {
        return { kind: 'calm', value: 0 };
    }
    if (Math.abs(cross) > Math.abs(head)) {
        return { kind: 'cross', value: Math.round(Math.abs(cross)), side: cross > 0 ? 'left' : 'right' };
    }
    return { kind: head > 0 ? 'head' : 'tail', value: Math.round(Math.abs(head)) };
}

/** mm/h from which the rain is heavy, as the colours of the rain have it */
const HEAVY_RAIN = 4;
/** % of cloud from which a dry ride is cloudy */
const CLOUDY = 70;

/** The sky of a ride in one word: the storm, the rain, or the sky of a dry one. */
export type SkyId = 'sunny' | 'partly' | 'cloudy' | 'rainy' | 'pouring' | 'storm';

export function skyId(summary: WeatherSummary): SkyId {
    if (summary.thunder) {
        return 'storm';
    }
    if (summary.rainPeak) {
        return summary.rainPeak.mmPerHour >= HEAVY_RAIN ? 'pouring' : 'rainy';
    }
    const cloud = summary.cloud ?? 0;
    return cloud < SUNNY_CLOUD ? 'sunny' : cloud < CLOUDY ? 'partly' : 'cloudy';
}

/** The glyph of each sky and the colour of what it is, the sun and the rain as plain as the cloud: the marks of a departure. */
export const SKY_MARKS: Record<SkyId, { icon: string; color: string }> = {
    sunny: { icon: 'mdi-weather-sunny', color: SUN_COLOR },
    partly: { icon: 'mdi-weather-partly-cloudy', color: CLOUD_GRAY },
    cloudy: { icon: 'mdi-weather-cloudy', color: CLOUD_GRAY },
    rainy: { icon: 'mdi-weather-rainy', color: RAIN_BLUE },
    pouring: { icon: 'mdi-weather-pouring', color: RAIN_BLUE },
    storm: { icon: 'mdi-weather-lightning-rainy', color: RAIN_BLUE }
};

/** The glyph that says the ride in one. */
export function heroGlyph(summary: WeatherSummary): string {
    return SKY_MARKS[skyId(summary)].icon;
}

/** mm/h under which there is no rain to speak of at a sample */
const DRY = 0.1;

/** The sun is what a sample says: by day, a clear sky and no rain. */
export function isClearSky({ cloud, code, moon, precip }: { cloud?: number; code?: number; moon?: string; precip: number }): boolean {
    return !moon && precip < DRY && (cloud !== undefined ? cloud < SUNNY_CLOUD : code === 0);
}
