<script lang="ts">
    // the next side streets that may be entered, for the travel mode: `← 90 m` on the left, `60 m →` on the right,
    // and in the middle a no-entry or a dead end ahead. Filled pills with a hairline, like the map buttons
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { junctionChips } from '~/mapModules/JunctionOptionsModule';
    import { colors, fonts } from '~/variables';

    let { colorError, colorHairline, colorOnSurface, colorPanel, colorPrimary } = $colors;
    $: ({ colorError, colorHairline, colorOnSurface, colorPanel, colorPrimary } = $colors);

    $: left = $junctionChips?.left;
    $: right = $junctionChips?.right;
    $: ahead = $junctionChips?.ahead;
    $: borderColor = isEInk ? '#000000' : colorHairline;
</script>

{#if left || right || ahead}
    <gridlayout columns="auto,*,auto" isPassThroughParentEnabled={true} {...$$restProps}>
        {#if left}
            <stacklayout class="chip" backgroundColor={colorPanel} {borderColor} col={0} orientation="horizontal" verticalAlignment="middle">
                <label color={isEInk ? colorOnSurface : colorPrimary} fontFamily={$fonts.mdi} fontSize={20} text="mdi-arrow-left" verticalAlignment="middle" />
                <label color={colorOnSurface} fontSize={15} fontWeight="bold" paddingLeft={6} text={formatDistance(left.distance)} verticalAlignment="middle" />
            </stacklayout>
        {/if}
        {#if ahead}
            <stacklayout
                class="chip danger"
                backgroundColor={colorPanel}
                borderColor={isEInk ? '#000000' : colorError}
                col={1}
                horizontalAlignment="center"
                orientation="horizontal"
                verticalAlignment="middle">
                <label color={colorError} fontFamily={$fonts.mdi} fontSize={20} text="mdi-hand-back-right" verticalAlignment="middle" />
                <label
                    color={colorError}
                    fontSize={15}
                    fontWeight="bold"
                    paddingLeft={6}
                    text={`${lc(ahead.kind === 'noEntry' ? 'junction_no_entry' : 'junction_road_ends')} · ${formatDistance(ahead.distance)}`}
                    verticalAlignment="middle" />
            </stacklayout>
        {/if}
        {#if right}
            <stacklayout class="chip" backgroundColor={colorPanel} {borderColor} col={2} horizontalAlignment="right" orientation="horizontal" verticalAlignment="middle">
                <label color={colorOnSurface} fontSize={15} fontWeight="bold" paddingRight={6} text={formatDistance(right.distance)} verticalAlignment="middle" />
                <label color={isEInk ? colorOnSurface : colorPrimary} fontFamily={$fonts.mdi} fontSize={20} text="mdi-arrow-right" verticalAlignment="middle" />
            </stacklayout>
        {/if}
    </gridlayout>
{/if}
