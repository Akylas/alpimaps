<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { confirm } from '@nativescript-community/ui-material-dialogs';
    import { showError } from '@shared/utils/showError';
    import Pill from '~/components/common/Pill.svelte';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { getRhumbLineBearing } from '~/helpers/geolib';
    import { navigationService } from '~/services/NavigationService';
    import {
        NavigationState,
        isNavigating,
        navigationAutoPause,
        navigationItem,
        navigationLocation,
        navigationProgress,
        navigationRejoinTarget,
        navigationRerouting,
        navigationScale,
        navigationState
    } from '~/stores/navigationStore';
    import { computeDistanceBetween } from '~/utils/geo';
    // fixed height in every state, so nothing anchored under it ever moves
    import { MANEUVER_VIEW_HEIGHT, getManeuverIcon, splitDistance, splitElevation, splitSpeed } from '~/utils/navigation';
    import { colors, fonts } from '~/variables';

    $: ({ colorError, colorHairline, colorOnPrimary, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceContainer } = $colors);

    $: paused = $navigationState === NavigationState.PAUSED;
    $: offRoute = !paused && !!$navigationProgress?.offRoute;
    $: instruction = offRoute || paused ? null : $navigationProgress?.instruction;
    $: maneuverIcon = instruction ? getManeuverIcon(instruction.a) : null;
    $: distanceParts = $navigationProgress?.distanceToNextInstruction > 0 ? splitDistance($navigationProgress.distanceToNextInstruction) : null;

    // the maneuver after this one: what to get ready for once this one is done
    $: following = instruction && !$navigationProgress.onDetour ? $navigationItem?.instructions?.[$navigationProgress.instructionIndex + 1] : null;
    $: followingIcon = following ? getManeuverIcon(following.a) : null;
    $: followingParts = following && $navigationProgress.distanceToFollowingInstruction > 0 ? splitDistance($navigationProgress.distanceToFollowingInstruction) : null;

    // the off-route arrow points where the dotted rejoin line on the map goes
    $: offRouteParts = $navigationProgress?.distanceFromRoute > 0 ? splitDistance($navigationProgress.distanceFromRoute) : null;
    $: rejoinDistance = $navigationRejoinTarget && $navigationLocation ? computeDistanceBetween($navigationLocation, $navigationRejoinTarget.position) : null;
    $: rejoinParts = rejoinDistance > 0 ? splitDistance(rejoinDistance) : null;
    // the map is drawn heading up while navigating, so the arrow is relative to where the user faces
    $: rejoinRotation =
        $navigationRejoinTarget && $navigationLocation
            ? getRhumbLineBearing($navigationLocation, $navigationRejoinTarget.position) - ($navigationLocation.bearing >= 0 ? $navigationLocation.bearing : 0)
            : 0;

    // the main line: an icon block, a big figure and a line of text, the same three slots in every state
    $: main = paused
        ? { icon: 'mdi-pause', font: $fonts.mdi, rotate: 0, value: lc('navigation_paused'), unit: '', text: $navigationAutoPause ? lc('navigation_resumes_moving') : '', tone: 'neutral' }
        : offRoute
          ? {
                icon: 'mdi-arrow-up-thin',
                font: $fonts.mdi,
                rotate: rejoinRotation,
                value: rejoinParts ? rejoinParts[0] + '' : '-',
                unit: rejoinParts?.[1] ?? '',
                text: $navigationRerouting ? lc('navigation_rerouting') : offRouteParts ? lc('navigation_off_route_by', offRouteParts[0] + ' ' + offRouteParts[1]) : lc('navigation_off_route'),
                tone: 'warning'
            }
          : instruction
            ? {
                  icon: maneuverIcon.icon,
                  font: maneuverIcon.font === 'mdi' ? $fonts.mdi : $fonts.app,
                  rotate: 0,
                  value: distanceParts ? distanceParts[0] + '' : '-',
                  unit: distanceParts?.[1] ?? '',
                  text: instruction.name || instruction.inst,
                  tone: 'primary'
              }
            : !$navigationProgress
              ? { icon: 'mdi-crosshairs-question', font: $fonts.mdi, rotate: 0, value: lc('navigation_waiting_gps'), unit: '', text: '', tone: 'neutral' }
              : { icon: 'mdi-flag-checkered', font: $fonts.mdi, rotate: 0, value: $navigationItem?.properties?.name ?? '', unit: '', text: '', tone: 'primary' };
    $: blockColor = main.tone === 'warning' ? colorError : main.tone === 'primary' ? colorPrimary : colorSurfaceContainer;
    $: blockIconColor = main.tone === 'neutral' ? colorOnSurfaceVariant : colorOnPrimary;
    // a word is a label, a number is the figure: it gets the big size
    $: valueFontSize = (main.unit ? 32 : 22) * $navigationScale;

    // a fix with no speed (mock, or receiver that does not report one) reads as 0 rather than blank
    $: speedParts = $navigationLocation ? splitSpeed(Math.max($navigationLocation.speed ?? 0, 0) * 3.6) : null;
    $: altitudeParts = $navigationLocation?.altitude > 0 ? splitElevation($navigationLocation.altitude) : null;

    $: cardHeight = Math.round(MANEUVER_VIEW_HEIGHT * $navigationScale);
    $: actionLineHeight = Math.round(32 * $navigationScale);
    $: blockSize = Math.round(56 * $navigationScale);

    async function run(action: () => Promise<unknown>) {
        try {
            await action();
        } catch (error) {
            showError(error);
        }
    }
    function endNavigation() {
        run(async () => {
            const result = await confirm({ title: lc('stop_navigation'), okButtonText: lc('stop_navigation'), cancelButtonText: lc('cancel') });
            if (result) {
                await navigationService.stop();
            }
        });
    }
</script>

<NavigationCard height={cardHeight} padding="0 10" rows={`*,${actionLineHeight}`} visibility={$isNavigating ? 'visible' : 'collapse'} {...$$restProps}>
    <gridlayout columns="auto,*,auto">
        <gridlayout backgroundColor={blockColor} borderRadius={14} height={blockSize} verticalAlignment="center" width={blockSize}>
            <label color={blockIconColor} fontFamily={main.font} fontSize={36 * $navigationScale} rotate={main.rotate} text={main.icon} textAlignment="center" verticalAlignment="middle" />
        </gridlayout>
        <stacklayout col={1} paddingLeft={12} verticalAlignment="center">
            <label lineBreak="end" maxLines={1}>
                <cspan color={colorOnSurface} fontSize={valueFontSize} fontWeight="bold" text={main.value} />
                <cspan color={colorOnSurfaceVariant} fontSize={15 * $navigationScale} text={main.unit ? ' ' + main.unit : ''} />
            </label>
            <label color={colorOnSurfaceVariant} fontSize={15 * $navigationScale} lineBreak="end" maxLines={1} text={main.text} visibility={main.text ? 'visible' : 'collapse'} />
        </stacklayout>
        <stacklayout col={2} paddingLeft={8} verticalAlignment="center">
            <!-- `+ ''` on purpose: a span whose text is the number 0 draws nothing -->
            <label color={colorOnSurface} fontSize={26 * $navigationScale} fontWeight="bold" text={speedParts ? speedParts[0] + '' : '-'} textAlignment="center" />
            <label color={colorOnSurfaceVariant} fontSize={11 * $navigationScale} text={speedParts?.[1] ?? 'km/h'} textAlignment="center" />
            <label
                color={colorOnSurfaceVariant}
                fontSize={11 * $navigationScale}
                text={altitudeParts ? altitudeParts.join(' ') : ''}
                textAlignment="center"
                visibility={altitudeParts ? 'visible' : 'collapse'} />
        </stacklayout>
    </gridlayout>

    <!-- the action line: always there, its content follows the state -->
    <gridlayout borderColor={colorHairline} borderTopWidth={1} columns="auto,*" row={1}>
        {#if offRoute}
            <stacklayout colSpan={2} orientation="horizontal" verticalAlignment="center">
                <Pill
                    height={actionLineHeight - 6}
                    isEnabled={!$navigationRerouting}
                    label={lc('navigation_back_to_route')}
                    marginRight={8}
                    on:tap={() => run(() => navigationService.backToRoute())} />
                <Pill
                    height={actionLineHeight - 6}
                    isEnabled={!$navigationRerouting}
                    label={lc('navigation_reroute_to_destination')}
                    on:tap={() => run(() => navigationService.rerouteToDestination())} />
            </stacklayout>
        {:else if paused}
            <Pill colSpan={2} danger={true} height={actionLineHeight - 6} icon="mdi-stop" label={lc('stop_navigation')} verticalAlignment="center" on:tap={endNavigation} />
        {:else if following}
            <label color={colorOnSurfaceVariant} fontSize={12 * $navigationScale} text={lc('navigation_then')} verticalAlignment="center" />
            <label col={1} lineBreak="end" marginLeft={6} maxLines={1} verticalAlignment="center">
                <cspan color={colorOnSurface} fontFamily={followingIcon.font === 'mdi' ? $fonts.mdi : $fonts.app} fontSize={15 * $navigationScale} text={followingIcon.icon} />
                <cspan color={colorOnSurface} fontSize={12 * $navigationScale} fontWeight="bold" text={followingParts ? ' ' + followingParts.join(' ') : ''} />
                <cspan color={colorOnSurfaceVariant} fontSize={12 * $navigationScale} text={following.name ? ' · ' + following.name : ''} />
            </label>
        {/if}
    </gridlayout>
</NavigationCard>
