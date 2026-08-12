<script context="module" lang="ts">
    /** fixed so both cards match and a two line road name never resizes the banner */
    export const MANEUVER_VIEW_HEIGHT = 84;
</script>

<script lang="ts">
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { isNavigationRunning, navigationLocation, navigationProgress } from '~/stores/navigationStore';
    import { getManeuverIcon, splitDistance, splitElevation, splitSpeed } from '~/utils/navigation';
    import { colors, fontScaleMaxed, fonts } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    $: instruction = $navigationProgress?.instruction;
    $: maneuverIcon = instruction ? getManeuverIcon(instruction.a) : null;
    $: distanceToManeuver = $navigationProgress?.distanceToNextInstruction;
    $: distanceParts = distanceToManeuver > 0 ? splitDistance(distanceToManeuver) : null;
    // no banner while paused: pausing is how the user asks for the map and the search bar back
    $: visible = $isNavigationRunning && !!instruction;

    // through the unit machinery rather than a hardcoded km/h, so imperial users get mph
    $: speedParts = $navigationLocation?.speed >= 0 ? splitSpeed($navigationLocation.speed * 3.6) : null;
    $: altitudeParts = $navigationLocation?.altitude > 0 ? splitElevation($navigationLocation.altitude) : null;
    $: hasSideInfo = !!speedParts || !!altitudeParts;

    $: cardHeight = Math.round(MANEUVER_VIEW_HEIGHT * $fontScaleMaxed);
</script>

<!-- transparent parent with a free middle column: the map stays visible between the two cards -->
<gridlayout columns="*,auto" isPassThroughParentEnabled={true} visibility={visible ? 'visible' : 'collapse'} {...$$restProps}>
    {#if instruction}
        <NavigationCard columns="auto,*" height={cardHeight} horizontalAlignment="left" padding="6 10 6 6" rows="auto,*" width="58%">
            <label
                color={colorOnSurface}
                fontFamily={maneuverIcon.font === 'mdi' ? $fonts.mdi : $fonts.app}
                fontSize={38 * $fontScaleMaxed}
                marginRight={8}
                rowSpan={2}
                text={maneuverIcon.icon}
                textAlignment="center"
                verticalAlignment="center"
                width={44 * $fontScaleMaxed} />
            <label col={1} visibility={distanceParts ? 'visible' : 'collapse'}>
                <cspan color={colorOnSurface} fontSize={24 * $fontScaleMaxed} fontWeight="bold" text={distanceParts?.[0] ?? '-'} />
                <cspan color={colorOnSurfaceVariant} fontSize={12 * $fontScaleMaxed} text={distanceParts ? ' ' + distanceParts[1] : ''} />
            </label>
            <label
                col={1}
                color={colorOnSurfaceVariant}
                fontSize={14 * $fontScaleMaxed}
                lineBreak="end"
                maxLines={2}
                row={1}
                text={instruction.name || instruction.inst}
                textWrap={true}
                verticalTextAlignment="top" />
        </NavigationCard>

        <NavigationCard col={1} height={cardHeight} marginLeft={10} padding="6 12 6 12" visibility={hasSideInfo ? 'visible' : 'collapse'}>
            <stacklayout verticalAlignment="center">
                <label visibility={speedParts ? 'visible' : 'collapse'}>
                    <cspan color={colorOnSurface} fontSize={28 * $fontScaleMaxed} fontWeight="bold" text={speedParts?.[0] ?? ''} />
                    <cspan color={colorOnSurfaceVariant} fontSize={12 * $fontScaleMaxed} text={speedParts ? ' ' + speedParts[1] : ''} />
                </label>
                <label visibility={altitudeParts ? 'visible' : 'collapse'}>
                    <cspan color={colorOnSurface} fontSize={17 * $fontScaleMaxed} text={altitudeParts?.[0] ?? ''} />
                    <cspan color={colorOnSurfaceVariant} fontSize={11 * $fontScaleMaxed} text={altitudeParts ? ' ' + altitudeParts[1] : ''} />
                </label>
            </stacklayout>
        </NavigationCard>
    {/if}
</gridlayout>
