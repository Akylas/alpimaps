<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { getRhumbLineBearing } from '~/helpers/geolib';
    import { isNavigationRunning, navigationLocation, navigationProgress, navigationRejoinTarget, navigationScale } from '~/stores/navigationStore';
    // fixed height, so both cards match and a two line road name never resizes the banner
    import { MANEUVER_VIEW_HEIGHT, getManeuverIcon, splitDistance, splitElevation, splitSpeed } from '~/utils/navigation';
    import { computeDistanceBetween } from '~/utils/geo';
    import { colors, fonts } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    $: offRoute = !!$navigationProgress?.offRoute;
    $: instruction = offRoute ? null : $navigationProgress?.instruction;
    $: maneuverIcon = instruction ? getManeuverIcon(instruction.a) : null;
    $: distanceToManeuver = $navigationProgress?.distanceToNextInstruction;
    $: distanceParts = distanceToManeuver > 0 ? splitDistance(distanceToManeuver) : null;

    // the off-route arrow points where the dotted rejoin line on the map goes
    $: offRouteParts = $navigationProgress?.distanceFromRoute > 0 ? splitDistance($navigationProgress.distanceFromRoute) : null;
    $: rejoinDistance = $navigationRejoinTarget && $navigationLocation ? computeDistanceBetween($navigationLocation, $navigationRejoinTarget.position) : null;
    $: rejoinParts = rejoinDistance > 0 ? splitDistance(rejoinDistance) : null;
    // the map is drawn heading up while navigating, so the arrow is relative to where the user faces
    $: rejoinRotation =
        $navigationRejoinTarget && $navigationLocation
            ? getRhumbLineBearing($navigationLocation, $navigationRejoinTarget.position) - ($navigationLocation.bearing >= 0 ? $navigationLocation.bearing : 0)
            : 0;

    // no banner while paused: pausing is how the user asks for the map and the search bar back
    $: visible = $isNavigationRunning && (!!instruction || offRoute);

    // a fix with no speed (mock, or receiver that does not report one) reads as 0 rather than blank
    $: speedParts = $navigationLocation ? splitSpeed(Math.max($navigationLocation.speed ?? 0, 0) * 3.6) : null;
    $: altitudeParts = $navigationLocation?.altitude > 0 ? splitElevation($navigationLocation.altitude) : null;
    $: hasSideInfo = !!speedParts || !!altitudeParts;

    $: cardHeight = Math.round(MANEUVER_VIEW_HEIGHT * $navigationScale);

    // $: DEV_LOG &&
    //     console.log(
    //         '[ManeuverView] side info',
    //         JSON.stringify({
    //             running: $isNavigationRunning,
    //             offRoute,
    //             hasInstruction: !!instruction,
    //             bannerVisible: visible,
    //             hasLocation: !!$navigationLocation,
    //             rawSpeed: $navigationLocation?.speed,
    //             rawAltitude: $navigationLocation?.altitude,
    //             speedParts,
    //             altitudeParts,
    //             hasSideInfo
    //         })
    //     );
</script>

<!-- transparent parent with a free middle column: the map stays visible between the two cards -->
<gridlayout columns="*,auto" isPassThroughParentEnabled={true} visibility={visible ? 'visible' : 'collapse'} {...$$restProps}>
    {#if offRoute}
        <NavigationCard columns="auto,*" height={cardHeight} horizontalAlignment="left" padding="6 10 6 6" rows="auto,*" width="58%">
            <label
                color={colorOnSurface}
                fontFamily={$fonts.mdi}
                fontSize={38 * $navigationScale}
                marginRight={8}
                rotate={rejoinRotation}
                rowSpan={2}
                text="mdi-arrow-up-thin-circle-outline"
                textAlignment="center"
                verticalAlignment="center"
                width={44 * $navigationScale} />
            <label col={1} visibility={rejoinParts ? 'visible' : 'collapse'}>
                <cspan color={colorOnSurface} fontSize={24 * $navigationScale} fontWeight="bold" text={rejoinParts?.[0] ?? '-'} />
                <cspan color={colorOnSurfaceVariant} fontSize={12 * $navigationScale} text={rejoinParts ? ' ' + rejoinParts[1] : ''} />
            </label>
            <label
                col={1}
                color={colorOnSurfaceVariant}
                fontSize={14 * $navigationScale}
                lineBreak="end"
                maxLines={2}
                row={1}
                text={offRouteParts ? lc('navigation_off_route_by', offRouteParts[0] + ' ' + offRouteParts[1]) : lc('navigation_off_route')}
                textWrap={true}
                verticalTextAlignment="top" />
        </NavigationCard>
    {:else if instruction}
        <NavigationCard columns="auto,*" height={cardHeight} horizontalAlignment="left" padding="6 10 6 6" rows="auto,*" width="58%">
            <label
                color={colorOnSurface}
                fontFamily={maneuverIcon.font === 'mdi' ? $fonts.mdi : $fonts.app}
                fontSize={38 * $navigationScale}
                marginRight={8}
                rowSpan={2}
                text={maneuverIcon.icon}
                textAlignment="center"
                verticalAlignment="center"
                width={44 * $navigationScale} />
            <label col={1} visibility={distanceParts ? 'visible' : 'collapse'}>
                <cspan color={colorOnSurface} fontSize={24 * $navigationScale} fontWeight="bold" text={distanceParts?.[0] ?? '-'} />
                <cspan color={colorOnSurfaceVariant} fontSize={12 * $navigationScale} text={distanceParts ? ' ' + distanceParts[1] : ''} />
            </label>
            <label
                col={1}
                color={colorOnSurfaceVariant}
                fontSize={14 * $navigationScale}
                lineBreak="end"
                maxLines={2}
                row={1}
                text={instruction.name || instruction.inst}
                textWrap={true}
                verticalTextAlignment="top" />
        </NavigationCard>
    {/if}

    <!-- outside the branches above on purpose: speed and altitude still matter off route -->
    <NavigationCard col={1} height={cardHeight} marginLeft={10} padding="6 12 6 12" visibility={hasSideInfo ? 'visible' : 'collapse'}>
        <stacklayout verticalAlignment="center">
            <!-- `+ ''` on purpose: a span whose text is the number 0 draws nothing -->
            <label visibility={speedParts ? 'visible' : 'collapse'}>
                <cspan color={colorOnSurface} fontSize={30 * $navigationScale} fontWeight="bold" text={speedParts ? speedParts[0] + '' : ''} />
                <cspan color={colorOnSurfaceVariant} fontSize={12 * $navigationScale} text={speedParts ? ' ' + speedParts[1] : ''} />
            </label>
            <label visibility={altitudeParts ? 'visible' : 'collapse'}>
                <cspan color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={10 * $navigationScale} text="mdi-image-filter-hdr " />
                <cspan color={colorOnSurface} fontSize={13 * $navigationScale} text={altitudeParts ? altitudeParts[0] + '' : ''} />
                <cspan color={colorOnSurfaceVariant} fontSize={10 * $navigationScale} text={altitudeParts ? ' ' + altitudeParts[1] : ''} />
            </label>
        </stacklayout>
        <label
            color={colorOnSurfaceVariant}
            fontFamily={$fonts.mdi}
            fontSize={11 * $navigationScale}
            horizontalAlignment="left"
            text="mdi-speedometer"
            verticalAlignment="top"
            visibility={speedParts ? 'visible' : 'collapse'} />
    </NavigationCard>
</gridlayout>
