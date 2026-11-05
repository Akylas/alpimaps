import { derived, get } from 'svelte/store';
import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { computeLayers, layerStatuses, routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
import { routeCoordinates } from '~/routeFeatures/lens/sections';
import { networkService } from '~/services/NetworkService';
import {
    type LensChip,
    type LensFact,
    type LensHeadline,
    type LensProfile,
    type RouteCtx,
    type RouteLens,
    type RoutePageSection,
    type RouteSettingRow,
    registerRouteFeature
} from '~/routeFeatures/registry';
import type { IItem } from '~/models/Item';
import { type LayerReason, type LayerStatus, tierOf } from '~/utils/routeAnalysis/freshness';
import { flatSpeedKmh } from '~/utils/routeAnalysis/speeds';
import { activityOf } from '~/utils/routeAnalysis/activity';
import { timelineSource } from '~/utils/routeAnalysis/timeline';
import { getWeatherProvider, weatherProviders } from '~/utils/routeAnalysis/weatherProvider';
import { sampleRoute } from '~/utils/routeAnalysis/weatherSamples';
import { rainColor, tempColor, weatherRows } from './pageRows';
import { type WeatherRead, readWeather } from './read';
import {
    routeFeatureWeather,
    weatherDecimals,
    weatherDetailsOpen,
    weatherGust,
    weatherPlateWind,
    weatherPrecision,
    weatherProfileWind,
    weatherProviderId,
    weatherSettingsKey,
    weatherThresholds,
    weatherWindKey
} from './settings';
import { weatherStage } from './stage';

const MINUTE = 60000;

// the lens asks for the same read several times a refresh (chip, line, plates...): one per route state and minute
let memo: { item: IItem; analysis: unknown; minute: number; stale: boolean; wind: string; read: WeatherRead | null };

function isOutdated(status: LayerStatus) {
    return tierOf(status.state) === 'outdated';
}

function readOf(item: IItem, status: LayerStatus): WeatherRead | null {
    const stale = isOutdated(status);
    const minute = Math.floor(Date.now() / MINUTE);
    const wind = get(weatherWindKey);
    if (memo?.item !== item || memo.analysis !== item.analysis || memo.minute !== minute || memo.stale !== stale || memo.wind !== wind) {
        memo = { item, analysis: item.analysis, minute, stale, wind, read: readWeather(item, Date.now(), { stale, thresholds: weatherThresholds() }) };
    }
    return memo.read;
}

const profiles = new WeakMap<WeatherRead, LensProfile>();

const statusOf = (item: IItem) => layerStatuses(item).weather;

function chipState(status: LayerStatus): LensChip['state'] {
    switch (status.state) {
        case 'absent':
        case 'failed':
            return 'missing';
        case 'queued':
        case 'running':
            return 'running';
        case 'stale':
        case 'inputs-changed':
            return 'outdated';
        case 'offline-cached':
            return 'offline';
        default:
            return undefined;
    }
}

function formatRain(millimeters: number) {
    return `${millimeters < 10 ? millimeters.toFixed(1) : Math.round(millimeters)} mm`;
}
const degrees = (value: number) => Math.round(value) + ' °C';

function failure(reason: LayerReason | undefined) {
    switch (reason) {
        case 'rate-limited':
            return lc('weather_rate_limited');
        case 'out-of-coverage':
            return lc('weather_out_of_range');
        default:
            return lc('weather_error');
    }
}

/** What the first fetch sends, to say it before the user taps. */
function pointsToSend(item: IItem) {
    const source = timelineSource(item);
    return sampleRoute({ distances: source.distances, altitudes: source.altitudes, speedKmh: flatSpeedKmh(activityOf(item, item.analysis)) }).length;
}

const fetchWeather = (item: IItem) => () => computeLayers(item, ['weather']);

function missingHeadline(item: IItem, status: LayerStatus): LensHeadline {
    switch (status.state) {
        case 'queued':
        case 'running':
            return { facts: [{ icon: 'mdi-cloud-sync-outline', text: lc('weather_fetching') }] };
        case 'failed':
            return { facts: [{ icon: 'mdi-cloud-alert-outline', text: failure(status.reason), alert: true }], action: { label: lc('weather_retry'), run: fetchWeather(item) } };
        default:
            return networkService.connected
                ? {
                      facts: [{ icon: 'mdi-cloud-upload-outline', text: lc('weather_send_points', pointsToSend(item), weatherDecimals(), getWeatherProvider(get(weatherProviderId))?.name) }],
                      action: { label: lc('weather_fetch'), run: fetchWeather(item) }
                  }
                : { facts: [{ icon: 'mdi-cloud-off-outline', text: lc('weather_offline') }] };
    }
}

const weatherLens: RouteLens = {
    id: 'weather',
    icon: 'mdi-weather-partly-cloudy',
    label: () => lc('lens_weather'),
    available: ({ item }) => !!item?.route && routeCoordinates(item.geometry).length > 1,
    chip: ({ item }) => {
        const status = statusOf(item);
        const read = readOf(item, status);
        const chip: LensChip = { state: chipState(status) };
        if (read) {
            chip.value = formatRain(read.summary.rainTotal);
            // heavy rain or a storm on the way
            chip.alert = read.summary.thunder || read.spans.some((span) => span.peak >= 4);
        }
        return chip;
    },
    headline: ({ item }) => {
        const status = statusOf(item);
        const read = readOf(item, status);
        if (!read) {
            return missingHeadline(item, status);
        }
        const { headShare, rainPeak, tempMax, tempMin, thunder } = read.summary;
        const facts: LensFact[] = [];
        if (tempMin !== undefined) {
            facts.push({ icon: 'mdi-thermometer', text: Math.round(tempMin) === Math.round(tempMax) ? degrees(tempMin) : `${Math.round(tempMin)}–${degrees(tempMax)}` });
        }
        facts.push(
            rainPeak
                ? { icon: 'mdi-weather-rainy', text: lc('weather_rain_around', formatRain(rainPeak.mmPerHour), formatDistance(rainPeak.distance)) }
                : { icon: 'mdi-weather-sunny', text: lc('weather_dry') }
        );
        if (headShare >= 0.1) {
            facts.push({ icon: 'mdi-weather-windy', text: lc('weather_headwind', Math.round(headShare * 100) + ' %') });
        }
        if (thunder) {
            facts.push({ icon: 'mdi-weather-lightning', text: lc('weather_thunder'), alert: true });
        }
        if (status.state === 'failed') {
            return { facts: [{ icon: 'mdi-cloud-alert-outline', text: failure(status.reason), alert: true }, ...facts], action: { label: lc('weather_retry'), run: fetchWeather(item) } };
        }
        // asking again is always the user's to do, whatever the age of the forecast
        const busy = status.state === 'running' || status.state === 'queued';
        return { facts, action: networkService.connected && !busy ? { label: lc('weather_update'), run: fetchWeather(item) } : undefined };
    },
    readout: ({ index, item }) => {
        const at = readOf(item, statusOf(item))?.at(index);
        if (at?.temp === undefined) {
            return undefined;
        }
        const parts = [Math.round(at.temp) + '°'];
        if ((at.precip ?? 0) >= 0.1) {
            parts.push(lc('weather_rain_rate', at.precip.toFixed(1)));
        }
        if (at.head !== undefined && Math.abs(at.head) >= 5) {
            parts.push(lc(at.head > 0 ? 'weather_head' : 'weather_tail', Math.round(Math.abs(at.head)) + ' km/h'));
        }
        return parts.join(' · ');
    },
    profile: ({ item }): LensProfile => {
        const read = readOf(item, statusOf(item));
        if (!read) {
            return {};
        }
        // the same object while the read is: the chart redraws for a new one
        if (!profiles.has(read)) {
            profiles.set(read, { fade: true, weather: read.profile });
        }
        return profiles.get(read);
    },
    sections: ({ item }) =>
        readOf(item, statusOf(item))?.spans.map((span, id) => ({ id, i0: span.i0, i1: span.i1, title: lc('weather_rain_span', formatDistance(span.from), formatDistance(span.to)) })) ?? [],
    slices: ({ item }) => readOf(item, statusOf(item))?.slices ?? [],
    symbols: ({ item }) => readOf(item, statusOf(item))?.symbols ?? []
};

const kmh = (value: number) => `${value} km/h`;

function weatherSettingRows(): RouteSettingRow[] {
    const rows: RouteSettingRow[] = [
        {
            type: 'segment',
            store: weatherPrecision,
            title: lc('weather_precision'),
            description: lc('weather_precision_desc'),
            options: [
                { value: '2', title: lc('weather_precision_1km') },
                { value: '1', title: lc('weather_precision_11km') }
            ]
        }
    ];
    rows.push(
        { type: 'sectionheader', title: lc('weather_wind') },
        { type: 'slider', store: weatherProfileWind, title: lc('weather_wind_profile'), description: lc('weather_wind_profile_desc'), min: 5, max: 60, step: 5, format: kmh },
        { type: 'slider', store: weatherPlateWind, title: lc('weather_wind_plate'), description: lc('weather_wind_plate_desc'), min: 10, max: 80, step: 5, format: kmh },
        { type: 'slider', store: weatherGust, title: lc('weather_gust'), description: lc('weather_gust_desc'), min: 30, max: 100, step: 5, format: kmh }
    );
    // a choice only once there is one to make
    if (weatherProviders().length > 1) {
        rows.push({ type: 'segment', store: weatherProviderId, title: lc('weather_provider'), options: weatherProviders().map((provider) => ({ value: provider.id, title: provider.name })) });
    }
    return rows;
}

function updatedAt(item: IItem) {
    return item.analysis?.layers.weather?.prov.computedAt ?? 0;
}

const weatherPageSection: RoutePageSection = {
    id: 'weather',
    icon: 'mdi-weather-partly-cloudy',
    title: () => lc('lens_weather'),
    lens: 'weather',
    summary: ({ item }) => {
        const read = readOf(item, statusOf(item));
        if (!read) {
            return undefined;
        }
        const { headShare, rainTotal, tempMax, tempMin } = read.summary;
        return [
            tempMin === undefined ? '' : Math.round(tempMin) === Math.round(tempMax) ? degrees(tempMin) : `${Math.round(tempMin)}–${degrees(tempMax)}`,
            formatRain(rainTotal),
            headShare >= 0.1 ? lc('weather_headwind', Math.round(headShare * 100) + ' %') : ''
        ]
            .filter(Boolean)
            .join(' · ');
    },
    facts: ({ item }) => {
        const read = readOf(item, statusOf(item));
        if (!read) {
            return [];
        }
        const { cloud, headShare, rainPeak, rainTotal, tempMax, tempMin, thunder } = read.summary;
        const facts: LensFact[] = [];
        if (tempMin !== undefined) {
            facts.push({
                icon: 'mdi-thermometer',
                text: Math.round(tempMin) === Math.round(tempMax) ? degrees(tempMin) : `${Math.round(tempMin)}–${degrees(tempMax)}`,
                color: tempColor(tempMin <= 0 ? tempMin : tempMax)
            });
        }
        facts.push(rainPeak ? { icon: 'mdi-weather-rainy', text: formatRain(rainTotal), color: rainColor(rainPeak.mmPerHour) } : { icon: 'mdi-weather-sunny', text: lc('weather_dry') });
        if (cloud !== undefined) {
            facts.push({ icon: 'mdi-cloud-outline', text: Math.round(cloud) + ' %' });
        }
        if (headShare >= 0.1) {
            facts.push({ icon: 'mdi-weather-windy', text: Math.round(headShare * 100) + ' %', alert: headShare >= 0.3 });
        }
        if (thunder) {
            facts.push({ icon: 'mdi-weather-lightning', text: lc('weather_thunder'), alert: true });
        }
        return facts;
    },
    rows: ({ item }) => {
        const status = statusOf(item);
        const provider = getWeatherProvider(get(weatherProviderId));
        const busy = status.state === 'running' || status.state === 'queued';
        const state = busy ? 'running' : status.state === 'failed' ? 'failed' : networkService.connected ? 'absent' : 'offline';
        const layer = item.analysis?.layers.weather;
        return weatherRows({
            detailsOpen: get(weatherDetailsOpen),
            read: readOf(item, status),
            footer: {
                provider: provider?.name ?? '',
                attribution: provider?.attribution ?? { text: '', url: '', license: '' },
                updatedAt: updatedAt(item),
                decimals: layer?.data.request.decimals ?? weatherDecimals(),
                outdated: isOutdated(status),
                canUpdate: networkService.connected && !busy
            },
            fetch: { state, points: pointsToSend(item), decimals: weatherDecimals(), provider: provider?.name ?? '' }
        });
    },
    component: () => import('~/routeFeatures/weather/WeatherRow.svelte')
};

registerRouteFeature({
    id: 'weather',
    order: 14,
    setting: { title: () => lc('lens_weather'), store: routeFeatureWeather },
    settings: weatherSettingRows,
    // a layer finishing or failing, a new departure read from the same hours, and the settings it is asked with
    changes: derived([routeAnalysisChanges, weatherSettingsKey, weatherWindKey, weatherDetailsOpen], (values) => values.join()),
    lenses: [weatherLens],
    pageSections: [weatherPageSection],
    compute: weatherStage
});
