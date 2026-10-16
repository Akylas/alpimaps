<script lang="ts">
    // the realistic look's imagery: tap to pick the provider, the button opens its layer options
    import { closeBottomSheet, showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { showError } from '@shared/utils/showError';
    import { panoramaImagery } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { peakFinderSource } from '~/stores/terrainStore';
    import { colors, fonts } from '~/variables';

    export let title: string;
    export let description: string = null;

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    async function pickSource() {
        try {
            await getMapContext().mapModule('customLayers').pickPanoramaSource();
        } catch (error) {
            showError(error);
        }
    }

    async function showOptions() {
        try {
            const item = $panoramaImagery;
            if (!item) {
                return;
            }
            const LayerOptionsBottomSheet = (await import('~/components/layers/LayerOptionsBottomSheet.svelte')).default;
            closeBottomSheet();
            setTimeout(
                () => {
                    showBottomSheet({ view: LayerOptionsBottomSheet, skipCollapsedState: true, dismissOnBackgroundTap: true, disableDimBackground: true, props: { item } });
                },
                __IOS__ ? 500 : 0
            );
        } catch (error) {
            showError(error);
        }
    }
</script>

<gridlayout columns="*,auto" padding="6 16 6 16" rows="auto,auto,auto" {...$$restProps} on:tap={pickSource}>
    <label color={colorOnSurface} fontSize={16} text={title} />
    <label color={colorOnSurface} fontSize={14} row={1} text={$peakFinderSource} />
    {#if description}
        <label color={colorOnSurfaceVariant} fontSize={13} row={2} text={description} textWrap={true} />
    {/if}
    <mdbutton col={1} color={colorOnSurface} fontFamily={$fonts.mdi} isEnabled={!!$panoramaImagery} rowSpan={2} text="mdi-tune-variant" variant="text" on:tap={showOptions} />
</gridlayout>
