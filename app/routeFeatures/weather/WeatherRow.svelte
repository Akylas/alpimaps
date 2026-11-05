<script lang="ts">
    // one row of the weather card of the route page: the summary with the share of the way ridden against the wind, a sample of the
    // ride (where, when, the sky, the temperature, the rain, the wind), or where the forecast comes from. A tap on a sample focuses its stretch
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import Pill from '~/components/common/Pill.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { formatTime, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { computeLayers } from '~/routeFeatures/analysisRunner';
    import type { LensSection } from '~/routeFeatures/registry';
    import { routeTimeZone } from '~/utils/routeAnalysis/departure';
    import type { WeatherRowData } from './pageRows';
    import { rainColor, tempColor } from './pageRows';
    import { wxGlyph } from './read';
    import { weatherDetailsOpen, weatherGust } from './settings';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    export let data: WeatherRowData;

    interface $$Events {
        focus: LensSection;
    }
    const dispatch = createEventDispatcher<$$Events>();

    let { colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

    // km/h of wind along the way that is worth saying, and how hard
    const WIND_NOTICEABLE = 10;
    const WIND_HARD = 20;
    const HEAD_COLOR = '#D7263D';
    const HEAD_SOFT_COLOR = '#F29D38';
    const TAIL_COLOR = '#2E9E5B';

    $: zone = routeTimeZone(item?.analysis?.inputs.departure ?? { mode: 'now' });
    const clock = (at: number) => formatTime(at, 'LT', zone.offset);
    const percent = (share: number) => Math.round(share * 100) + ' %';
    const mm = (value: number) => `${value < 10 ? value.toFixed(1) : Math.round(value)} mm`;
    const degrees = (value: number) => Math.round(value) + '°';

    // e-ink has no colour to give a figure
    const tone = (color: string | undefined) => (isEInk || !color ? colorOnSurface : color);

    function windColor(head: number | undefined) {
        if (isEInk || head === undefined) {
            return colorOnSurface;
        }
        return head >= WIND_HARD ? HEAD_COLOR : head >= WIND_NOTICEABLE ? HEAD_SOFT_COLOR : head <= -WIND_NOTICEABLE ? TAIL_COLOR : colorOnSurface;
    }

    function focusRow(row: Extract<WeatherRowData, { type: 'ride' }>['row']) {
        dispatch('focus', { id: row.index, i0: row.i0, i1: row.i1, title: [formatDistance(row.distance), row.temp === undefined ? '' : degrees(row.temp)].filter(Boolean).join(' · ') });
    }
</script>

{#if data.type === 'summary'}
    {@const summary = data.summary}
    {@const across = Math.max(0, 1 - summary.headShare - summary.tailShare)}
    <stacklayout padding="8 16 14 16">
        <gridlayout columns="*,*,*,*">
            <stacklayout>
                <label
                    color={tone(summary.tempMin === undefined ? undefined : tempColor(summary.tempMin <= 0 ? summary.tempMin : summary.tempMax))}
                    fontSize={17}
                    fontWeight="bold"
                    text={summary.tempMin === undefined
                        ? '–'
                        : Math.round(summary.tempMin) === Math.round(summary.tempMax)
                          ? `${degrees(summary.tempMin)}C`
                          : `${Math.round(summary.tempMin)}–${Math.round(summary.tempMax)} °C`}
                />
                <label color={colorOnSurfaceVariant} fontSize={12} text={lc('weather_stat_temp')} />
            </stacklayout>
            <stacklayout col={1}>
                <label color={tone(rainColor(summary.rainPeak?.mmPerHour ?? 0))} fontSize={17} fontWeight="bold" text={mm(summary.rainTotal)} />
                <label
                    color={colorOnSurfaceVariant}
                    fontSize={12}
                    lineBreak="end"
                    maxLines={1}
                    text={summary.rainPeak ? lc('weather_rain_around', mm(summary.rainPeak.mmPerHour), formatDistance(summary.rainPeak.distance)) : lc('weather_dry')}
                />
            </stacklayout>
            <stacklayout col={2}>
                <label color={colorOnSurface} fontSize={17} fontWeight="bold" text={summary.cloud === undefined ? '–' : Math.round(summary.cloud) + ' %'} />
                <label color={colorOnSurfaceVariant} fontSize={12} text={lc('weather_stat_cloud')} />
            </stacklayout>
            <stacklayout col={3}>
                <label color={tone(summary.headShare >= 0.3 ? HEAD_COLOR : undefined)} fontSize={17} fontWeight="bold" text={percent(summary.headShare)} />
                <label color={colorOnSurfaceVariant} fontSize={12} text={lc('weather_stat_headwind')} />
            </stacklayout>
        </gridlayout>
        <!-- the way ridden, against the wind, across it and with it: the length of each is its share -->
        <gridlayout
            borderColor={colorOutlineVariant}
            borderRadius={4}
            borderWidth={isEInk ? 1 : 0}
            columns={`${Math.max(summary.headShare, 0.001)}*,${Math.max(across, 0.001)}*,${Math.max(summary.tailShare, 0.001)}*`}
            height={8}
            marginTop={12}
        >
            <gridlayout backgroundColor={isEInk ? '#000000' : HEAD_COLOR} />
            <gridlayout backgroundColor={isEInk ? '#ffffff' : colorOutlineVariant} col={1} />
            <gridlayout backgroundColor={isEInk ? '#808080' : TAIL_COLOR} col={2} />
        </gridlayout>
        <label color={colorOnSurfaceVariant} fontSize={12} marginTop={4} text={lc('weather_wind_share', percent(summary.headShare), percent(across), percent(summary.tailShare))} />
        {#if summary.thunder}
            <label color={isEInk ? colorOnSurface : colorError} fontFamily={$fonts.mdi} fontSize={14} fontWeight="bold" marginTop={8} text={`mdi-weather-lightning ${lc('weather_thunder')}`} />
        {/if}
    </stacklayout>
{:else if data.type === 'details'}
    <gridlayout columns="24,*,auto" height={44} padding="0 16" rippleColor={colorPrimary} on:tap={() => weatherDetailsOpen.set(!$weatherDetailsOpen)}>
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text={data.open ? 'mdi-chevron-down' : 'mdi-chevron-right'} verticalAlignment="middle" />
        <label class="sectionHeader" col={1} padding="0" text={lc('weather_details')} verticalAlignment="middle" />
        <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={String(data.count)} verticalAlignment="middle" />
    </gridlayout>
{:else if data.type === 'ride'}
    {@const row = data.row}
    <gridlayout borderBottomColor={colorOutlineVariant} borderBottomWidth={1} columns="64,30,*,auto" height={62} padding="0 16" rippleColor={colorPrimary} on:tap={() => focusRow(row)}>
        <stacklayout verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={13} fontWeight="bold" text={formatDistance(row.distance)} />
            <label color={colorOnSurfaceVariant} fontSize={12} text={clock(row.at)} />
        </stacklayout>
        <label col={1} color={tone(rainColor(row.precip))} fontFamily={$fonts.mdi} fontSize={22} text={wxGlyph(row.code, row.cloud)} verticalAlignment="middle" />
        <stacklayout col={2} verticalAlignment="middle">
            <label color={tone(row.temp === undefined ? undefined : tempColor(row.temp))} fontSize={15} fontWeight="bold" text={row.temp === undefined ? '–' : degrees(row.temp)} />
            <label
                color={row.precip >= 0.1 ? tone(rainColor(row.precip)) : colorOnSurfaceVariant}
                fontSize={12}
                text={row.precip >= 0.1 ? lc('weather_rain_rate', row.precip.toFixed(1)) : lc('weather_dry')}
            />
            {#if row.cloud !== undefined}
                <label color={colorOnSurfaceVariant} fontSize={12} text={`${Math.round(row.cloud)} % ${lc('weather_stat_cloud')}`} />
            {/if}
        </stacklayout>
        <stacklayout col={3} horizontalAlignment="right" verticalAlignment="middle">
            <label color={windColor(row.head)} fontSize={14} fontWeight="bold" horizontalAlignment="right" text={row.wind === undefined ? '' : `${Math.round(row.wind)} km/h`} />
            <label
                color={windColor(row.head)}
                fontSize={12}
                horizontalAlignment="right"
                text={row.head !== undefined && Math.abs(row.head) >= WIND_NOTICEABLE ? lc(row.head > 0 ? 'weather_head' : 'weather_tail', Math.round(Math.abs(row.head)) + ' km/h') : ''}
            />
            {#if row.gust !== undefined && row.gust >= $weatherGust}
                <label color={isEInk ? colorOnSurface : HEAD_COLOR} fontFamily={$fonts.mdi} fontSize={12} horizontalAlignment="right" text={`mdi-weather-windy-variant ${Math.round(row.gust)}`} />
            {/if}
        </stacklayout>
    </gridlayout>
{:else if data.type === 'footer'}
    <stacklayout padding="12 16 14 16">
        <gridlayout columns="*,auto">
            <label
                color={data.outdated && !isEInk ? colorError : colorOnSurfaceVariant}
                fontSize={12}
                text={lc('weather_footer', data.provider, clock(data.updatedAt), data.decimals)}
                textWrap={true}
                verticalAlignment="middle"
            />
            {#if data.canUpdate}
                <Pill col={1} height={32} icon="mdi-cloud-refresh-outline" label={lc('weather_update')} on:tap={() => computeLayers(item, ['weather'])} />
            {/if}
        </gridlayout>
        <label color={colorOnSurfaceVariant} fontSize={12} marginTop={4} text={`${data.attribution.text} (${data.attribution.license})`} textWrap={true} />
        <label color={colorOnSurfaceVariant} fontSize={11} marginTop={4} text={lc('weather_disclaimer')} textWrap={true} />
    </stacklayout>
{:else}
    <gridlayout columns="*,auto" padding="12 16">
        <label
            color={colorOnSurfaceVariant}
            fontSize={13}
            text={data.state === 'running'
                ? lc('weather_fetching')
                : data.state === 'offline'
                  ? lc('weather_offline')
                  : data.state === 'failed'
                    ? lc('weather_error')
                    : lc('weather_send_points', data.points, data.decimals, data.provider)}
            textWrap={true}
            verticalAlignment="middle"
        />
        {#if data.state === 'absent' || data.state === 'failed'}
            <Pill col={1} height={32} icon="mdi-cloud-upload-outline" label={data.state === 'failed' ? lc('weather_retry') : lc('weather_fetch')} on:tap={() => computeLayers(item, ['weather'])} />
        {/if}
    </gridlayout>
{/if}
