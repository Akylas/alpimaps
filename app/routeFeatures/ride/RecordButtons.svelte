<script lang="ts">
    // starts recording the position into a ride, without a route. Once it records, the recording bar has the controls
    import { showError } from '@shared/utils/showError';
    import IconButton from '~/components/common/IconButton.svelte';
    import { recordingState } from '~/handlers/GeoHandler';
    import { lc } from '~/helpers/locale';
    import { startRecording } from '~/routeFeatures/ride/recorder';

    export let shown = true;

    async function start() {
        try {
            await startRecording();
        } catch (error) {
            showError(error);
        }
    }
</script>

<stacklayout {...$$restProps} visibility={shown && $recordingState === null ? 'visible' : 'collapse'}>
    <IconButton text="mdi-record-circle-outline" tooltip={lc('start_recording')} on:tap={start} />
</stacklayout>
