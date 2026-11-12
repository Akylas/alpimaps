<script lang="ts">
    // the 40 dp row under the lens bar: the focused section with its steppers, else the headline
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import Chip from '~/components/common/Chip.svelte';
    import { isEInk } from '~/helpers/theme';
    import type { LensHeadline } from '~/routeFeatures/registry';
    import { colors, fonts } from '~/variables';

    export let headline: LensHeadline = null;
    /** a `›` after the headline: there is more to read behind it */
    export let more = false;
    export let focus: { text: string } = null;

    // no payload: the listener gets `undefined`
    interface $$Events {
        previous: undefined;
        next: undefined;
        clearFocus: undefined;
        more: undefined;
    }
    const dispatch = createEventDispatcher<$$Events>();
    let { colorAccentContainer, colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorAccentContainer, colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    $: accent = isEInk ? colorOnSurface : colorPrimary;
</script>

<gridlayout height={40} {...$$restProps}>
    {#if focus}
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
            <!-- the facts as chips, as the weather card draws them: an icon, a bold figure and its unit, washed by what they are about -->
            <stacklayout orientation="horizontal" verticalAlignment="middle">
                {#each headline.facts as fact}
                    <Chip
                        alert={fact.alert}
                        bar={fact.bar ?? null}
                        color={fact.color}
                        icon={fact.icon}
                        iconColor={fact.iconColor}
                        label={fact.label}
                        marginTop={0}
                        note={fact.note}
                        text={fact.text}
                        tint={fact.tint}
                        unit={fact.unit}
                        value={fact.value} />
                {/each}
            </stacklayout>
            {#if headline.action}
                <label
                    backgroundColor={isEInk ? null : colorAccentContainer}
                    borderColor={accent}
                    borderRadius={16}
                    borderWidth={isEInk ? 1 : 0}
                    col={1}
                    color={accent}
                    fontSize={13}
                    fontWeight="bold"
                    height={32}
                    marginLeft={8}
                    padding="0 14"
                    rippleColor={colorPrimary}
                    text={headline.action.label}
                    verticalAlignment="middle"
                    verticalTextAlignment="middle"
                    on:tap={headline.action.run} />
            {:else if more}
                <label col={1} color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={22} text="mdi-chevron-right" verticalAlignment="middle" />
            {/if}
        </gridlayout>
    {/if}
</gridlayout>
