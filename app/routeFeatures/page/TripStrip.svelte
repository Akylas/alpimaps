<script lang="ts">
    // the ride in one line under the tiles of the route page: when it leaves and arrives, and beside the times the small figures the
    // features have for it (the sun and the moon, as oss-weather says them). A line under them for what is worth a few words
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { formatTime, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { tripTimes } from '~/routeFeatures/page/trip';
    import { routeFeatureChanges, routeFeatures, routeTrip } from '~/routeFeatures/registry';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    /** bumped when the item's analysis changed in place: the times and the figures follow */
    export let version = 0;

    // no payload: the listener gets `undefined`
    interface $$Events {
        when: undefined;
    }
    const dispatch = createEventDispatcher<$$Events>();
    /** room for three beside the times on a phone */
    const MAX_CHIPS = 3;

    let { colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    $: times = version >= 0 ? tripTimes(item, Date.now()) : null;
    $: figures = version >= 0 && $routeFeatureChanges >= 0 ? routeTrip($routeFeatures, { item }) : { chips: [], note: '' };

    // a ride for another day says which; one that goes on past midnight says how many days
    const clock = (at: number) => formatTime(at, 'LT', times.offset);
    $: leave = !times ? '' : times.now ? lc('now') : `${times.startDay === 0 ? '' : formatTime(times.start, 'ddd', times.offset) + ' '}${clock(times.start)}`;
    $: arrive = !times ? '' : `${clock(times.end)}${times.endShift > 0 ? ' +' + times.endShift : ''}`;
</script>

{#if times}
    <stacklayout padding="8 14" rippleColor={colorPrimary} on:tap={() => dispatch('when')}>
        <gridlayout columns="auto,*">
            <stacklayout orientation="horizontal" verticalAlignment="middle">
                <stacklayout>
                    <label color={colorOnSurface} fontSize={16} fontWeight="bold" text={leave} />
                    <label color={colorOnSurfaceVariant} fontSize={11} text={lc('trip_leave')} />
                </stacklayout>
                <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={16} margin="0 8" text="mdi-arrow-right" verticalAlignment="middle" />
                <stacklayout>
                    <label color={colorOnSurface} fontSize={16} fontWeight="bold" text={arrive} />
                    <label color={colorOnSurfaceVariant} fontSize={11} text={lc('trip_arrive')} />
                </stacklayout>
            </stacklayout>
            <stacklayout col={1} horizontalAlignment="right" orientation="horizontal" verticalAlignment="middle">
                {#each figures.chips.slice(0, MAX_CHIPS) as chip (chip.key)}
                    <stacklayout marginLeft={10} orientation="horizontal" verticalAlignment="middle">
                        <label color={isEInk ? colorOnSurface : (chip.color ?? colorOnSurfaceVariant)} fontFamily={$fonts.mdi} fontSize={18} text={chip.icon} verticalAlignment="middle" />
                        <label color={colorOnSurface} fontSize={13} marginLeft={3} text={chip.text} verticalAlignment="middle" />
                    </stacklayout>
                {/each}
            </stacklayout>
        </gridlayout>
        {#if figures.note}
            <label color={colorOnSurfaceVariant} fontSize={11} marginTop={4} text={figures.note} textWrap={true} />
        {/if}
    </stacklayout>
{/if}
