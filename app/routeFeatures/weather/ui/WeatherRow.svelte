<script lang="ts">
    // one row of the weather card of the route page: the summary, with the share of the way ridden against the wind, the samples of the
    // ride side by side (where, when, the sky, the temperature, the wind, the rain), or where the forecast comes from. A tap on a sample
    // focuses its stretch. Drawn as oss-weather draws a forecast: the figures that matter in the colour of what they are about
    import { Canvas, Cap, Paint, Style } from '@nativescript-community/ui-canvas';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import Pill from '~/components/common/Pill.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { formatTime, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { computeLayers } from '~/routeFeatures/analysisRunner';
    import type { LensSection } from '~/routeFeatures/registry';
    import { routeTimeZone } from '~/utils/routeAnalysis/departure';
    import type { RideRow } from '~/routeFeatures/weather/data/read';
    import type { WeatherRowData } from '~/routeFeatures/weather/ui/pageRows';
    import { HEADWIND_HARD_COLOR, SUN_COLOR, TAILWIND_COLOR, TEMP_LINE, rainBarHeight, rainBarTint, rainColor, skyBand, tempColor, windColor, windWash } from '~/routeFeatures/weather/ui/colors';
    import { weatherFormat } from '~/routeFeatures/weather/ui/format';
    import { type FactsWords, rainPeakSentence } from '~/routeFeatures/weather/ui/facts';
    import { isClearSky, windLabel } from '~/routeFeatures/weather/ui/pageRows';
    import { wxGlyph } from '~/routeFeatures/weather/data/read';
    import { weatherGust } from '~/routeFeatures/weather/settings';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    export let data: WeatherRowData;

    interface $$Events {
        focus: LensSection;
    }
    const dispatch = createEventDispatcher<$$Events>();

    let { colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

    $: zone = routeTimeZone(item?.analysis?.inputs.departure ?? { mode: 'now' });
    const clock = (at: number) => formatTime(at, 'LT', zone.offset);
    const percent = (share: number) => Math.round(share * 100) + ' %';

    // where a wind blows to, the ride going up
    const WIND_ARROWS = { head: 'mdi-arrow-down', tail: 'mdi-arrow-up', cross_left: 'mdi-arrow-left', cross_right: 'mdi-arrow-right', calm: '' };

    // the line of a fetch by its state; "absent" says how many points would be sent
    const FETCH_STATE_KEYS: Record<string, string> = { running: 'weather_fetching', offline: 'weather_offline', failed: 'weather_error' };

    // e-ink has no colour to give a figure
    const tone = (color: string | undefined) => (isEInk || !color ? colorOnSurface : color);
    // the sky: neutral when it does not rain, as e-ink has no colour to give it
    const skyTone = (precip: number) => (isEInk ? colorOnSurface : (rainColor(precip) ?? colorOnSurfaceVariant));
    // the sun is highlighted as the rain is
    const rowSkyTone = (row: RideRow) => (isClearSky(row) && !isEInk ? SUN_COLOR : skyTone(row.precip));

    /** km/h of the wind along the ride from which a sample says it */
    const WIND_SHOWN = 10;
    // a sample's column, in dp: its width, then the rows it is made of from the top. The rows of the wind and of the rain are
    // there only when one sample has some: a dry, calm ride is a short strip
    const STRIP_COLUMN = 58;
    const HEADER_ROW = 36;
    const SKY_ROW = 28;
    const WIND_ROW = 20;
    const LINE_TOP = 18;
    const LINE_HEIGHT = 30;
    const RAIN_ROW = 58;
    const LINE_PAD = 5;
    /** mm/h of rain from which a sample shows it */
    const RAIN_SHOWN = 0.1;

    // the samples with the ones around them (the line of the temperatures runs through the cells), the wind of each when it is shown,
    // and the rows they need
    $: strip =
        data.type === 'strip'
            ? (() => {
                  const temps = data.rows.flatMap(({ temp }) => (temp === undefined ? [] : [temp]));
                  const low = Math.min(...temps);
                  const high = Math.max(...temps);
                  const items = data.rows.map((row, index) => {
                      const wind = windLabel(row.wind, row.head, row.cross);
                      return {
                          row,
                          wind: wind && wind.kind !== 'calm' && wind.value >= WIND_SHOWN ? wind : undefined,
                          previous: data.rows[index - 1]?.temp,
                          next: data.rows[index + 1]?.temp,
                          low,
                          high
                      };
                  });
                  const windRow = items.some(({ wind }) => wind) ? WIND_ROW : 0;
                  const rainRow = items.some(({ row }) => row.precip >= RAIN_SHOWN) ? RAIN_ROW : 0;
                  return { items, windRow, rainRow, height: HEADER_ROW + SKY_ROW + windRow + LINE_TOP + LINE_HEIGHT + rainRow };
              })()
            : null;

    const factsWords: FactsWords = { format: weatherFormat, t: lc, distance: formatDistance };

    const windTone = (head: number | undefined) => tone(windColor(head));

    // where a temperature is on the line of its cell, from the top of the cell's room for it
    const lineY = (temp: number, low: number, high: number) => LINE_PAD + (high > low ? ((high - temp) / (high - low)) * (LINE_HEIGHT - 2 * LINE_PAD) : (LINE_HEIGHT - 2 * LINE_PAD) / 2);

    const linePaint = new Paint();
    linePaint.setStyle(Style.STROKE);
    linePaint.setStrokeWidth(3);
    linePaint.setStrokeCap(Cap.ROUND);
    const dotPaint = new Paint();
    dotPaint.setStyle(Style.FILL);
    // the line of the temperatures through the cell: half way to each neighbour, so the cells' halves meet
    function drawLine({ canvas }: { canvas: Canvas }, { high, low, next, previous, row }: (typeof strip.items)[number]) {
        if (row.temp === undefined) {
            return;
        }
        const width = canvas.getWidth();
        const middle = width / 2;
        const y = lineY(row.temp, low, high);
        // a paint's colour can be set, not read back
        const lineColor = isEInk ? colorOnSurface : TEMP_LINE;
        linePaint.color = lineColor;
        dotPaint.color = lineColor;
        if (previous !== undefined) {
            canvas.drawLine(0, (lineY(previous, low, high) + y) / 2, middle, y, linePaint);
        }
        if (next !== undefined) {
            canvas.drawLine(middle, y, width, (y + lineY(next, low, high)) / 2, linePaint);
        }
        canvas.drawCircle(middle, y, 3.5, dotPaint);
    }

    function focusRow(row: RideRow) {
        dispatch('focus', {
            id: row.index,
            i0: row.i0,
            i1: row.i1,
            title: [formatDistance(row.distance), row.temp === undefined ? '' : weatherFormat.temperature(row.temp)].filter(Boolean).join(' · ')
        });
    }
</script>

{#if data.type === 'summary'}
    {@const summary = data.summary}
    {@const across = Math.max(0, 1 - summary.headShare - summary.tailShare)}
    {@const peakSentence = rainPeakSentence(summary, factsWords)}
    <stacklayout padding="8 16 8 16">
        <!-- the figures are chips in the section's header: here the rain's peak, too long for a chip, and the way ridden against the wind -->
        {#if peakSentence}
            <label color={colorOnSurface} fontSize={13} text={peakSentence} textWrap={true} />
        {/if}
        <!-- the way ridden, against the wind, across it and with it: the length of each is its share -->
        <gridlayout
            borderColor={colorOutlineVariant}
            borderRadius={4}
            borderWidth={isEInk ? 1 : 0}
            columns={`${Math.max(summary.headShare, 0.001)}*,${Math.max(across, 0.001)}*,${Math.max(summary.tailShare, 0.001)}*`}
            height={6}
            marginTop={peakSentence ? 8 : 0}>
            <gridlayout backgroundColor={isEInk ? '#000000' : HEADWIND_HARD_COLOR} />
            <gridlayout backgroundColor={isEInk ? '#ffffff' : colorOutlineVariant} col={1} />
            <gridlayout backgroundColor={isEInk ? '#808080' : TAILWIND_COLOR} col={2} />
        </gridlayout>
        <label color={colorOnSurfaceVariant} fontSize={12} marginTop={4} text={lc('weather_wind_share', percent(summary.headShare), percent(across), percent(summary.tailShare))} />
    </stacklayout>
{:else if data.type === 'strip'}
    {@const { items, windRow, rainRow, height } = strip}
    <collectionview colWidth={STRIP_COLUMN} {height} {items} orientation="horizontal">
        <Template let:item={cell}>
            {@const row = cell.row}
            {@const wind = cell.wind}
            {@const wash = windWash(row.head, row.gust, $weatherGust)}
            <gridlayout
                borderRightColor={colorOutlineVariant}
                borderRightWidth={0.5}
                rippleColor={colorPrimary}
                rows={`${HEADER_ROW},${SKY_ROW},${windRow},${LINE_TOP + LINE_HEIGHT},${rainRow}`}
                on:tap={() => focusRow(row)}>
                <label horizontalAlignment="center" paddingTop={4} textAlignment="center" verticalAlignment="top">
                    <cspan color={colorOnSurface} fontSize={12} fontWeight="bold" text={formatDistance(row.distance)} />
                    <cspan color={colorOnSurfaceVariant} fontSize={11} text={'\n' + clock(row.at)} />
                </label>
                <!-- the sky as a strip over the samples, as oss-weather draws the phase of the day over its hours: the sun when it is clear, the cloud -->
                <gridlayout backgroundColor={isEInk || row.cloud === undefined ? null : skyBand(row.cloud)} height={4} verticalAlignment="top" />
                <!-- the sky, in the colour of the rain -->
                <label color={rowSkyTone(row)} fontFamily={$fonts.mdi} fontSize={24} row={1} text={wxGlyph(row.code, row.cloud, row.moon)} textAlignment="center" verticalTextAlignment="middle" />
                <!-- the wind under the sky, as oss-weather puts it: an arrow of the way it blows, its speed, on a wash when it is strong or bursts -->
                {#if wind}
                    <label
                        backgroundColor={isEInk ? null : wash}
                        borderColor={isEInk && wash ? colorOnSurface : null}
                        borderRadius={9}
                        borderWidth={isEInk && wash ? 1 : 0}
                        color={windTone(row.head)}
                        fontSize={11}
                        height={18}
                        horizontalAlignment="center"
                        padding="0 6"
                        row={2}
                        verticalAlignment="middle"
                        verticalTextAlignment="middle">
                        <span fontFamily={$fonts.mdi} fontSize={13} text={WIND_ARROWS[wind.kind === 'cross' ? `cross_${wind.side}` : wind.kind]} />
                        <span fontWeight="bold" text={' ' + weatherFormat.speedNumber(wind.value)} />
                        <span color={colorError} fontFamily={$fonts.mdi} fontSize={13} text={row.gust !== undefined && row.gust >= $weatherGust && !isEInk ? ' mdi-weather-windy-variant' : ''} />
                    </label>
                {/if}
                <canvasview marginTop={LINE_TOP} row={3} on:draw={(event) => drawLine(event, cell)} />
                <label
                    color={tone(row.temp === undefined ? undefined : tempColor(row.temp))}
                    fontSize={15}
                    fontWeight="bold"
                    marginTop={row.temp === undefined ? 0 : LINE_TOP + lineY(row.temp, cell.low, cell.high) - 24}
                    row={3}
                    text={row.temp === undefined ? '–' : weatherFormat.temperature(row.temp)}
                    textAlignment="center"
                    verticalAlignment="top" />
                <!-- the rain, as oss-weather draws an hour of it: its chance above, a bar as plain as the chance and as high as the rain, its figure in it -->
                {#if rainRow && row.precip >= RAIN_SHOWN}
                    <stacklayout row={4} verticalAlignment="bottom">
                        <label color={colorOnSurfaceVariant} fontSize={10} text={row.probability === undefined ? '' : Math.round(row.probability) + ' %'} textAlignment="center" />
                        <label
                            backgroundColor={isEInk ? null : rainBarTint(row.probability)}
                            borderColor={isEInk ? colorOnSurface : null}
                            borderRadius={6}
                            borderWidth={isEInk ? 1 : 0}
                            color={colorOnSurface}
                            fontSize={11}
                            fontWeight="bold"
                            height={rainBarHeight(row.precip)}
                            margin="0 5 3 5"
                            text={weatherFormat.rainNumber(row.precip)}
                            textAlignment="center"
                            verticalTextAlignment="middle" />
                    </stacklayout>
                {/if}
            </gridlayout>
        </Template>
    </collectionview>
{:else if data.type === 'footer'}
    <gridlayout columns="*,auto" padding="12 16 14 16" rows="auto,auto">
        <label color={data.outdated && !isEInk ? colorError : colorOnSurfaceVariant} fontSize={12} text={lc('when_updated', clock(data.updatedAt))} textWrap={true} verticalAlignment="middle" />
        {#if data.canUpdate}
            <Pill col={1} height={32} icon="mdi-cloud-refresh-outline" label={lc('weather_update')} on:tap={() => computeLayers(item, ['weather'])} />
        {/if}
        <label colSpan={2} marginTop={4} row={1} textWrap={true}>
            <cspan color={colorOnSurfaceVariant} fontSize={12} text={`${data.attribution.text} (${data.attribution.license})`} />
            <cspan color={colorOnSurfaceVariant} fontSize={11} text={'\n' + lc('weather_disclaimer')} />
        </label>
    </gridlayout>
{:else}
    {@const stateKey = FETCH_STATE_KEYS[data.state]}
    <gridlayout columns="*,auto" padding="12 16">
        <label
            color={colorOnSurfaceVariant}
            fontSize={13}
            text={stateKey ? lc(stateKey) : lc('weather_send_points', data.points, data.decimals, data.provider)}
            textWrap={true}
            verticalAlignment="middle" />
        {#if data.state === 'absent' || data.state === 'failed'}
            <Pill col={1} height={32} icon="mdi-cloud-upload-outline" label={data.state === 'failed' ? lc('weather_retry') : lc('weather_fetch')} on:tap={() => computeLayers(item, ['weather'])} />
        {/if}
    </gridlayout>
{/if}
