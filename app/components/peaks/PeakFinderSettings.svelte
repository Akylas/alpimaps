<script lang="ts">
    /**
     * The peak finder's settings, behind the cog in its overlay.
     *
     * The rows are shared with the app's settings screen (`peakFinderSettingRows`), plus the moment the
     * sun is drawn for, which only this sheet has.
     *
     * A COLLECTIONVIEW of DATA rows, like `Terrain3DSettings` — see the note there for why (a long
     * stacklayout of sliders is built and measured in full while the sheet opens) and for what each
     * `type` maps to.
     */
    import { Template } from '@nativescript-community/svelte-native/components';
    import StoreSegment from '~/components/settings/StoreSegment.svelte';
    import StoreSlider from '~/components/settings/StoreSlider.svelte';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import PeakFinderSunTime from '~/components/peaks/PeakFinderSunTime.svelte';
    import { type PeakFinderSettingRow, peakFinderSettingRows } from '~/components/peaks/peakFinderSettingRows';
    import { colors, screenHeightDips, windowInset } from '~/variables';

    $: ({ colorOnSurfaceVariant, colorSurfaceContainer } = $colors);

    // The same rows as the app's settings screen - see peakFinderSettingRows.
    const rows = peakFinderSettingRows();

    function itemTemplateSelector(item: PeakFinderSettingRow) {
        return item.type;
    }
</script>

<gesturerootview backgroundColor={colorSurfaceContainer} height={Math.round(screenHeightDips * 0.3)}>
    <!-- the inset goes on the content: the collectionview scrolls under it -->
    <collectionview {itemTemplateSelector} items={rows} ios:contentInsetAdjustmentBehavior={2} paddingBottom={10 + (__ANDROID__ ? $windowInset.bottom : 0)} paddingTop={10}>
        <Template key="sectionheader" let:item>
            <label class="sectionHeader" color={colorOnSurfaceVariant} fontSize={13} padding="12 16 4 16" text={item.title} />
        </Template>
        <Template key="switch" let:item>
            <StoreSwitch description={item.description} store={item.store} title={item.title} />
        </Template>
        <Template key="segment" let:item>
            <StoreSegment description={item.description} options={item.options} store={item.store} title={item.title} />
        </Template>
        <Template key="suntime" let:item>
            <PeakFinderSunTime title={item.title} />
        </Template>
        <Template key="slider" let:item>
            <StoreSlider description={item.description} format={item.format} max={item.max} min={item.min} step={item.step} store={item.store} title={item.title} />
        </Template>
    </collectionview>
</gesturerootview>
