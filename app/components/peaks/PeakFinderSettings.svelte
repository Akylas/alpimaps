<script lang="ts">
    // a collectionview rather than a stacklayout: a long list of sliders would be built and
    // measured in full while the sheet opens
    import { Template } from '@nativescript-community/svelte-native/components';
    import StoreSegment from '~/components/settings/StoreSegment.svelte';
    import StoreSlider from '~/components/settings/StoreSlider.svelte';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import { lc } from '~/helpers/locale';
    import PeakFinderSkyTime from '~/components/peaks/PeakFinderSkyTime.svelte';
    import { type PeakFinderSettingRow, peakFinderSettingRows } from '~/components/peaks/peakFinderSettingRows';
    import { screenHeightDips, windowInset } from '~/variables';

    const rows = peakFinderSettingRows();

    function itemTemplateSelector(item: PeakFinderSettingRow) {
        return item.type;
    }
</script>

<gesturerootview class="bottomsheet" height={Math.round(screenHeightDips * 0.3)} rows="auto,*">
    <PanelHeader icon="mdi-image-filter-hdr" title={lc('peak_finder')} />
    <!-- the inset goes on the content: the collectionview scrolls under it -->
    <collectionview {itemTemplateSelector} items={rows} paddingBottom={10 + (__ANDROID__ ? $windowInset.bottom : 0)} row={1} ios:contentInsetAdjustmentBehavior={2}>
        <Template key="sectionheader" let:item>
            <label class="sectionHeader" text={item.title} />
        </Template>
        <Template key="switch" let:item>
            <StoreSwitch description={item.description} store={item.store} title={item.title} />
        </Template>
        <Template key="segment" let:item>
            <StoreSegment description={item.description} options={item.options} store={item.store} title={item.title} />
        </Template>
        <Template key="suntime" let:item>
            <PeakFinderSkyTime title={item.title} />
        </Template>
        <Template key="slider" let:item>
            <StoreSlider description={item.description} format={item.format} max={item.max} min={item.min} step={item.step} store={item.store} title={item.title} />
        </Template>
    </collectionview>
</gesturerootview>
