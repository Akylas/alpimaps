<script lang="ts">
    // a row of the Road safety card of the route page: the bar of what is fast and unprotected, a risky section with its
    // speed sign, the note on where the figures come from. A tap on a section asks to focus it
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import type { LensSection } from '~/routeFeatures/registry';
    import { ROAD_COLORS } from '~/routeFeatures/road/palette';
    import { readRoad, roadWords } from '~/routeFeatures/road/read';
    import type { RoadRowData } from '~/routeFeatures/road/rows';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    export let data: RoadRowData;

    interface $$Events {
        focus: LensSection;
    }
    const dispatch = createEventDispatcher<$$Events>();

    let { colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    // nothing is told apart by colour on e-ink: black, a grey and a light one
    const swatch = isEInk ? { high: '#000000', medium: '#7A7A7A', rest: '#D6D6D6' } : { high: ROAD_COLORS[3], medium: ROAD_COLORS[2], rest: ROAD_COLORS.core };
    $: parts =
        data.type === 'bar'
            ? [
                  { id: 'high', meters: data.high, color: swatch.high, label: lc('road_level_high') },
                  { id: 'medium', meters: data.medium, color: swatch.medium, label: lc('road_level_medium') },
                  { id: 'rest', meters: Math.max(data.total - data.high - data.medium, 0), color: swatch.rest, label: lc('road_bar_rest') }
              ].filter((part) => part.meters > 0)
            : [];
</script>

{#if data.type === 'bar'}
    <stacklayout padding="8 16">
        <gridlayout borderRadius={5} columns={parts.map((part) => part.meters + '*').join(',') || '*'} height={10}>
            {#each parts as part, index}
                <absolutelayout backgroundColor={part.color} col={index} />
            {/each}
        </gridlayout>
        {#each parts as part}
            <gridlayout columns="22,*,auto" height={26}>
                <label color={part.color} fontFamily={$fonts.mdi} fontSize={14} text="mdi-square-rounded" verticalAlignment="middle" />
                <label col={1} color={colorOnSurface} fontSize={13} text={part.label} verticalAlignment="middle" />
                <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={formatDistance(part.meters)} verticalAlignment="middle" />
            </gridlayout>
        {/each}
    </stacklayout>
{:else if data.type === 'section'}
    <gridlayout columns="46,*" height={56} padding="0 16" rippleColor={colorPrimary} on:tap={() => dispatch('focus', readRoad(item)?.sections[data.id])}>
        <!-- the speed sign: a white disc in a ring -->
        <gridlayout backgroundColor="#ffffff" borderColor={isEInk ? '#000000' : '#D7263D'} borderRadius={16} borderWidth={3} height={32} horizontalAlignment="left" verticalAlignment="middle" width={32}>
            <label color="#1b1c1d" fontSize={11} fontWeight="bold" horizontalAlignment="center" text={roadWords.speedNumber(data.run.section.speed)} verticalAlignment="middle" />
        </gridlayout>
        <stacklayout col={1} verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={14} fontWeight="bold" text={`${formatDistance(data.run.section.length)} · ${lc(data.run.section.level === 3 ? 'road_level_high' : 'road_level_medium')}`} />
            <label
                color={colorOnSurfaceVariant}
                fontSize={12}
                text={`${formatDistance(data.run.section.startDist)} → ${formatDistance(data.run.section.startDist + data.run.section.length)} · ${roadWords.speed(data.run.section.speed)}`} />
        </stacklayout>
    </gridlayout>
{:else}
    <label color={colorOnSurfaceVariant} fontSize={12} padding="8 16 12 16" text={lc('road_note') + (data.unknown > 0 ? ' ' + lc('road_unknown', formatDistance(data.unknown)) : '')} textWrap={true} />
{/if}
