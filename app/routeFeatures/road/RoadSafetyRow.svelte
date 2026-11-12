<script lang="ts">
    // a row of the Road safety card of the route page: the bar of what is fast and unprotected, a risky section with its
    // speed sign, the note on where the figures come from. A tap on a section asks to focus it
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { barGradient } from '~/routeFeatures/lens/barGradient';
    import type { LensSection } from '~/routeFeatures/registry';
    import { ROAD_SHARE_COLORS, ROAD_SHARE_EINK } from '~/routeFeatures/road/palette';
    import { readRoad, roadWords } from '~/routeFeatures/road/read';
    import { ROAD_SHARE_LABELS, type RoadRowData, type RoadShareId } from '~/routeFeatures/road/rows';
    import { roadSectionsOpen } from '~/routeFeatures/road/settings';
    import SpeedSign from '~/routeFeatures/road/SpeedSign.svelte';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    export let data: RoadRowData;

    interface $$Events {
        focus: LensSection;
    }
    const dispatch = createEventDispatcher<$$Events>();

    let { colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    const swatch = (id: RoadShareId) => (isEInk ? ROAD_SHARE_EINK[id] : ROAD_SHARE_COLORS[id]);
</script>

{#if data.type === 'bar'}
    <gridlayout columns="*,auto" padding="8 16" rows={['10', ...data.shares.map(() => '26')].join(',')}>
        <gridlayout backgroundImage={barGradient(data.shares.map((share) => ({ color: swatch(share.id), size: share.meters })))} borderRadius={5} colSpan={2} />
        {#each data.shares as share, index}
            <label color={colorOnSurface} fontSize={13} row={index + 1} verticalTextAlignment="middle">
                <cspan color={swatch(share.id)} fontFamily={$fonts.mdi} fontSize={14} text="mdi-square-rounded" />
                <cspan text={'\u2002' + lc(ROAD_SHARE_LABELS[share.id])} />
            </label>
            <label col={1} color={colorOnSurfaceVariant} fontSize={13} row={index + 1} text={formatDistance(share.meters)} verticalTextAlignment="middle" />
        {/each}
    </gridlayout>
{:else if data.type === 'header'}
    <gridlayout columns="24,*,auto" height={44} padding="0 16" rippleColor={colorPrimary} on:tap={() => roadSectionsOpen.set(!$roadSectionsOpen)}>
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text={data.open ? 'mdi-chevron-down' : 'mdi-chevron-right'} verticalAlignment="middle" />
        <label class="sectionHeader" col={1} padding="0" text={lc('road_sections')} verticalAlignment="middle" />
        <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={String(data.count)} verticalAlignment="middle" />
    </gridlayout>
{:else if data.type === 'section'}
    {@const section = data.run.section}
    <gridlayout columns="46,*" height={56} padding="0 16" rippleColor={colorPrimary} on:tap={() => dispatch('focus', readRoad(item)?.sections[data.id])}>
        <SpeedSign fontSize={11} horizontalAlignment="left" ringColor="#D7263D" size={32} text={roadWords.speedNumber(section.speed)} />
        <label col={1} verticalAlignment="middle">
            <cspan color={colorOnSurface} fontSize={14} fontWeight="bold" text={`${formatDistance(section.length)} · ${lc(section.level === 3 ? 'road_level_high' : 'road_level_medium')}`} />
            <cspan color={colorOnSurfaceVariant} fontSize={12} text={`\n${formatDistance(section.startDist)} → ${formatDistance(section.startDist + section.length)} · ${roadWords.speed(section.speed)}`} />
        </label>
    </gridlayout>
{:else}
    <label color={colorOnSurfaceVariant} fontSize={12} padding="8 16 12 16" text={lc('road_note') + (data.unknown > 0 ? ' ' + lc('road_unknown', formatDistance(data.unknown)) : '')} textWrap={true} />
{/if}
