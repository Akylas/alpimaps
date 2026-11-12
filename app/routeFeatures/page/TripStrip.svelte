<script lang="ts">
    // the ride under the tiles of the route page: when it leaves and arrives, and right of the times, one over the other, the small figures the
    // features have for it (the sun and the moon, as oss-weather says them), a tap on one saying what it is. A line under them for what is worth a few words
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { formatTime, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { dayFormat, tripTimes } from '~/routeFeatures/page/trip';
    import { routeFeatureChanges, routeFeatures, routeTrip } from '~/routeFeatures/registry';
    import { showSnack } from '~/utils/ui';
    import { utcOffsetAt } from '~/utils/timezone';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    /** bumped when the item's analysis changed in place: the times and the figures follow */
    export let version = 0;

    // no payload: the listener gets `undefined`
    interface $$Events {
        when: undefined;
    }
    const dispatch = createEventDispatcher<$$Events>();
    /** one over the other beside the times: three are as high as the times are */
    const MAX_CHIPS = 3;

    let { colorError, colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    $: times = version >= 0 ? tripTimes(item, Date.now(), utcOffsetAt) : null;
    $: figures = version >= 0 && $routeFeatureChanges >= 0 ? routeTrip($routeFeatures, { item }) : { chips: [], note: '' };

    // a ride for another day says which; one that goes on past midnight says how many days
    const clock = (at: number) => formatTime(at, 'LT', times.offsetAt(at));
    $: leaveDay = times && dayFormat(times.startDay);
    $: leave = !times ? '' : times.now ? lc('now') : `${leaveDay ? formatTime(times.start, leaveDay, times.offsetAt(times.start)) + ' ' : ''}${clock(times.start)}`;
    $: arrive = !times ? '' : `${clock(times.end)}${times.endShift > 0 ? ' +' + times.endShift : ''}`;
</script>

{#if times}
    <gridlayout columns="auto,auto,auto,*" padding="8 14" rippleColor={colorPrimary} rows="auto,auto" on:tap={() => dispatch('when')} {...$$restProps}>
        <!-- the start of a snapshot that has aged is in the colour of the banner that offers to move it -->
        <label verticalAlignment="middle">
            <cspan color={times.outdated ? colorError : colorOnSurface} fontSize={16} fontWeight="bold" text={leave} />
            <cspan color={colorOnSurfaceVariant} fontSize={11} text={'\n' + lc('trip_leave')} />
        </label>
        <label col={1} color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={16} margin="0 8" text="mdi-arrow-right" verticalAlignment="middle" />
        <label col={2} verticalAlignment="middle">
            <cspan color={colorOnSurface} fontSize={16} fontWeight="bold" text={arrive} />
            <cspan color={colorOnSurfaceVariant} fontSize={11} text={'\n' + lc('trip_arrive')} />
        </label>
        <!-- right of the times, one over the other: a week day or a date does not squeeze them. A tap says what a chip is -->
        <stacklayout col={3} horizontalAlignment="right" verticalAlignment="middle">
            {#each figures.chips.slice(0, MAX_CHIPS) as chip (chip.key)}
                <stacklayout horizontalAlignment="right" marginLeft={10} orientation="horizontal" on:tap={() => chip.help && showSnack({ message: chip.help })}>
                    <label color={isEInk ? colorOnSurface : (chip.color ?? colorOnSurfaceVariant)} fontFamily={$fonts.mdi} fontSize={16} text={chip.icon} verticalAlignment="middle" />
                    <label color={colorOnSurface} fontSize={13} marginLeft={3} text={chip.text} verticalAlignment="middle" />
                </stacklayout>
            {/each}
        </stacklayout>
        {#if figures.note}
            <label color={colorOnSurfaceVariant} colSpan={4} fontSize={11} marginTop={4} row={1} text={figures.note} textWrap={true} />
        {/if}
    </gridlayout>
{/if}
