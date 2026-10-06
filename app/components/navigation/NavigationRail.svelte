<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';
    import { showError } from '@shared/utils/showError';
    import IconButton from '~/components/common/IconButton.svelte';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { getMapContext } from '~/mapModules/MapModule';
    import { userFollowStore } from '~/mapModules/UserLocationModule';
    import { navigationService } from '~/services/NavigationService';
    import { navigationDetour, navigationOriginalItem, navigationScale } from '~/stores/navigationStore';
    import { NAVRAIL_BUTTON_SIZE } from '~/utils/navigation';
    import { showPopoverMenu, showSettings } from '~/utils/ui';
    import { colors } from '~/variables';
    import { get } from 'svelte/store';

    $: ({ colorError, colorOnSurfaceVariant, colorPrimary } = $colors);

    /** the map's rotation, for the compass */
    export let rotation = 0;
    export let onCompass: () => void = null;

    $: buttonSize = Math.round(NAVRAIL_BUTTON_SIZE * $navigationScale);
    // a reroute can be taken back for as long as it lasts, not just while a snack is on screen
    $: rerouted = !!$navigationDetour || !!$navigationOriginalItem;

    function followUserAgain() {
        try {
            getMapContext().mapModule('userLocation').navigationMode = true;
        } catch (error) {
            showError(error);
        }
    }

    async function showNavigationSettings(anchor) {
        const component = (await import('~/components/navigation/NavigationSettingsPopover.svelte')).default;
        await showPopover({ view: component, anchor, vertPos: VerticalPosition.BELOW, horizPos: HorizontalPosition.ALIGN_RIGHT });
    }

    // dev only, so not translated: the simulator's own panel takes it from there
    async function toggleRouteSimulator() {
        const simulator = await import('~/services/RouteSimulator');
        if (get(simulator.routeSimulation)) {
            simulator.stopRouteSimulation();
        } else {
            simulator.startRouteSimulation();
        }
    }

    async function showMore(event) {
        try {
            const anchor = event.object;
            const options = [
                rerouted && { id: 'undo_reroute', name: lc('navigation_undo_reroute'), icon: 'mdi-undo-variant' },
                { id: 'settings', name: lc('navigation_settings'), icon: 'mdi-tune' },
                { id: 'app_settings', name: lc('settings'), icon: 'mdi-cog' },
                !PRODUCTION && { id: 'simulator', name: 'Route simulator', icon: 'mdi-play-speed' },
                { id: 'stop', name: lc('stop_navigation'), icon: 'mdi-close', color: colorError }
            ].filter(Boolean);
            await showPopoverMenu({
                options,
                anchor,
                vertPos: VerticalPosition.BELOW,
                horizPos: HorizontalPosition.ALIGN_RIGHT,
                props: { autoSizeListItem: true, maxHeight: 400 },
                onClose: async (option) => {
                    if (!option) {
                        return;
                    }
                    if (option.id === 'undo_reroute') {
                        navigationService.undoReroute();
                    } else if (option.id === 'settings') {
                        await showNavigationSettings(anchor);
                    } else if (option.id === 'app_settings') {
                        await showSettings();
                    } else if (option.id === 'simulator') {
                        await toggleRouteSimulator();
                    } else if (option.id === 'stop') {
                        await navigationService.stop();
                    }
                }
            });
        } catch (error) {
            showError(error);
        }
    }
</script>

<!-- fixed slots: a button that has nothing to do dims, it never leaves, so the others never move -->
<stacklayout {...$$restProps}>
    <NavigationCard borderRadius={buttonSize / 2} height={buttonSize} marginBottom={8} width={buttonSize}>
        <IconButton
            color={colorPrimary}
            fontSize={22 * $navigationScale}
            maxFontScale={1}
            rotate={rotation}
            size={buttonSize}
            text="mdi-navigation"
            tooltip={lc('compass')}
            on:tap={() => onCompass?.()} />
    </NavigationCard>
    <NavigationCard borderRadius={buttonSize / 2} height={buttonSize} marginBottom={8} opacity={$userFollowStore ? 0.4 : 1} width={buttonSize}>
        <IconButton color={colorPrimary} fontSize={22 * $navigationScale} maxFontScale={1} size={buttonSize} text="mdi-crosshairs-gps" tooltip={lc('recenter_navigation')} on:tap={followUserAgain} />
    </NavigationCard>
    <NavigationCard borderRadius={buttonSize / 2} height={buttonSize} width={buttonSize}>
        <IconButton color={colorOnSurfaceVariant} fontSize={22 * $navigationScale} maxFontScale={1} size={buttonSize} text="mdi-dots-vertical" tooltip={lc('more')} on:tap={showMore} />
    </NavigationCard>
</stacklayout>
