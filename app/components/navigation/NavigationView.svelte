<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { DismissReasons } from '@nativescript-community/ui-snackbar';
    import type { EventData } from '@nativescript/core';
    import { onDestroy } from 'svelte';
    import NavigationActions from '~/components/navigation/NavigationActions.svelte';
    import { CARD_BORDER_WIDTH, CARD_RADIUS } from '~/components/navigation/NavigationCard.svelte';
    import NavigationDock from '~/components/navigation/NavigationDock.svelte';
    import { lazyComponents, routeFeatureChanges, routeFeatures, routeNavPages, routeNavSections } from '~/routeFeatures/registry';
    import { NavigationReroutedEvent, navigationService } from '~/services/NavigationService';
    import { navigationDetour, navigationItem, navigationPageIds, navigationScale } from '~/stores/navigationStore';
    import { navigationSections } from '~/utils/navigation';
    import { showSnack } from '~/utils/ui';
    import { colors } from '~/variables';

    $: ({ colorHairline, colorPanel } = $colors);

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

    // the sections the map builds the sheet steps from, so a step ends where its section does
    // the `>= 0` only makes the statements depend on the features' changes
    $: contributed = $routeFeatureChanges >= 0 ? routeNavSections($routeFeatures, { item: $navigationItem }, $navigationScale) : [];
    $: hasPages = $routeFeatureChanges >= 0 && routeNavPages($routeFeatures, { item: $navigationItem, detour: !!$navigationDetour }, $navigationPageIds).length > 0;
    $: sections = navigationSections($navigationScale, contributed, hasPages);
    // the sections' components load the first time they have a height
    const sectionComponents = lazyComponents();
    $: contributed.forEach((layout) => sectionComponents.load(layout.id, layout.section.component));
</script>

<gridlayout rows={[sections.dock, sections.actions, ...sections.details].join(',')} {...$$restProps}>
    <NavigationDock />

    <NavigationActions margin="0 8 8 8" row={1} />

    {#each contributed as layout, index (layout.id)}
        {#if $sectionComponents[layout.id]}
            <svelte:component
                this={$sectionComponents[layout.id]}
                backgroundColor={colorPanel}
                borderColor={colorHairline}
                borderRadius={CARD_RADIUS}
                borderWidth={CARD_BORDER_WIDTH}
                item={$navigationItem}
                margin="0 8 8 8"
                row={2 + index} />
        {/if}
    {/each}
</gridlayout>
