<script lang="ts">
    /**
     * The moment the panorama's sun is drawn for: a day, stepped a day at a time, and a time of day on
     * a slider - with the rise and set that day over the terrain in front of the viewpoint. `now`
     * goes back to following the clock.
     */
    import { onDestroy } from 'svelte';
    import { formatDate, formatTime, lc } from '~/helpers/locale';
    import { peakFinderSunTimes } from '~/mapModules/features/peakFinderSun';
    import { peakFinderSunTime } from '~/stores/terrainStore';
    import { colors, fonts } from '~/variables';

    export let title: string;

    const MINUTE = 60000;
    const DAY = 24 * 60 * MINUTE;

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    // The clock, while the row follows it.
    let now = Date.now();
    const clock = setInterval(() => (now = Date.now()), 30000);
    onDestroy(() => clearInterval(clock));

    $: moment = $peakFinderSunTime ?? now;
    $: dayStart = new Date(moment).setHours(0, 0, 0, 0);
    // A 5 minute grid: the native slider rejects a value off its step.
    $: minutes = Math.round((moment - dayStart) / MINUTE / 5) * 5;
    $: riseSet = [$peakFinderSunTimes.rise && `↑ ${formatTime($peakFinderSunTimes.rise)}`, $peakFinderSunTimes.set && `↓ ${formatTime($peakFinderSunTimes.set)}`].filter(Boolean).join('  ·  ');

    function setMinutes(event) {
        const value = dayStart + event.value * MINUTE;
        if (Math.abs(value - moment) >= MINUTE) {
            peakFinderSunTime.set(value);
        }
    }

    function shiftDays(days: number) {
        peakFinderSunTime.set(moment + days * DAY);
    }
</script>

<gridlayout columns="auto,*,auto,auto" padding="6 16 0 16" rows="auto,auto,auto">
    <label colSpan={4} color={colorOnSurface} fontSize={16} text={title} />
    <mdbutton fontFamily={$fonts.mdi} row={1} text="mdi-chevron-left" variant="text" on:tap={() => shiftDays(-1)} />
    <label col={1} color={colorOnSurface} fontSize={15} row={1} text={formatDate(moment, 'll')} textAlignment="center" verticalTextAlignment="center" />
    <mdbutton col={2} fontFamily={$fonts.mdi} row={1} text="mdi-chevron-right" variant="text" on:tap={() => shiftDays(1)} />
    <mdbutton col={3} color={$peakFinderSunTime === null ? colorOnSurfaceVariant : colorPrimary} row={1} text={lc('now')} variant="text" on:tap={() => peakFinderSunTime.set(null)} />
    <slider colSpan={3} maxValue={1435} minValue={0} row={2} stepSize={5} value={minutes} on:valueChange={setMinutes} />
    <stacklayout col={3} row={2} verticalAlignment="center">
        <label color={colorOnSurface} fontSize={15} fontWeight="bold" text={formatTime(moment)} textAlignment="center" />
        {#if riseSet}
            <label color={colorOnSurfaceVariant} fontSize={11} text={riseSet} textAlignment="center" />
        {/if}
    </stacklayout>
</gridlayout>
