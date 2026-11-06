/** The rows of the weather card of the route page. Pure: nothing here may import NativeScript. */
import type { WeatherAttribution } from '~/routeFeatures/weather/providers/provider';
import type { RideRow, WeatherRead, WeatherSummary } from '~/routeFeatures/weather/data/read';

export type WeatherRowData =
    | { type: 'summary'; summary: WeatherSummary }
    /** the header of the samples, which are listed only while it is open */
    | { type: 'details'; open: boolean; count: number }
    /** the titles of the columns of the samples */
    | { type: 'columns' }
    | { type: 'ride'; row: RideRow }
    | { type: 'footer'; provider: string; attribution: WeatherAttribution; updatedAt: number; decimals: number; outdated: boolean; canUpdate: boolean }
    /** nothing fetched: what the first fetch sends, or why it cannot be asked */
    | { type: 'fetch'; state: 'absent' | 'running' | 'failed' | 'offline'; points: number; decimals: number; provider: string };

export interface WeatherRowsInput {
    read: Pick<WeatherRead, 'rows' | 'summary'> | null;
    footer: Omit<Extract<WeatherRowData, { type: 'footer' }>, 'type'>;
    fetch: Omit<Extract<WeatherRowData, { type: 'fetch' }>, 'type'>;
    detailsOpen: boolean;
}

/** What the card lists: the summary, the header of the samples and, while it is open, a row for each in the order of the ride, then where the forecast comes from. Without a forecast, how to ask for one. */
export function weatherRows({ detailsOpen, fetch, footer, read }: WeatherRowsInput): { key: string; data: WeatherRowData }[] {
    if (!read) {
        return [{ key: 'fetch', data: { type: 'fetch', ...fetch } }];
    }
    return [
        { key: 'summary', data: { type: 'summary', summary: read.summary } },
        { key: 'details', data: { type: 'details', open: detailsOpen, count: read.rows.length } },
        ...(detailsOpen ? [{ key: 'columns', data: { type: 'columns' as const } }] : []),
        ...(detailsOpen ? read.rows.map((row) => ({ key: `ride${row.index}`, data: { type: 'ride' as const, row } })) : []),
        { key: 'footer', data: { type: 'footer', ...footer } }
    ];
}

const BLUE = '#4A90D9';
const BLUE_DARK = '#1565C0';
const COLD = '#3F8FE0';
const WARM = '#F29D38';
const HOT = '#D7263D';

/** Rain as the profile draws it: blue, darker from 4 mm/h. None for dry. */
export function rainColor(mmPerHour: number): string | undefined {
    return mmPerHour < 0.1 ? undefined : mmPerHour >= 4 ? BLUE_DARK : BLUE;
}

/** Only the cold (freezing or under) and the heat (from 25 degrees) have a colour: the rest is neutral. */
export function tempColor(celsius: number): string | undefined {
    return celsius <= 0 ? COLD : celsius >= 33 ? HOT : celsius >= 25 ? WARM : undefined;
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
