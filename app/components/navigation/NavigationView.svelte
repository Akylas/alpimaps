<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { DismissReasons } from '@nativescript-community/ui-snackbar';
    import type { EventData } from '@nativescript/core';
    import { onDestroy } from 'svelte';
    import NavigationActions from '~/components/navigation/NavigationActions.svelte';
    import NavigationCard, { CARD_BORDER_WIDTH, CARD_RADIUS } from '~/components/navigation/NavigationCard.svelte';
    import NavigationControls from '~/components/navigation/NavigationControls.svelte';
    import NavigationInfo from '~/components/navigation/NavigationInfo.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { formatTime } from '~/helpers/locale';
    import { lazyComponents, routeFeatureChanges, routeFeatures, routeNavSections } from '~/routeFeatures/registry';
    import { NavigationReroutedEvent, navigationService } from '~/services/NavigationService';
    import { NavigationState, navigationItem, navigationProgress, navigationScale, navigationState, navigationStats } from '~/stores/navigationStore';
    import { formatNavigationDuration, getCurrentAscent, navigationSections, splitDistance, splitDuration, splitElevation, splitSpeed } from '~/utils/navigation';
    import { showSnack } from '~/utils/ui';
    import { colors } from '~/variables';

    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorPanel } = $colors);

    async function onRerouted(event: EventData & { data?: { auto: boolean } }) {
        if (!event.data?.auto) {
            return;
        }
        const result = await showSnack({ message: lc('navigation_rerouted'), actionText: lc('navigation_undo_reroute'), hideDelay: 10000 });
        if (result?.reason === DismissReasons.ACTION) {
            navigationService.undoReroute();
        }
    }
    navigationService.on(NavigationReroutedEvent, onRerouted);
    onDestroy(() => navigationService.off(NavigationReroutedEvent, onRerouted));

    $: profile = $navigationItem?.profile;
    // the same sections the map builds the sheet steps from, so a step ends where its section does
    $: contributed = $routeFeatureChanges >= 0 ? routeNavSections($routeFeatures, { item: $navigationItem }, $navigationScale) : [];
    $: sections = navigationSections($navigationScale, contributed);
    $: aheadSections = contributed.filter((layout) => layout.section.slot === 'ahead');
    $: detailSections = contributed.filter((layout) => layout.section.slot === 'details');
    // the sections' components load the first time they have a height
    const sectionComponents = lazyComponents();
    $: contributed.forEach((layout) => sectionComponents.load(layout.id, layout.section.component));

    $: paused = $navigationState === NavigationState.PAUSED;
    $: offRoute = !!$navigationProgress?.offRoute;
    $: remainingDistance = $navigationProgress?.remainingDistance;
    $: remainingTime = $navigationProgress?.remainingTime;
    $: eta = remainingTime > 0 ? formatTime(Date.now() + remainingTime * 1000) : null;

    // profile dp is the ascent accumulated up to each point
    $: pointData = profile?.data?.[$navigationProgress?.onPathIndex];
    $: remainingAscent = profile && pointData && !isNaN(pointData.dp) ? Math.max(profile.dplus - pointData.dp, 0) : null;
    $: currentAscent = getCurrentAscent(profile, $navigationProgress?.onPathIndex ?? -1);

    $: distanceParts = remainingDistance > 0 ? splitDistance(remainingDistance) : null;
    $: ascentParts = remainingAscent !== null ? splitElevation(remainingAscent) : null;
    $: offRouteParts = $navigationProgress?.distanceFromRoute > 0 ? splitDistance($navigationProgress.distanceFromRoute) : null;

    // the secondary line: what is live right now, most specific first, the arrival on the right
    $: liveText = paused
        ? $navigationStats
            ? `${lc('navigation_moving')} ${formatNavigationDuration(($navigationStats.duration || 0) / 1000)} · ${lc('navigation_done')} ${formatDistance($navigationStats.distance)}`
            : ''
        : offRoute && offRouteParts
          ? lc('navigation_off_route_by', offRouteParts[0] + ' ' + offRouteParts[1])
          : currentAscent?.remainingGain > 0
            ? `${lc('navigation_this_climb')} +${splitElevation(currentAscent.remainingGain).join(' ')} · ${formatDistance(currentAscent.remainingDistance)}`
            : remainingTime > 0
              ? `${formatNavigationDuration(remainingTime)} ${lc('navigation_time_left')}`
              : '';

    $: stats = $navigationStats;
    $: doneParts = stats ? splitDistance(stats.distance || 0) : null;
    $: climbedParts = stats ? splitElevation(stats.altitudeGain || 0) : null;
    $: movingParts = stats ? splitDuration((stats.duration || 0) / 1000) : null;
    $: speedParts = stats ? splitSpeed(stats.averageSpeed || 0) : null;
</script>

<gridlayout rows={[sections.bar, sections.trip, sections.ahead, sections.actions, ...sections.details].join(',')} {...$$restProps}>
    <!-- the bar, the same in every state: the main figures and the primary button, then one live line -->
    <NavigationCard margin="0 8 8 8" padding="0 10 0 14" rows="auto,*,auto">
        <!-- the sheet drags from anywhere on the bar; the handle says it does -->
        <absolutelayout backgroundColor={colorOutline} borderRadius={2} height={4} horizontalAlignment="center" marginTop={6} opacity={0.6} width={32} />
        <gridlayout columns="*,*,auto" row={1}>
            <NavigationInfo label={lc('remaining_distance')} unit={distanceParts?.[1]} value={distanceParts ? distanceParts[0] + '' : '-'} />
            <NavigationInfo col={1} label={lc('remaining_ascent')} unit={ascentParts?.[1]} value={ascentParts ? '+' + ascentParts[0] : '-'} />
            <NavigationControls col={2} verticalAlignment="center" />
        </gridlayout>
        <gridlayout borderColor={colorHairline} borderTopWidth={1} columns="*,auto" height={Math.round(30 * $navigationScale)} row={2}>
            <label color={colorOnSurfaceVariant} fontSize={13 * $navigationScale} lineBreak="end" maxLines={1} text={liveText} verticalAlignment="center" />
            <label col={1} maxLines={1} verticalAlignment="center" visibility={eta && !paused ? 'visible' : 'collapse'}>
                <cspan color={colorOnSurfaceVariant} fontSize={13 * $navigationScale} text={lc('navigation_arrival') + ' '} />
                <cspan color={colorOnSurface} fontSize={13 * $navigationScale} fontWeight="bold" text={eta} />
            </label>
        </gridlayout>
    </NavigationCard>

    <!-- the trip so far -->
    <NavigationCard columns="*,*,*,*" margin="0 8 8 8" padding="0 10" row={1}>
        <!-- hairlines between the figures, like the map's button bar -->
        <NavigationInfo label={lc('navigation_moving')} unit={movingParts?.[1]} value={movingParts ? movingParts[0] : '-'} valueFontSize={18} />
        <NavigationInfo
            borderColor={colorHairline}
            borderLeftWidth={1}
            col={1}
            label={lc('navigation_done')}
            paddingLeft={10}
            unit={doneParts?.[1]}
            value={doneParts ? doneParts[0] + '' : '-'}
            valueFontSize={18} />
        <NavigationInfo
            borderColor={colorHairline}
            borderLeftWidth={1}
            col={2}
            label={lc('navigation_average_speed')}
            paddingLeft={10}
            unit={speedParts?.[1]}
            value={speedParts ? speedParts[0] + '' : '-'}
            valueFontSize={18} />
        <NavigationInfo
            borderColor={colorHairline}
            borderLeftWidth={1}
            col={3}
            label={lc('navigation_climbed')}
            paddingLeft={10}
            unit={climbedParts?.[1]}
            value={climbedParts ? '+' + climbedParts[0] : '-'}
            valueFontSize={18} />
    </NavigationCard>

    {#if sections.ahead}
        <!-- what is ahead -->
        <gridlayout columns={aheadSections.map((layout) => `${layout.section.weight ?? 1}*`).join(',')} margin="0 0 8 8" row={2}>
            {#each aheadSections as layout, index (layout.id)}
                {#if $sectionComponents[layout.id]}
                    <svelte:component this={$sectionComponents[layout.id]} col={index} height={sections.ahead - 8} marginRight={8} />
                {/if}
            {/each}
        </gridlayout>
    {/if}

    <NavigationActions margin="0 8 8 8" row={3} />

    {#each detailSections as layout, index (layout.id)}
        {#if $sectionComponents[layout.id]}
            <svelte:component
                this={$sectionComponents[layout.id]}
                backgroundColor={colorPanel}
                borderColor={colorHairline}
                borderRadius={CARD_RADIUS}
                borderWidth={CARD_BORDER_WIDTH}
                item={$navigationItem}
                margin="0 8 8 8"
                row={4 + index} />
        {/if}
    {/each}
</gridlayout>
