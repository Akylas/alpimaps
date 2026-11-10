<script lang="ts">
    // the ride under the tiles of the route page: when it leaves and arrives, and under the times the small figures the features have for it
    // (the sun and the moon, as oss-weather says them), a tap on one saying what it is. A line under them for what is worth a few words
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
    /** under the times, a line or two */
    const MAX_CHIPS = 5;

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
    <stacklayout padding="8 14" rippleColor={colorPrimary} on:tap={() => dispatch('when')}>
        <stacklayout orientation="horizontal" verticalAlignment="middle">
            <stacklayout>
                <!-- the start of a snapshot that has aged is in the colour of the banner that offers to move it -->
                <label color={times.outdated ? colorError : colorOnSurface} fontSize={16} fontWeight="bold" text={leave} />
                <label color={colorOnSurfaceVariant} fontSize={11} text={lc('trip_leave')} />
            </stacklayout>
            <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={16} margin="0 8" text="mdi-arrow-right" verticalAlignment="middle" />
            <stacklayout>
                <label color={colorOnSurface} fontSize={16} fontWeight="bold" text={arrive} />
                <label color={colorOnSurfaceVariant} fontSize={11} text={lc('trip_arrive')} />
            </stacklayout>
        </stacklayout>
        <!-- under the times, where a week day or a date does not squeeze them: they go on a second line when they do not fit. A tap says what a chip is -->
        <wraplayout visibility={figures.chips.length ? 'visible' : 'collapse'}>
            {#each figures.chips.slice(0, MAX_CHIPS) as chip (chip.key)}
                <stacklayout marginRight={12} marginTop={6} orientation="horizontal" verticalAlignment="middle" on:tap={() => chip.help && showSnack({ message: chip.help })}>
                    <label color={isEInk ? colorOnSurface : (chip.color ?? colorOnSurfaceVariant)} fontFamily={$fonts.mdi} fontSize={18} text={chip.icon} verticalAlignment="middle" />
                    <label color={colorOnSurface} fontSize={13} marginLeft={3} text={chip.text} verticalAlignment="middle" />
                </stacklayout>
            {/each}
        </wraplayout>
        {#if figures.note}
            <label color={colorOnSurfaceVariant} fontSize={11} marginTop={4} text={figures.note} textWrap={true} />
        {/if}
    </stacklayout>
{/if}
