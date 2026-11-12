<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { DismissReasons } from '@nativescript-community/ui-snackbar';
    import type { EventData } from '@nativescript/core';
    import { onDestroy } from 'svelte';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import NavigationControls from '~/components/navigation/NavigationControls.svelte';
    import NavigationInfo from '~/components/navigation/NavigationInfo.svelte';
    import { formatTime } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { lazyComponents } from '~/routeFeatures/registry';
    import { NavigationReroutedEvent, navigationService } from '~/services/NavigationService';
    import { NavigationState, navigationDockPages, navigationItem, navigationPage, navigationPageShown, navigationProgress, navigationScale, navigationState, navigationStats, navigationSummaryDone } from '~/stores/navigationStore';
    import { DOCK_DOTS_HEIGHT, DOCK_PAGE_HEIGHT, DOCK_SUMMARY_HEIGHT, dockFigures, formatNavigationDuration, splitDistance, splitElevation } from '~/utils/navigation';
    import { showSnack } from '~/utils/ui';
    import { colors } from '~/variables';

    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorPrimary } = $colors);

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

    $: pages = $navigationDockPages;
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
        const page = pages[event['value']];
        if (page && event['value'] !== selectedIndex) {
            navigationPage.set(page.id);
        }
    }

    $: figures = dockFigures({
        progress: $navigationProgress,
        stats: $navigationStats,
        profile: $navigationItem?.profile,
        done: $navigationSummaryDone,
        paused: $navigationState === NavigationState.PAUSED,
        now: Date.now()
    });
    $: distanceParts = figures.distance === null ? null : splitDistance(figures.distance);
    $: ascentParts = figures.ascent === null ? null : splitElevation(figures.ascent);
    // the third figure: off the route says how far, paused (or done) says how long it moved, else the arrival
    $: third = figures.third;
    $: thirdLabel = third?.kind === 'moving' ? lc('navigation_moving') : third?.kind === 'arrival' ? lc('navigation_arrival') : '';
    $: thirdValue = !third ? '' : third.kind === 'off_route' ? lc('navigation_off_route_by', splitDistance(third.distance).join(' ')) : third.kind === 'moving' ? formatNavigationDuration(third.seconds) : formatTime(third.at);

    $: scale = $navigationScale;
    $: pageHeight = Math.round(DOCK_PAGE_HEIGHT * scale);
</script>

<!-- the dock: the main figures and the primary button, then one page of data to swipe through -->
<NavigationCard margin="0 8 8 8" rows={[Math.round(DOCK_SUMMARY_HEIGHT * scale), pages.length ? pageHeight : 0, pages.length ? Math.round(DOCK_DOTS_HEIGHT * scale) : 0].join(',')} {...$$restProps}>
    <!-- the sheet drags from anywhere on the dock; the handle says it does -->
    <absolutelayout backgroundColor={colorOutline} borderRadius={2} height={4} horizontalAlignment="center" marginTop={1} opacity={0.6} verticalAlignment="top" width={32} />
    <!-- a tap on the figures says what is done instead of what is left -->
    <gridlayout columns="*,*,1.5*,auto" marginTop={Math.round(4 * scale)} padding="0 8 0 14" on:tap={() => navigationSummaryDone.update((done) => !done)}>
        <NavigationInfo
            label={$navigationSummaryDone ? lc('navigation_done') : lc('remaining_distance')}
            labelFontSize={10}
            unit={distanceParts?.[1]}
            value={distanceParts ? distanceParts[0] + '' : '-'}
            valueFontSize={19} />
        <NavigationInfo
            col={1}
            label={$navigationSummaryDone ? lc('navigation_climbed') : lc('remaining_ascent')}
            labelFontSize={10}
            unit={ascentParts?.[1]}
            value={ascentParts ? '+' + ascentParts[0] : '-'}
            valueFontSize={19} />
        <label col={2} lineBreak="end" maxLines={2} verticalAlignment="center">
            <cspan color={colorOnSurfaceVariant} fontSize={10 * scale} text={thirdLabel ? thirdLabel + '\n' : ''} />
            <cspan color={third?.kind === 'off_route' && !isEInk ? colorError : colorOnSurface} fontSize={(third?.kind === 'off_route' ? 15 : 19) * scale} fontWeight="bold" text={thirdValue} />
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
