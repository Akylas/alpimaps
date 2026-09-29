<script context="module" lang="ts">
    import { lc } from '@nativescript-community/l';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Color } from '@nativescript/core';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { onThemeChanged } from '~/helpers/theme';
    import { colors, fontScaleMaxed, screenHeightDips, screenWidthDips } from '~/variables';
    import SettingsSlider from '@shared/components/SettingsSlider.svelte';
    import PanelPopover from '~/components/common/PanelPopover.svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import Pill from '~/components/common/Pill.svelte';
    import ListItemAutoSize from '../common/ListItemAutoSize.svelte';
</script>

<script lang="ts">
    import SettingsSwitch from '../settings/SettingsSwitch.svelte';

    let { colorHairline, colorOnSurface, colorOnSurfaceVariant } = $colors;
    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant } = $colors);
    // export let name: string = ull;
    export let options: { text; value; fontFamily }[] = null;
    export let settings: any[] = null;
    export let color = new Color(colorOnSurface);
    export let currentOption = null;
    export let inversedColor = new Color(inverse(color.argb)).setAlpha(255).hex;
    export let onOptionChange: (value) => any[] = null;
    export let onReset: () => any[] = null;
    export let onCheckBox: (item, value) => void = null;
    export let title: string = null;
    export let titleIcon: string = null;
    export let titleIconFontFamily: string = null;
    let collectionView: NativeViewElementNode<CollectionView>;

    function onActualOptionChanged(value) {
        currentOption = value;
        if (onOptionChange) {
            settings = onOptionChange(value);
        }
        options = [...options]; // we want svelte to trigger ui change
    }
    function onActualReset() {
        if (onReset) {
            settings = onReset();
            DEV_LOG && console.log('onActualReset', JSON.stringify(settings));
        }
    }
    $: color = new Color(colorOnSurface);
    $: inversedColor = new Color(inverse(color.argb)).setAlpha(255).hex;

    function inverse(figure) {
        return 0xffffff - figure;
    }

    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());
</script>

<PanelPopover columns="*" rows="auto,auto,*,auto" width={Math.min(screenWidthDips * 0.7 * $fontScaleMaxed, screenWidthDips * 0.9)} {...$$restProps}>
    {#if title}
        <PanelHeader icon={titleIcon} iconFontFamily={titleIconFontFamily} padding="12 0 4 4" {title} />
    {/if}
    {#if options}
        <wraplayout horizontalAlignment="center" margin="0 0 4 0" row={1}>
            {#each options as option}
                <Pill icon={option.text} iconFontFamily={option.fontFamily} selected={currentOption === option.value} on:tap={() => onActualOptionChanged(option.value)} />
            {/each}
        </wraplayout>
    {/if}
    <collectionview
        bind:this={collectionView}
        height={Math.min(80 * $fontScaleMaxed * settings.length, screenHeightDips - 200)}
        itemTemplateSelector={(item) => (item.type === 'switch' ? item.type : 'default')}
        items={settings}
        row={2}>
        <Template let:item>
            <SettingsSlider borderBottomColor={colorHairline} borderBottomWidth={1} {...item} />
        </Template>
        <Template key="switch" let:item>
            <SettingsSwitch borderBottomColor={colorHairline} borderBottomWidth={1} {item} {onCheckBox} />
        </Template>
    </collectionview>
    {#if onReset}
        <Pill horizontalAlignment="left" icon="mdi-restore" label={lc('reset_settings')} margin="8 0" row={3} on:tap={onActualReset} />
    {/if}
</PanelPopover>
