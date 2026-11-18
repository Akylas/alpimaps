<script lang="ts">
    // records the position into a ride, without a route: start, then pause / resume and stop
    import { showError } from '@shared/utils/showError';
    import IconButton from '~/components/common/IconButton.svelte';
    import { SessionState, recordingState } from '~/handlers/GeoHandler';
    import { lc } from '~/helpers/locale';
    import { pauseRecording, resumeRecording, startRecording, stopRecording } from '~/routeFeatures/ride/recorder';
    import { colors } from '~/variables';

    let { colorError } = $colors;
    $: ({ colorError } = $colors);

    $: recording = $recordingState !== null;
    $: paused = $recordingState === SessionState.PAUSED;

    async function start() {
        try {
            await startRecording();
        } catch (error) {
            showError(error);
        }
    }
    async function togglePause() {
        try {
            if (paused) {
                resumeRecording();
            } else {
                await pauseRecording();
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<stacklayout {...$$restProps}>
    {#if recording}
        <IconButton isSelected={paused} text={paused ? 'mdi-play' : 'mdi-pause'} tooltip={paused ? lc('resume') : lc('pause')} on:tap={togglePause} />
        <IconButton color={colorError} text="mdi-stop-circle" tooltip={lc('stop_recording')} on:tap={stopRecording} />
    {:else}
        <IconButton text="mdi-record-circle-outline" tooltip={lc('start_recording')} on:tap={start} />
    {/if}
</stacklayout>
