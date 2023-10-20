<script context="module" lang="ts">
    import { lc } from '@nativescript-community/l';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Color } from '@nativescript/core';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { onThemeChanged } from '~/helpers/theme';
    import { alpimapsFontFamily, borderColor, mdiFontFamily, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
    import IconButton from './IconButton.svelte';
    import SettingsSlider from './SettingsSlider.svelte';
</script>

<script lang="ts">
    // export let name: string = ull;
    export let options: { text; value }[] = null;
    export let settings: any[] = null;
    export let color = new Color($textColor);
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
    }
    function onActualReset() {
        if (onReset) {
            settings = onReset();
        }
    }
    $: color = new Color($textColor);
    $: inversedColor = new Color(inverse(color.argb)).setAlpha(255).hex;

    function inverse(figure) {
        // inverse a RGB color
        return 0xffffff - figure;
    }

    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());
</script>

<gridlayout backgroundColor={$widgetBackgroundColor} borderRadius={4} elevation={2} margin={2} rows="auto,*,auto">
    {#if options}
        <stacklayout horizontalAlignment="center" margin={5} orientation="horizontal">
            {#each options as option, index}
                <IconButton
                    backgroundColor={currentOption === option.value ? color : 'transparent'}
                    color={currentOption === option.value ? inversedColor : color}
                    fontFamily={alpimapsFontFamily}
                    text={option.text}
                    on:tap={() => onActualOptionChanged(option.value)} />
            {/each}
        </stacklayout>
    {/if}
    <collectionview bind:this={collectionView} height={Math.min(300, settings.length * 80)} itemTemplateSelector={(item) => (item.type === 'switch' ? item.type : 'default')} items={settings} row={1}>
        <Template let:item>
            <SettingsSlider
                borderBottomColor={$borderColor}
                borderBottomWidth={1}
                icon={item.icon}
                max={item.max}
                min={item.min}
                onChange={item.onChange}
                step={item.step}
                title={item.title}
                value={item.value} />
        </Template>
        <Template key="switch" let:item>
            <gridlayout columns="*, auto" padding="0 10 0 30">
                <stacklayout verticalAlignment="middle">
                    <label color={$textColor} fontSize={17} lineBreak="end" maxLines={2} text={item.title} textWrap={true} verticalTextAlignment="top" />
                    <label
                        color={$subtitleColor}
                        fontSize={14}
                        lineBreak="end"
                        maxLines={2}
                        text={item.subtitle}
                        verticalTextAlignment="top"
                        visibility={item.subtitle && item.subtitle.length > 0 ? 'visible' : 'collapsed'} />
                </stacklayout>
                <switch checked={item.value} col={1} verticalAlignment="middle" on:checkedChange={(e) => onCheckBox(item, e.value)} />
                <absoluteLayout backgroundColor={$borderColor} colSpan={2} height={1} verticalAlignment="bottom" />
            </gridlayout>
        </Template>
    </collectionview>
    {#if onReset}
        <mdbutton
            color={$textColor}
            horizontalAlignment="left"
            rippleColor={$textColor}
            row={2}
            textAlignment="center"
            variant="text"
            verticalTextAlignment="center"
            android:padding="8 4 0 4"
            ios:paddingTop={0}
            on:tap={onActualReset}>
            <span fontFamily={mdiFontFamily} fontSize={20} text="mdi-cancel" verticalAlignment="middle" />
            <span text={lc('reset_settings')} verticalAlignment="middle" />
        </mdbutton>
    {/if}
</gridlayout>
