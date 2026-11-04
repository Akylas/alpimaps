<script lang="ts">
    // the 40 dp row under the lens bar: the focused section with its steppers, else the headline
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { isEInk } from '~/helpers/theme';
    import type { LensFact, LensHeadline } from '~/routeFeatures/registry';
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
    let { colorAccentContainer, colorError, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors;
    $: ({ colorAccentContainer, colorError, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors);

    $: accent = isEInk ? colorOnSurface : colorPrimary;
    // e-ink has no colour to give a figure
    function factColor(fact: LensFact) {
        return isEInk ? colorOnSurface : fact.alert ? colorError : (fact.color ?? colorOnSurfaceVariant);
    }
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
            <!-- the facts as small chips, an icon and its figure in each, the way the tiles read -->
            <stacklayout orientation="horizontal" verticalAlignment="middle">
                {#each headline.facts as fact}
                    <gridlayout
                        backgroundColor={isEInk ? null : colorSurfaceFill}
                        borderColor={colorOnSurface}
                        borderRadius={13}
                        borderWidth={isEInk ? 1 : 0}
                        height={26}
                        horizontalAlignment="left"
                        marginRight={6}
                        padding="0 9">
                        <!-- always the same spans: a formatted string whose children come and go breaks the update -->
                        <label color={colorOnSurface} fontSize={12} maxLines={1} verticalAlignment="middle">
                            <span color={factColor(fact)} fontFamily={$fonts.mdi} fontSize={14} text={fact.icon ?? ''} />
                            <span fontWeight="bold" text={(fact.icon ? ' ' : '') + fact.text} />
                        </label>
                    </gridlayout>
                {/each}
            </stacklayout>
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
