<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { confirm } from '@nativescript-community/ui-dialogs';
    import { showError } from '@shared/utils/showError';
    import IconButton from '~/components/common/IconButton.svelte';
    import { SessionState, recordingState } from '~/handlers/GeoHandler';
    import { pauseRecording, resumeRecording, stopRecording } from '~/routeFeatures/ride/recorder';
    import { navigationService } from '~/services/NavigationService';
    import { isNavigationRunning, navigationScale } from '~/stores/navigationStore';
    import { NAVPRIMARY_SIZE } from '~/utils/navigation';
    import { colors } from '~/variables';

    $: ({ colorError, colorOnPrimary, colorPrimary } = $colors);

    /** the controls of a ride recorded from the position, not of a navigation: the same button, and a stop beside it */
    export let recording = false;
    $: running = recording ? $recordingState === SessionState.RUNNING : $isNavigationRunning;

    $: buttonSize = Math.round(NAVPRIMARY_SIZE * $navigationScale);

    async function togglePause() {
        try {
            if (recording) {
                await (running ? pauseRecording() : resumeRecording());
                return;
            }
            await navigationService.toggle();
        } catch (error) {
            showError(error);
        }
    }
    // stopping saves the ride, but a stop by accident still ends the recording
    async function endRecording() {
        try {
            const result = await confirm({ title: lc('stop_recording'), okButtonText: lc('stop_recording'), cancelButtonText: lc('cancel') });
            if (result) {
                stopRecording();
            }
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
<stacklayout orientation="horizontal" verticalAlignment="center" {...$$restProps}>
    {#if recording}
        <IconButton color={colorError} marginRight={4} size={buttonSize} text="mdi-stop-circle-outline" tooltip={lc('stop_recording')} on:tap={endRecording} />
    {/if}
    <gridlayout backgroundColor={colorPrimary} borderRadius={buttonSize / 2} height={buttonSize} width={buttonSize}>
        <IconButton
            color={colorOnPrimary}
            fontSize={26 * $navigationScale}
            maxFontScale={1}
            onLongPress={recording ? undefined : endNavigation}
            size={buttonSize}
            text={running ? 'mdi-pause' : 'mdi-play'}
            tooltip={running ? lc('pause') : lc('resume')}
            on:tap={togglePause} />
    </gridlayout>
</stacklayout>
