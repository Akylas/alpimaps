<script context="module" lang="ts">
    import { lc } from '@nativescript-community/l';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Color } from '@nativescript/core';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { onThemeChanged } from '~/helpers/theme';
    import { colors, fontScaleMaxed, fonts, screenHeightDips, screenWidthDips } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import SettingsSlider from '../settings/SettingsSlider.svelte';
    import PopoverBackgroundView from '../common/PopoverBackgroundView.svelte';
    import ListItemAutoSize from '../common/ListItemAutoSize.svelte';
</script>

<script lang="ts">
    import SettingsSwitch from '../settings/SettingsSwitch.svelte';

    let { colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorWidgetBackground } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorWidgetBackground } = $colors);
    // export let name: string = ull;
    export let options: { text; value; fontFamily }[] = null;
    export let settings: any[] = null;
    export let color = new Color(colorOnSurface);
    export let currentOption = null;
    export let inversedColor = new Color(inverse(color.argb)).setAlpha(255).hex;
    export let onOptionChange: (value) => any[] = null;
    export let onReset: () => any[] = null;
    export let onCheckBox: (item, value) => void = null;
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
        // inverse a RGB color
        return 0xffffff - figure;
    }

    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());
</script>

<PopoverBackgroundView backgroundColor={colorWidgetBackground} columns="*" rows="auto,*,auto" width={Math.min(screenWidthDips * 0.7 * $fontScaleMaxed, screenWidthDips * 0.9)} {...$$restProps}>
    {#if options}
        <stacklayout horizontalAlignment="center" margin={5} orientation="horizontal">
            {#each options as option, index}
                <IconButton
                    backgroundColor={currentOption === option.value ? color : 'transparent'}
                    color={currentOption === option.value ? inversedColor : color}
                    fontFamily={option.fontFamily ?? $fonts.mdi}
                    text={option.text}
                    on:tap={() => onActualOptionChanged(option.value)} />
            {/each}
        </stacklayout>
    {/if}
    <collectionview
        bind:this={collectionView}
        height={Math.min(80 * $fontScaleMaxed * settings.length, screenHeightDips - 200)}
        itemTemplateSelector={(item) => (item.type === 'switch' ? item.type : 'default')}
        items={settings}
        row={1}>
        <Template let:item>
            <SettingsSlider borderBottomColor={colorOutlineVariant} borderBottomWidth={1} {...item} />
        </Template>
        <Template key="switch" let:item>
            <SettingsSwitch borderBottomColor={colorOutlineVariant} borderBottomWidth={1} {item} {onCheckBox} />
        </Template>
    </collectionview>
    {#if onReset}
        <mdbutton
            color={colorOnSurface}
            horizontalAlignment="left"
            rippleColor={colorOnSurface}
            row={2}
            textAlignment="center"
            variant="text"
            verticalTextAlignment="center"
            android:padding="8 4 0 4"
            on:tap={onActualReset}>
            <cspan fontFamily={$fonts.mdi} fontSize={20} text="mdi-cancel" verticalAlignment="middle" />
            <cspan fontSize={16} text={lc('reset_settings')} verticalAlignment="middle" />
        </mdbutton>
    {/if}
</PopoverBackgroundView>
