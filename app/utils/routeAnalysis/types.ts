/** The route analysis model. Pure types: nothing here may import NativeScript. */

export type LayerId = 'terrain' | 'risk' | 'weather' | 'sun';

export const LAYER_IDS: LayerId[] = ['terrain', 'risk', 'weather', 'sun'];

export interface Activity {
    kind: 'hike' | 'bike' | 'motor';
    subtype?: 'walk' | 'run' | 'road' | 'gravel' | 'normal' | 'mountain' | 'enduro';
    /** `route`: derived from the computed route. `user`: picked by the user, wins over the route. */
    origin: 'route' | 'user';
}

export interface Departure {
    mode: 'now' | 'planned' | 'recorded';
    /** epoch ms. In `now` mode: absent while the ride floats with the clock, else the stamp of the last time the user pressed now or a layer was read, which the ride keeps */
    at?: number;
    /** multi-day: day k starts at `days[k].startAt` and moves at most `maxHours`; day 0 is `at` */
    days?: { startAt: number; maxHours?: number }[];
    /** a planned departure that went by, which the user kept: the ride is read at its own time, not moved to now */
    keepPast?: boolean;
    /** IANA zone of the route start. From the first weather response, else the phone zone, flagged */
    tz?: string;
    /** minutes east of UTC in that zone, from the same response: the runtime has no zone database (no `Intl`) */
    utcOffset?: number;
    tzFromPhone?: boolean;
}

export interface Pace {
    /** 0.8 .. 1.3, above 1 is slower */
    multiplier: number;
    stopsMinPerHour: number;
    model: 'proportional' | 'valhalla' | 'gradeAware' | 'recorded';
}

export interface AnalysisInputs {
    activity?: Activity;
    departure: Departure;
    pace: Pace;
    /** Any geometry edit changes it, see `geometryKey` */
    geometryKey: string;
}

export interface Provenance {
    computedAt: number;
    /** hash of exactly the inputs this layer depends on */
    inputsHash: string;
    /** 'valhalla-offline@3.8.3' | 'open-meteo/forecast' | 'massif-sdk/routeSun' */
    provider: string;
    source?: 'forecast' | 'historical-forecast' | 'archive-era5' | 'recorded';
    /** weather: model name(s) and run init time, when the provider reports it */
    modelRun?: string;
    /** terrain / risk / sun: DEM source id, routing package date, tiles build */
    dataVersion?: string;
    /** time window the data is valid for (weather: first and last hour, epoch s) */
    coverage?: { from: number; to: number };
    quality: 'ok' | 'partial' | 'estimated';
}

export interface Layer<T> {
    prov: Provenance;
    data: T;
    /** a past ride's frozen snapshot: never ages, refreshed only on request */
    pinned?: boolean;
}

/** infra: 0 none, 1 shared, 2 painted lane, 4 separated */
export interface RiskRun {
    start: number;
    end: number;
    startDist: number;
    length: number;
    speed: number;
    infra: 0 | 1 | 2 | 4;
    shoulder?: boolean;
}

export interface WeatherData {
    /** profile vertex index and distance of each sample; coordinates are re-derived from the geometry */
    samples: { i: number; d: number; alt: number }[];
    /** hour-aligned, UTC seconds; `n` hours per sample */
    t0: number;
    n: number;
    /** quantised ints [sample][hour]: temp x10, precip x10 (mm), wind x10 (km/h), gust x10, dir deg, cloud %, code, freezing level (m), dni (W/m2) */
    v: Record<'temp' | 'precip' | 'precipProb' | 'wind' | 'gust' | 'dir' | 'cloud' | 'code' | 'fl' | 'dni', number[][]>;
    request: { decimals: 1 | 2; vars: string[]; models: string };
    /** the zone of the route start and its offset then, in minutes east of UTC: the departure keeps them (`withRouteTimeZone`) */
    tz?: string;
    utcOffset?: number;
}

export interface SunData {
    /** metres between samples */
    step: number;
    /** 0..100 geometric lit % per sample, terrain only, -1 where there is no ground to read it from; absent: astronomy-only layer */
    lit?: number[];
    /** the samples the answer is weaker for: the SDK's status bits (no ground, coarse ground, low sun, cut short) */
    flags?: { i: number; f: number }[];
    /** 0..1: the share of the samples read from ground fine enough */
    coverage?: number;
    /** what it was computed with */
    params?: { kind: 'hike' | 'bike' | 'motor'; eyeHeight: number; algo: 1 };
    /** the timeline the `lit` values were computed for; if it differs from the live one the layer is `inputs-changed` */
    basis: { departureHash: string; paceHash: string };
}

export interface RouteAnalysis {
    v: 1;
    inputs: AnalysisInputs;
    layers: {
        /** meta only: the profile stays in `Item.profile` */
        terrain?: Layer<{ gradeOptions: string; demSource: string }>;
        risk?: Layer<{ v: 1; src: 'valhalla' | 'tiles'; candidates: RiskRun[]; unknown: number }>;
        weather?: Layer<WeatherData>;
        sun?: Layer<SunData>;
    };
    /** done rides: per-vertex seconds from the recording, replaces the modelled timeline */
    recorded?: { t: number[]; startedAt: number };
}
