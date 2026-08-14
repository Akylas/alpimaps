<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';
    import { showError } from '@shared/utils/showError';
    import IconButton from '~/components/common/IconButton.svelte';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { getMapContext } from '~/mapModules/MapModule';
    import { userFollowStore } from '~/mapModules/UserLocationModule';
    import { navigationService } from '~/services/NavigationService';
    import { isNavigationRunning, navigationDetour, navigationOriginalItem, navigationScale } from '~/stores/navigationStore';
    import { NAVBUTTON_SIZE } from '~/utils/navigation';
    import { colors } from '~/variables';

    $: ({ colorError, colorOnSurfaceVariant, colorPrimary } = $colors);

    /** the buttons have to fit next to the info cards without making the bar taller */
    $: buttonSize = Math.round(NAVBUTTON_SIZE * $navigationScale);

    /**
     * Panning the map turns following off, and the map buttons are hidden while navigating, so this is
     * the only way back to the camera following the route.
     */
    function followUserAgain() {
        try {
            getMapContext().mapModule('userLocation').navigationMode = true;
        } catch (error) {
            showError(error);
        }
    }
    async function togglePause() {
        try {
            await navigationService.toggle();
        } catch (error) {
            showError(error);
        }
    }
    // a reroute can be taken back for as long as it lasts, not just while a snack is on screen
    $: rerouted = !!$navigationDetour || !!$navigationOriginalItem;
    function undoReroute() {
        try {
            navigationService.undoReroute();
        } catch (error) {
            showError(error);
        }
    }
    async function stopNavigation() {
        try {
            await navigationService.stop();
        } catch (error) {
            showError(error);
        }
    }
    async function showNavigationSettings(event) {
        try {
            const component = (await import('~/components/navigation/NavigationSettingsPopover.svelte')).default;
            await showPopover({
                view: component,
                anchor: event.object,
                vertPos: VerticalPosition.ABOVE
            });
        } catch (error) {
            showError(error);
        }
    }
</script>

<!-- square cards, centred on the info row so the whole bar reads as one line of tiles.
     Play/pause is deliberately the *last* child: the row is anchored to the right of the bar, so with
     it at the end it sits at the same place whatever else is shown, and running and paused line up.
     Everything conditional extends leftwards from it -->
<flexlayout alignItems="center" flexDirection="row" {...$$restProps}>
    <!-- stopping and tuning are not things you do at speed: hide them while running to give the figures room -->
    <NavigationCard height={buttonSize} marginRight={8} visibility={$isNavigationRunning ? 'collapse' : 'visible'} width={buttonSize}>
        <IconButton color={colorError} size={buttonSize} text="mdi-close" tooltip={lc('stop_navigation')} on:tap={stopNavigation} />
    </NavigationCard>
    <NavigationCard height={buttonSize} marginRight={8} visibility={$isNavigationRunning ? 'collapse' : 'visible'} width={buttonSize}>
        <IconButton color={colorOnSurfaceVariant} size={buttonSize} text="mdi-tune" tooltip={lc('navigation_settings')} on:tap={showNavigationSettings} />
    </NavigationCard>
    <!-- only there once the user has panned away, so it does not take room the rest of the time -->
    <NavigationCard height={buttonSize} marginRight={8} visibility={$userFollowStore ? 'collapse' : 'visible'} width={buttonSize}>
        <IconButton color={colorPrimary} size={buttonSize} text="mdi-crosshairs-gps" tooltip={lc('recenter_navigation')} on:tap={followUserAgain} />
    </NavigationCard>
    <!-- only while a reroute is in effect: it is the way back to the route the user actually picked -->
    <NavigationCard height={buttonSize} marginRight={8} visibility={rerouted ? 'visible' : 'collapse'} width={buttonSize}>
        <IconButton color={colorOnSurfaceVariant} size={buttonSize} text="mdi-undo-variant" tooltip={lc('navigation_undo_reroute')} on:tap={undoReroute} />
    </NavigationCard>
    <NavigationCard height={buttonSize} width={buttonSize}>
        <IconButton
            color={colorOnSurfaceVariant}
            size={buttonSize}
            text={$isNavigationRunning ? 'mdi-pause' : 'mdi-play'}
            tooltip={$isNavigationRunning ? lc('pause') : lc('resume')}
            on:tap={togglePause} />
    </NavigationCard>
</flexlayout>
