<script lang="ts">
    // the row of lenses: one chip each, with its headline value and what state its data is in. Layouts,
    // not buttons: inside the item sheet its pan gesture swallows a native button's touches (see Pill)
    import type { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import type { GridLayout, ScrollView } from '@nativescript/core';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { tick } from 'svelte';
    import { isEInk } from '~/helpers/theme';
    import type { LensChip, LensId } from '~/routeFeatures/registry';
    import { colors, fonts } from '~/variables';

    export let entries: { id: LensId; icon: string; label: string; chip: LensChip }[];
    export let selected: LensId;

    // an outdated lens keeps its data but looks it: there is no theme colour for amber
    const OUTDATED_COLOR = '#F0902B';
    const CHIP_HEIGHT = 32;

    // the shared dispatcher hands the payload itself to the listener, not a `CustomEvent`
    interface $$Events {
        select: { id: LensId };
    }
    const dispatch = createEventDispatcher<$$Events>();
    let { colorAccentContainer, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineSoft, colorPrimary } = $colors;
    $: ({ colorAccentContainer, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineSoft, colorPrimary } = $colors);

    let scroller: NativeViewElementNode<ScrollView>;
    const chips: Record<string, NativeViewElementNode<GridLayout>> = {};

    // the chip of the lens in use is brought to the middle of the row
    async function revealSelected() {
        await tick();
        const scrollView = scroller?.nativeView;
        const chip = chips[selected]?.nativeView;
        if (!scrollView?.content || !chip || !chip.isLayoutValid) {
            return;
        }
        const middle = chip.getLocationRelativeTo(scrollView.content).x + chip.getActualSize().width / 2;
        scrollView.scrollToHorizontalOffset(Math.max(0, middle - scrollView.getActualSize().width / 2), false);
    }
    $: if (selected && scroller) {
        revealSelected();
    }
</script>

<scrollview bind:this={scroller} height={44} orientation="horizontal" scrollBarIndicatorVisible={false} {...$$restProps}>
    <stacklayout orientation="horizontal" padding="0 10" verticalAlignment="middle">
        {#each entries as { chip, icon, id, label } (id)}
            {@const active = id === selected}
            {@const outdated = chip.state === 'outdated'}
            {@const missing = chip.state === 'missing'}
            {@const contentColor = active && !isEInk ? colorPrimary : colorOnSurface}
            <gridlayout
                bind:this={chips[id]}
                backgroundColor={active && !isEInk ? colorAccentContainer : null}
                borderColor={active ? (isEInk ? colorOnSurface : colorPrimary) : outdated ? OUTDATED_COLOR : colorOutlineSoft}
                borderRadius={CHIP_HEIGHT / 2}
                borderWidth={active && isEInk ? 2.5 : 1}
                height={CHIP_HEIGHT}
                marginRight={6}
                opacity={missing ? 0.7 : 1}
                rippleColor={colorPrimary}
                verticalAlignment="middle"
                on:tap={() => dispatch('select', { id })}>
                <stacklayout orientation="horizontal" padding="0 10" verticalAlignment="middle">
                    <label color={contentColor} fontSize={13} maxLines={1} verticalAlignment="middle">
                        <span fontFamily={$fonts.mdi} fontSize={16} text={icon} />
                        <span fontWeight={active && isEInk ? 'bold' : 'normal'} text={'  ' + label} />
                        {#if missing}
                            <span color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={16} text="  mdi-plus" />
                        {:else if chip.value}
                            <span fontWeight="bold" text={'  ' + chip.value} />
                        {/if}
                        {#if outdated}
                            <span color={OUTDATED_COLOR} fontFamily={$fonts.mdi} fontSize={14} text="  mdi-refresh" />
                        {:else if chip.state === 'offline'}
                            <span color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={14} text="  mdi-cloud-off-outline" />
                        {/if}
                    </label>
                    {#if chip.state === 'running'}
                        <activityindicator busy={true} height={14} marginLeft={6} verticalAlignment="middle" width={14} />
                    {/if}
                </stacklayout>
                {#if chip.alert}
                    <gridlayout backgroundColor={isEInk ? colorOnSurface : colorError} borderRadius={3} height={6} horizontalAlignment="right" margin="4 6 0 0" verticalAlignment="top" width={6} />
                {/if}
            </gridlayout>
        {/each}
    </stacklayout>
</scrollview>
