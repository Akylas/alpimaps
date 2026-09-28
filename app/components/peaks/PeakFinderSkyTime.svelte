<script lang="ts">
    // colours are props: shown on the app theme (settings) and on the panorama's (sky panel)
    import { onDestroy } from 'svelte';
    import { formatDate, formatTime, lc } from '~/helpers/locale';
    import { peakFinderSunTimes } from '~/mapModules/features/peakFinderSun';
    import { peakFinderSkyTime } from '~/stores/terrainStore';
    import { colors, fonts } from '~/variables';

    export let title: string = null;
    export let colorOnSurface: string = null;
    export let colorOnSurfaceVariant: string = null;
    export let colorPrimary: string = null;

    const MINUTE = 60000;
    const DAY = 24 * 60 * MINUTE;

    $: onSurface = colorOnSurface ?? $colors.colorOnSurface;
    $: onSurfaceVariant = colorOnSurfaceVariant ?? $colors.colorOnSurfaceVariant;
    $: primary = colorPrimary ?? $colors.colorPrimary;

    let now = Date.now();
    const clock = setInterval(() => (now = Date.now()), 30000);
    onDestroy(() => clearInterval(clock));

    $: moment = $peakFinderSkyTime ?? now;
    $: dayStart = new Date(moment).setHours(0, 0, 0, 0);
    // 5 minute grid rounded here: a slider step would draw 288 ticks
    $: minutes = Math.round((moment - dayStart) / MINUTE / 5) * 5;
    $: riseSet = [$peakFinderSunTimes.rise && `↑ ${formatTime($peakFinderSunTimes.rise)}`, $peakFinderSunTimes.set && `↓ ${formatTime($peakFinderSunTimes.set)}`].filter(Boolean).join('  ·  ');

    function setMinutes(event) {
        const value = dayStart + Math.round(event.value / 5) * 5 * MINUTE;
        if (Math.abs(value - moment) >= MINUTE) {
            peakFinderSkyTime.set(value);
        }
    }

    function shiftDays(days: number) {
        peakFinderSkyTime.set(moment + days * DAY);
    }
</script>

<gridlayout columns="auto,*,auto,auto" padding={title ? '6 16 0 16' : 0} rows="auto,auto,auto" {...$$restProps}>
    <label colSpan={4} color={onSurface} fontSize={16} text={title} visibility={title ? 'visible' : 'collapse'} />
    <mdbutton color={onSurface} fontFamily={$fonts.mdi} row={1} text="mdi-chevron-left" variant="text" on:tap={() => shiftDays(-1)} />
    <label col={1} color={onSurface} fontSize={15} row={1} text={formatDate(moment, 'll')} textAlignment="center" verticalTextAlignment="center" />
    <mdbutton col={2} color={onSurface} fontFamily={$fonts.mdi} row={1} text="mdi-chevron-right" variant="text" on:tap={() => shiftDays(1)} />
    <mdbutton col={3} color={$peakFinderSkyTime === null ? onSurfaceVariant : primary} row={1} text={lc('now')} variant="text" on:tap={() => peakFinderSkyTime.set(null)} />
    <slider colSpan={3} color={primary} maxValue={1435} minValue={0} row={2} value={minutes} on:valueChange={setMinutes} />
    <stacklayout col={3} row={2} verticalAlignment="center">
        <label color={onSurface} fontSize={15} fontWeight="bold" text={formatTime(moment)} textAlignment="center" />
        {#if riseSet}
            <label color={onSurfaceVariant} fontSize={11} text={riseSet} textAlignment="center" />
        {/if}
    </stacklayout>
</gridlayout>
