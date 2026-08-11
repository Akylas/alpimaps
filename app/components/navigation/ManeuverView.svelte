<script lang="ts">
    import { formatDistance } from '~/helpers/formatter';
    import { isEInk } from '~/helpers/theme';
    import { isNavigationRunning, navigationProgress } from '~/stores/navigationStore';
    import { getManeuverIcon } from '~/utils/navigation';
    import { colors, fontScaleMaxed, fonts } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorWidgetBackground } = $colors);

    $: instruction = $navigationProgress?.instruction;
    $: maneuverIcon = instruction ? getManeuverIcon(instruction.a) : null;
    $: distanceToManeuver = $navigationProgress?.distanceToNextInstruction;
    // no banner while paused: pausing is how the user asks for the map and the search bar back
    $: visible = $isNavigationRunning && !!instruction;
</script>

<gridlayout
    backgroundColor={colorWidgetBackground}
    borderColor={colorOutlineVariant}
    borderRadius={isEInk ? 4 : 14}
    borderWidth={isEInk ? 1 : 0}
    columns="auto,*"
    elevation={isEInk ? 0 : 4}
    padding="10 14 10 10"
    rows="auto,auto"
    visibility={visible ? 'visible' : 'collapse'}
    {...$$restProps}>
    {#if instruction}
        <label
            class="maneuverIcon"
            color={colorOnSurface}
            fontFamily={maneuverIcon.font === 'mdi' ? $fonts.mdi : $fonts.app}
            fontSize={44 * $fontScaleMaxed}
            marginRight={12}
            rowSpan={2}
            text={maneuverIcon.icon}
            textAlignment="center"
            verticalAlignment="center"
            width={52 * $fontScaleMaxed} />
        <label
            col={1}
            color={colorOnSurface}
            fontSize={26 * $fontScaleMaxed}
            fontWeight="bold"
            text={distanceToManeuver > 0 ? formatDistance(distanceToManeuver) : ''}
            verticalTextAlignment="bottom"
            visibility={distanceToManeuver > 0 ? 'visible' : 'collapse'} />
        <label col={1} color={colorOnSurfaceVariant} fontSize={15 * $fontScaleMaxed} maxLines={2} row={1} text={instruction.name || instruction.inst} textWrap={true} verticalTextAlignment="top" />
    {/if}
</gridlayout>
