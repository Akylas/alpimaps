/** The rows of the weather card of the route page. Pure: nothing here may import NativeScript. */
import type { WeatherAttribution } from '~/utils/routeAnalysis/weatherProvider';
import type { RideRow, WeatherRead, WeatherSummary } from './read';

export type WeatherRowData =
    | { type: 'summary'; summary: WeatherSummary }
    /** the header of the samples, which are listed only while it is open */
    | { type: 'details'; open: boolean; count: number }
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
