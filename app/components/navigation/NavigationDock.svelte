<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { onDestroy } from 'svelte';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import NavigationControls from '~/components/navigation/NavigationControls.svelte';
    import NavigationInfo from '~/components/navigation/NavigationInfo.svelte';
    import { formatTime } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { type RouteNavPage, lazyComponents, routeFeatureChanges, routeFeatures, routeNavPages } from '~/routeFeatures/registry';
    import { NavigationState, navigationDetour, navigationItem, navigationPage, navigationPageIds, navigationPageShown, navigationProgress, navigationScale, navigationState, navigationStats } from '~/stores/navigationStore';
    import { DOCK_DOTS_HEIGHT, DOCK_PAGE_HEIGHT, DOCK_SUMMARY_HEIGHT, formatNavigationDuration, splitDistance, splitElevation } from '~/utils/navigation';
    import { colors } from '~/variables';

    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorPrimary } = $colors);

    $: profile = $navigationItem?.profile;
    // the `>= 0` only makes the statement depend on the features' changes
    $: pages = $routeFeatureChanges >= 0 ? routeNavPages($routeFeatures, { item: $navigationItem, detour: !!$navigationDetour }, $navigationPageIds) : [];
    // the pages' components load the first time they are in the dock
    const pageComponents = lazyComponents();
    $: pages.forEach((page) => pageComponents.load(page.id, page.component));
    // the page of the last ride when it is still there, else the first
    $: selectedIndex = Math.max(
        pages.findIndex((page) => page.id === $navigationPage),
        0
    );

    // the pages that cost something to read wait for the user to be on them
    $: navigationPageShown.set(pages[selectedIndex]?.id ?? null);
    onDestroy(() => navigationPageShown.set(null));

    // the pager also says its page when the pages change under it: only the user's swipe is remembered
    function onPageChange(event: { value?: number }) {
        const page: RouteNavPage | undefined = pages[event['value']];
        if (page && event['value'] !== selectedIndex) {
            navigationPage.set(page.id);
        }
    }

    $: paused = $navigationState === NavigationState.PAUSED;
    $: offRoute = !!$navigationProgress?.offRoute;
    $: remainingDistance = $navigationProgress?.remainingDistance;
    $: remainingTime = $navigationProgress?.remainingTime;
    $: eta = remainingTime > 0 ? formatTime(Date.now() + remainingTime * 1000) : null;

    // profile dp is the ascent accumulated up to each point
    $: pointData = profile?.data?.[$navigationProgress?.onPathIndex];
    $: remainingAscent = profile && pointData && !isNaN(pointData.dp) ? Math.max(profile.dplus - pointData.dp, 0) : null;

    $: distanceParts = remainingDistance > 0 ? splitDistance(remainingDistance) : null;
    $: ascentParts = remainingAscent !== null ? splitElevation(remainingAscent) : null;
    $: offRouteParts = $navigationProgress?.distanceFromRoute > 0 ? splitDistance($navigationProgress.distanceFromRoute) : null;
    $: movingTime = formatNavigationDuration(($navigationStats?.duration || 0) / 1000);

    $: scale = $navigationScale;
    $: pageHeight = Math.round(DOCK_PAGE_HEIGHT * scale);
</script>

<!-- the dock: the main figures and the primary button, then one page of data to swipe through -->
<NavigationCard margin="0 8 8 8" rows={[Math.round(DOCK_SUMMARY_HEIGHT * scale), pages.length ? pageHeight : 0, pages.length ? Math.round(DOCK_DOTS_HEIGHT * scale) : 0].join(',')} {...$$restProps}>
    <!-- the sheet drags from anywhere on the dock; the handle says it does -->
    <absolutelayout backgroundColor={colorOutline} borderRadius={2} height={4} horizontalAlignment="center" marginTop={2} opacity={0.6} verticalAlignment="top" width={32} />
    <gridlayout columns="*,*,1.5*,auto" marginTop={Math.round(6 * scale)} padding="0 8 0 14">
        <NavigationInfo unit={distanceParts?.[1]} value={distanceParts ? distanceParts[0] + '' : '-'} valueFontSize={19} />
        <NavigationInfo col={1} unit={ascentParts?.[1]} value={ascentParts ? '+' + ascentParts[0] : '-'} valueFontSize={19} />
        <!-- what the third figure is changes with the state: off the route says how far, paused says how long it moved, else the arrival -->
        <label col={2} lineBreak="end" maxLines={1} verticalAlignment="center">
            {#if offRoute && offRouteParts}
                <cspan color={isEInk ? colorOnSurface : colorError} fontSize={15 * scale} fontWeight="bold" text={lc('navigation_off_route_by', offRouteParts[0] + ' ' + offRouteParts[1])} />
            {:else if paused}
                <cspan color={colorOnSurface} fontSize={19 * scale} fontWeight="bold" text={movingTime} />
                <cspan color={colorOnSurfaceVariant} fontSize={11 * scale} text={' ' + lc('navigation_moving')} />
            {:else if eta}
                <cspan color={colorOnSurface} fontSize={19 * scale} fontWeight="bold" text={eta} />
                <cspan color={colorOnSurfaceVariant} fontSize={11 * scale} text={' ' + lc('navigation_arrival')} />
            {/if}
        </label>
        <NavigationControls col={3} verticalAlignment="center" />
    </gridlayout>

    {#if pages.length}
        <pager
            borderColor={colorOutline}
            borderTopWidth={1}
            disableAnimation={isEInk}
            height={pageHeight}
            items={pages}
            row={1}
            {selectedIndex}
            on:selectedIndexChange={onPageChange}>
            <Template let:item>
                <gridlayout>
                    {#if $pageComponents[item.id]}
                        <svelte:component this={$pageComponents[item.id]} height={pageHeight} padding="0 14" />
                    {/if}
                </gridlayout>
            </Template>
        </pager>
        <stacklayout horizontalAlignment="center" orientation="horizontal" row={2} verticalAlignment="center">
            {#each pages as page, index (page.id)}
                <!-- a dot, the page's own is a pill; outlined and filled squares on e-ink, where there is no colour to tell them by -->
                <absolutelayout
                    backgroundColor={index === selectedIndex ? (isEInk ? colorOnSurface : colorPrimary) : isEInk ? 'transparent' : colorOutline}
                    borderColor={isEInk ? colorOnSurface : 'transparent'}
                    borderRadius={isEInk ? 0 : 3}
                    borderWidth={isEInk ? 1.5 : 0}
                    height={6}
                    margin="0 3"
                    width={index === selectedIndex && !isEInk ? 18 : 6}
                    on:tap={() => navigationPage.set(page.id)} />
            {/each}
        </stacklayout>
    {/if}
</NavigationCard>
