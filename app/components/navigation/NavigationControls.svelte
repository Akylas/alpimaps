<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';
    import { showError } from '@shared/utils/showError';
    import IconButton from '~/components/common/IconButton.svelte';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { navigationService } from '~/services/NavigationService';
    import { isNavigationRunning } from '~/stores/navigationStore';
    import { colors } from '~/variables';

    $: ({ colorError, colorOnSurfaceVariant } = $colors);

    /** the buttons have to fit next to the info cards without making the bar taller */
    const BUTTON_SIZE = 42;

    async function togglePause() {
        try {
            await navigationService.toggle();
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

<!-- square cards, centred on the info row so the whole bar reads as one line of tiles -->
<flexlayout alignItems="center" flexDirection="row" {...$$restProps}>
    <NavigationCard height={BUTTON_SIZE} width={BUTTON_SIZE}>
        <IconButton
            color={colorOnSurfaceVariant}
            size={BUTTON_SIZE}
            text={$isNavigationRunning ? 'mdi-pause' : 'mdi-play'}
            tooltip={$isNavigationRunning ? lc('pause') : lc('resume')}
            on:tap={togglePause} />
    </NavigationCard>
    <!-- stopping and tuning are not things you do at speed: hide them while running to give the figures room -->
    <NavigationCard height={BUTTON_SIZE} marginLeft={8} visibility={$isNavigationRunning ? 'collapse' : 'visible'} width={BUTTON_SIZE}>
        <IconButton color={colorError} size={BUTTON_SIZE} text="mdi-close" tooltip={lc('stop_navigation')} on:tap={stopNavigation} />
    </NavigationCard>
    <NavigationCard height={BUTTON_SIZE} marginLeft={8} visibility={$isNavigationRunning ? 'collapse' : 'visible'} width={BUTTON_SIZE}>
        <IconButton color={colorOnSurfaceVariant} size={BUTTON_SIZE} text="mdi-tune" tooltip={lc('navigation_settings')} on:tap={showNavigationSettings} />
    </NavigationCard>
</flexlayout>
