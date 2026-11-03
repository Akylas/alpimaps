<script lang="ts">
    // the 40 dp row under the lens bar. One of three states, the first that is set: the readout of a
    // point being scrubbed (tap it to clear), the focused section with its steppers, else the headline
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { isEInk } from '~/helpers/theme';
    import type { LensHeadline } from '~/routeFeatures/registry';
    import { colors, fonts } from '~/variables';

    export let headline: LensHeadline = null;
    /** a `›` after the headline: there is more to read behind it */
    export let more = false;
    /** the figures of the point under the cursor and the active lens' own value there */
    export let readout: { text: string; value?: string } = null;
    export let focus: { text: string } = null;

    const dispatch = createEventDispatcher();
    let { colorAccentContainer, colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorAccentContainer, colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    $: accent = isEInk ? colorOnSurface : colorPrimary;
</script>

<gridlayout height={40} {...$$restProps}>
    {#if readout}
        <gridlayout
            backgroundColor={isEInk ? null : colorAccentContainer}
            borderColor={accent}
            borderRadius={14}
            borderWidth={1}
            columns="*,auto,auto"
            margin="4 6"
            on:tap={() => dispatch('clearReadout')}>
            <label color={colorOnSurface} fontSize={13} lineBreak="end" maxLines={1} padding="0 0 0 8" verticalAlignment="middle">
                <span color={accent} fontFamily={$fonts.mdi} fontSize={16} text="mdi-map-marker" />
                <span fontWeight="bold" text={'  ' + readout.text} />
            </label>
            {#if readout.value}
                <label col={1} color={accent} fontSize={13} fontWeight="bold" maxLines={1} padding="0 0 0 8" text={readout.value} verticalAlignment="middle" />
            {/if}
            <label col={2} color={accent} fontFamily={$fonts.mdi} fontSize={16} padding="0 8" text="mdi-close" verticalAlignment="middle" />
        </gridlayout>
    {:else if focus}
        <gridlayout columns="40,*,40,40">
            <label
                color={accent}
                fontFamily={$fonts.mdi}
                fontSize={22}
                rippleColor={colorPrimary}
                text="mdi-chevron-left"
                textAlignment="center"
                verticalAlignment="middle"
                on:tap={() => dispatch('previous')} />
            <label col={1} color={colorOnSurface} fontSize={14} fontWeight="bold" lineBreak="end" maxLines={1} text={focus.text} textAlignment="center" verticalAlignment="middle" />
            <label
                col={2}
                color={accent}
                fontFamily={$fonts.mdi}
                fontSize={22}
                rippleColor={colorPrimary}
                text="mdi-chevron-right"
                textAlignment="center"
                verticalAlignment="middle"
                on:tap={() => dispatch('next')} />
            <label
                col={3}
                color={colorOnSurfaceVariant}
                fontFamily={$fonts.mdi}
                fontSize={18}
                rippleColor={colorPrimary}
                text="mdi-close"
                textAlignment="center"
                verticalAlignment="middle"
                on:tap={() => dispatch('clearFocus')} />
        </gridlayout>
    {:else if headline}
        <gridlayout columns="*,auto" padding="0 12" rippleColor={colorPrimary} on:tap={() => more && !headline.action && dispatch('more')}>
            <label color={colorOnSurface} fontSize={14} lineBreak="end" maxLines={1} text={headline.text} verticalAlignment="middle" />
            {#if headline.action}
                <gridlayout
                    backgroundColor={isEInk ? null : colorAccentContainer}
                    borderColor={accent}
                    borderRadius={16}
                    borderWidth={isEInk ? 1 : 0}
                    col={1}
                    height={32}
                    marginLeft={8}
                    padding="0 14"
                    rippleColor={colorPrimary}
                    verticalAlignment="middle"
                    on:tap={headline.action.run}>
                    <label color={accent} fontSize={13} fontWeight="bold" text={headline.action.label} verticalAlignment="middle" />
                </gridlayout>
            {:else if more}
                <label col={1} color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={22} text="mdi-chevron-right" verticalAlignment="middle" />
            {/if}
        </gridlayout>
    {/if}
</gridlayout>
