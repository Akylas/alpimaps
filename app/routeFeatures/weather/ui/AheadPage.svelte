<script lang="ts">
    // dock page: the weather where the rider will be in the next two hours, every 20 minutes, with the light under it, and
    // how old the forecast is
    import { lc } from '@nativescript-community/l';
    import { onDestroy } from 'svelte';
    import NavigationPageHeader from '~/components/navigation/NavigationPageHeader.svelte';
    import { formatTime } from '~/helpers/locale';
    import { isDarkTheme, isEInk } from '~/helpers/theme';
    import { computeLayers, layerStatuses, routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
    import { routeFeatures } from '~/routeFeatures/registry';
    import { sunPalette } from '~/routeFeatures/sun/palette';
    import { SUN_PALETTE_KEYS, type SunClass, readSun } from '~/routeFeatures/sun/read';
    import { type AheadCell, aheadCells, windMark } from '~/routeFeatures/weather/data/cells';
    import { readWeather, wxGlyph } from '~/routeFeatures/weather/data/read';
    import { weatherFormat } from '~/routeFeatures/weather/ui/format';
    import { networkService } from '~/services/NetworkService';
    import { navigationDetour, navigationItem, navigationProgress, navigationScale } from '~/stores/navigationStore';
    import { formatNavigationDuration } from '~/utils/navigation';
    import { tierOf } from '~/utils/routeAnalysis/freshness';
    import { showSnack } from '~/utils/ui';
    import { colors, fonts } from '~/variables';

    export let height: number;

    /** meters the rider has to have moved by for the cells to be read again, if the minute has not changed */
    const MOVE_STEP = 200;
    const MINUTE_MS = 60000;

    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant } = $colors);

    let minute = Math.floor(Date.now() / MINUTE_MS);
    const tick = setInterval(() => (minute = Math.floor(Date.now() / MINUTE_MS)), MINUTE_MS / 2);
    onDestroy(() => clearInterval(tick));

    $: item = $navigationItem;
    $: layer = $routeAnalysisChanges >= 0 ? item?.analysis?.layers.weather : null;
    $: computedAt = layer?.prov.computedAt;
    $: outdated = $routeAnalysisChanges >= 0 && !!item && tierOf(layerStatuses(item).weather.state) === 'outdated';
    // a detour's position is not on the route the forecast is for
    $: detour = !!$navigationDetour;
    $: onPathIndex = Math.max($navigationProgress?.onPathIndex ?? 0, 0);

    let cells: AheadCell[] = [];
    let sunClasses: SunClass[] = [];
    let readFor = { analysis: null, minute: -1, distance: -Infinity, detour: false };
    $: refresh(layer, minute, onPathIndex, detour);

    function refresh(currentLayer: typeof layer, currentMinute: number, index: number, onDetour: boolean) {
        const data = item?.profile?.data;
        if (!currentLayer || onDetour) {
            cells = [];
            sunClasses = [];
            readFor = { analysis: currentLayer, minute: currentMinute, distance: -Infinity, detour: onDetour };
            return;
        }
        const distance = data?.[Math.min(index, data.length - 1)]?.d ?? 0;
        if (readFor.analysis === currentLayer && readFor.minute === currentMinute && readFor.detour === onDetour && Math.abs(distance - readFor.distance) < MOVE_STEP) {
            return;
        }
        readFor = { analysis: currentLayer, minute: currentMinute, distance, detour: onDetour };
        const now = Date.now();
        // timed from where the rider is: what is left of the ride, from now
        const read = readWeather(item, now, { ahead: { fromIndex: index }, format: weatherFormat });
        cells = read ? aheadCells(read, { fromIndex: index, lastIndex: read.rows.length ? read.rows[read.rows.length - 1].i1 : index }, now) : [];
        const sun = $routeFeatures.some((feature) => feature.id === 'sun') ? readSun(item, now) : null;
        sunClasses = sun ? cells.map((cell) => sun.at(cell.vertex).class) : [];
    }

    // the theme's colours changing is what makes the light's colours change
    $: palette = $colors ? sunPalette(isEInk ? 'eink' : isDarkTheme() ? 'dark' : 'light') : null;
    const title = lc('navigation_ahead_title');
    $: detail = detour
        ? lc('navigation_route_changed')
        : outdated && computedAt
          ? lc('navigation_weather_outdated', formatNavigationDuration((Date.now() - computedAt) / 1000))
          : computedAt
            ? lc('when_updated', formatTime(computedAt))
            : '';

    function update() {
        if (!item || detour) {
            return;
        }
        if (networkService.connected) {
            computeLayers(item, ['weather']);
        } else if (computedAt) {
            showSnack({ message: lc('navigation_weather_offline', formatTime(computedAt)) });
        }
    }

    function rainText(cell: AheadCell) {
        return cell.precip >= 0.1 ? ' · ' + weatherFormat.rainNumber(cell.precip) : '';
    }
    function windText(cell: AheadCell) {
        const mark = windMark(cell);
        return mark ? `${mark.arrow} ${weatherFormat.speedNumber(mark.speed)}${rainText(cell)}` : rainText(cell).replace(' · ', '');
    }
</script>

{#if layer}
    <gridlayout {height} rows="auto,*,auto" {...$$restProps}>
        <NavigationPageHeader {detail} detailColor={outdated || detour ? (isEInk ? colorOnSurface : colorError) : colorOnSurfaceVariant} {title} on:tap={update} />
        <gridlayout columns={cells.map(() => '*').join(',')} row={1}>
            {#each cells as cell, index (cell.at)}
                <stacklayout col={index} horizontalAlignment="center" verticalAlignment="center">
                    <label color={colorOnSurfaceVariant} fontSize={11 * $navigationScale} horizontalAlignment="center" text={formatTime(cell.at)} />
                    <label horizontalAlignment="center" maxLines={1}>
                        <cspan color={colorOnSurface} fontFamily={$fonts.mdi} fontSize={17 * $navigationScale} text={wxGlyph(cell.code, cell.cloud, cell.moon)} />
                        <cspan color={colorOnSurface} fontSize={13 * $navigationScale} fontWeight="bold" text={cell.temp === undefined ? '' : ' ' + weatherFormat.temperature(cell.temp)} />
                    </label>
                    <label color={colorOnSurfaceVariant} fontSize={11 * $navigationScale} horizontalAlignment="center" maxLines={1} text={windText(cell)} />
                </stacklayout>
            {/each}
        </gridlayout>
        {#if sunClasses.length}
            <gridlayout borderRadius={3} columns={cells.map(() => '*').join(',')} height={6} margin="0 0 8 0" row={2}>
                {#each sunClasses as sunClass, index}
                    <absolutelayout backgroundColor={palette[SUN_PALETTE_KEYS[sunClass]]} col={index} />
                {/each}
            </gridlayout>
        {/if}
    </gridlayout>
{/if}
