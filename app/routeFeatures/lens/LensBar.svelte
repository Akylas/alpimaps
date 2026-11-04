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

    // the chip of the lens in use is brought to the middle of the row; a row not laid out yet is tried again
    const REVEAL_RETRIES = 5;
    async function revealSelected(retries = REVEAL_RETRIES) {
        await tick();
        const scrollView = scroller?.nativeView;
        const chip = chips[selected]?.nativeView;
        if (!scrollView?.content || !chip) {
            return;
        }
        if (!chip.isLayoutValid) {
            retries > 0 && setTimeout(() => revealSelected(retries - 1), 50);
            return;
        }
        const middle = chip.getLocationRelativeTo(scrollView.content).x + chip.getActualSize().width / 2;
        scrollView.scrollToHorizontalOffset(Math.max(0, middle - scrollView.getActualSize().width / 2), false);
    }
    // a lens that comes or goes moves the chips too
    $: if (selected && scroller && entries) {
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
                    <!-- always the same spans: a formatted string whose children come and go breaks the update -->
                    <label color={contentColor} fontSize={13} maxLines={1} verticalAlignment="middle">
                        <span color={chip.alert && !isEInk ? colorError : contentColor} fontFamily={$fonts.mdi} fontSize={16} text={icon} />
                        <span fontWeight={active && isEInk ? 'bold' : 'normal'} text={'  ' + label} />
                        <span fontWeight="bold" text={!missing && chip.value ? '  ' + chip.value : ''} />
                        <span color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={16} text={missing ? '  mdi-plus' : ''} />
                        <span
                            color={outdated ? OUTDATED_COLOR : colorOnSurfaceVariant}
                            fontFamily={$fonts.mdi}
                            fontSize={14}
                            text={outdated ? '  mdi-refresh' : chip.state === 'offline' ? '  mdi-cloud-off-outline' : ''} />
                    </label>
                    {#if chip.state === 'running'}
                        <activityindicator busy={true} height={14} marginLeft={6} verticalAlignment="middle" width={14} />
                    {/if}
                </stacklayout>
                {#if chip.alert && isEInk}
                    <gridlayout backgroundColor={colorOnSurface} borderRadius={3} height={6} horizontalAlignment="right" margin="4 6 0 0" verticalAlignment="top" width={6} />
                {/if}
            </gridlayout>
        {/each}
    </stacklayout>
</scrollview>
