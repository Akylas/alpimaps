<script lang="ts">
    // the open state of an item as a tinted chip: open, closed, or while its hours are unknown a tappable
    // "check hours" that asks the parent to look them up. A layout rather than a button, as the Pill
    import { capitalize, lc } from '@nativescript-community/l';
    import { Color } from '@nativescript/core';
    import { createEventDispatcher } from 'svelte';
    import { CLOSED_COLOR, OPEN_COLOR, openingHoursText } from '~/helpers/formatter';
    import { canLookupOSMDetails, networkOnline, osmDetailsStates, osmItemKey } from '~/helpers/osmDetails';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { osmItemDetails } from '~/stores/mapStore';
    import { colors, fontScaleMaxed, fonts } from '~/variables';

    export let item: IItem;
    /** Off where the lookup already runs by itself: the unknown state is then not shown. */
    export let checkable = true;

    const dispatch = createEventDispatcher<{ fetch: void }>();

    const STATE_TEXT_COLORS = { open: { light: '#1f7a58', dark: '#7ddab5' }, closed: { light: '#c20000', dark: '#ff8f87' } };

    $: ({ colorOnSurface, colorOutlineSoft, colorPanel, colorPrimary } = $colors);

    $: data = openingHoursText(item);
    $: details = $osmDetailsStates[osmItemKey(item)];
    $: state = data
        ? data.isOpened
            ? 'open'
            : 'closed'
        : !$osmItemDetails
          ? 'hidden'
          : details?.loading
            ? 'loading'
            : checkable && $networkOnline && !details?.missed && canLookupOSMDetails(item)
              ? 'unknown'
              : 'hidden';

    // the state colour as text would not read on its own tint, so a deeper shade on light and a lighter one on dark
    $: isDark = new Color(colorPanel).isDark();
    $: tint = state === 'open' ? OPEN_COLOR : state === 'closed' ? CLOSED_COLOR : null;
    $: contentColor = isEInk ? colorOnSurface : STATE_TEXT_COLORS[state] ? STATE_TEXT_COLORS[state][isDark ? 'dark' : 'light'] : state === 'unknown' ? colorPrimary : colorOnSurface;
    $: icon = state === 'open' ? 'mdi-check-circle-outline' : state === 'closed' ? 'mdi-close-circle-outline' : 'mdi-store-clock-outline';
    $: label = data ? capitalize(data.label) : '';
    $: text = state === 'unknown' ? lc('osm_check_hours') : state === 'loading' ? lc('osm_checking') : data?.detail ? label + ' · ' + data.detail : label;

    function onTap() {
        if (state === 'unknown') {
            dispatch('fetch');
        }
    }
</script>

{#if state !== 'hidden'}
    <gridlayout
        backgroundColor={tint && !isEInk ? new Color(tint).setAlpha(36).hex : null}
        borderColor={isEInk ? colorOnSurface : tint ? 'transparent' : colorOutlineSoft}
        borderRadius={14}
        borderWidth={1}
        horizontalAlignment="left"
        rippleColor={state === 'unknown' ? colorPrimary : 'transparent'}
        rows="auto"
        {...$$restProps}
        on:tap={onTap}>
        <stacklayout horizontalAlignment="center" orientation="horizontal" padding="4 10 4 8" verticalAlignment="middle">
            {#if state === 'loading'}
                <activityindicator busy={true} color={contentColor} height={14} marginRight={6} verticalAlignment="middle" width={14} />
            {:else}
                <label color={contentColor} fontFamily={$fonts.mdi} fontSize={16 * $fontScaleMaxed} marginRight={6} text={icon} verticalAlignment="middle" />
            {/if}
            <label color={contentColor} fontSize={12 * $fontScaleMaxed} fontWeight="500" maxLines={1} {text} verticalAlignment="middle" />
        </stacklayout>
    </gridlayout>
{/if}
