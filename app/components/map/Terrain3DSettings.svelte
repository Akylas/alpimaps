<script lang="ts">
    // a collectionview so rows aren't all built while the sheet opens; the gesturerootview lets a
    // slider drag reach the slider instead of the sheet's pan gesture
    import { Template } from '@nativescript-community/svelte-native/components';
    import { terrain3dSettingRows } from '~/components/map/terrain3dSettingRows';
    import type { PeakFinderSettingRow as SettingRow } from '~/components/peaks/peakFinderSettingRows';
    import StoreSegment from '~/components/settings/StoreSegment.svelte';
    import StoreSlider from '~/components/settings/StoreSlider.svelte';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import { terrainLighting, terrainShadows } from '~/stores/terrainStore';
    import { colors, screenHeightDips, windowInset } from '~/variables';

    $: ({ colorOnSurfaceVariant, colorSurfaceContainer } = $colors);

    // rebuilt when lighting or shadows switch, which show or hide their knobs
    $: rows = terrain3dSettingRows({ lighting: $terrainLighting, shadows: $terrainShadows });

    function itemTemplateSelector(item: SettingRow) {
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
        <Template key="slider" let:item>
            <StoreSlider description={item.description} format={item.format} max={item.max} min={item.min} step={item.step} store={item.store} title={item.title} />
        </Template>
    </collectionview>
</gesturerootview>
