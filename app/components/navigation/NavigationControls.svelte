<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { confirm } from '@nativescript-community/ui-material-dialogs';
    import { showError } from '@shared/utils/showError';
    import IconButton from '~/components/common/IconButton.svelte';
    import { navigationService } from '~/services/NavigationService';
    import { isNavigationRunning, navigationScale } from '~/stores/navigationStore';
    import { NAVPRIMARY_SIZE } from '~/utils/navigation';
    import { colors } from '~/variables';

    $: ({ colorOnPrimary, colorPrimary } = $colors);

    $: buttonSize = Math.round(NAVPRIMARY_SIZE * $navigationScale);

    async function togglePause() {
        try {
            await navigationService.toggle();
        } catch (error) {
            showError(error);
        }
    }
    // a long press, then a confirmation: ending by accident on a bumpy track loses the recording
    async function endNavigation() {
        try {
            const result = await confirm({ title: lc('stop_navigation'), okButtonText: lc('stop_navigation'), cancelButtonText: lc('cancel') });
            if (result) {
                await navigationService.stop();
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<!-- the primary action, alone in its corner: what it does changes with the state, never where it is -->
<gridlayout backgroundColor={colorPrimary} borderRadius={buttonSize / 2} height={buttonSize} width={buttonSize} {...$$restProps}>
    <IconButton
        color={colorOnPrimary}
        fontSize={26 * $navigationScale}
        maxFontScale={1}
        onLongPress={endNavigation}
        size={buttonSize}
        text={$isNavigationRunning ? 'mdi-pause' : 'mdi-play'}
        tooltip={$isNavigationRunning ? lc('pause') : lc('resume')}
        on:tap={togglePause} />
</gridlayout>
