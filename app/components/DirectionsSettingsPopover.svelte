<script lang="ts" context="module">
    import { lc } from '@nativescript-community/l';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Color } from '@nativescript/core';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { onThemeChanged } from '~/helpers/theme';
    import { alpimapsFontFamily, borderColor, mdiFontFamily, primaryColor, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
    import IconButton from './IconButton.svelte';
    import SettingsSlider from './SettingsSlider.svelte';
</script>

<script lang="ts">
    // export let name: string = ull;
    export let options: { text; value }[] = null;
    export let settings: any[] = null;
    export let color = new Color($textColor);
    export let currentOption;
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

<gesturerootview>
    <gridLayout rows="auto,*,auto" borderRadius={4} backgroundColor={$widgetBackgroundColor} margin={2} elevation={2}>
        {#if options}
            <stacklayout orientation="horizontal" horizontalAlignment="center" margin={5}>
                {#each options as option, index}
                    <IconButton
                        text={option.text}
                        fontFamily={alpimapsFontFamily}
                        on:tap={() => onActualOptionChanged(option.value)}
                        color={currentOption === option.value ? inversedColor : color}
                        backgroundColor={currentOption === option.value ? color : 'transparent'}
                    />
                {/each}
            </stacklayout>
        {/if}
        <collectionview
            bind:this={collectionView}
            row={1}
            items={settings}
            rowHeight={80}
            height={Math.min(300, settings.length * 80)}
            itemTemplateSelector={(item) => (item.type === 'switch' ? item.type : 'default')}
        >
            <Template let:item>
                <SettingsSlider
                    icon={item.icon}
                    title={item.title}
                    value={item.value}
                    min={item.min}
                    max={item.max}
                    step={item.step}
                    onChange={item.onChange}
                    borderBottomColor={$borderColor}
                    borderBottomWidth={1}
                />
            </Template>
            <Template let:item key="switch">
                <gridlayout columns="*, auto" padding="0 10 0 30">
                    <stackLayout verticalAlignment="middle">
                        <label color={$textColor} fontSize={17} text={item.title} textWrap="true" verticalTextAlignment="top" maxLines={2} lineBreak="end" />
                        <label
                            color={$subtitleColor}
                            visibility={item.subtitle && item.subtitle.length > 0 ? 'visible' : 'collapsed'}
                            fontSize={14}
                            text={item.subtitle}
                            verticalTextAlignment="top"
                            maxLines={2}
                            lineBreak="end"
                        />
                    </stackLayout>
                    <switch col={1} checked={item.value} on:checkedChange={(e) => onCheckBox(item, e.value)} verticalAlignment="middle" />
                    <absoluteLayout colSpan={2} backgroundColor={$borderColor} height={1} verticalAlignment="bottom" />
                </gridlayout>
            </Template>
        </collectionview>
        {#if onReset}
            <mdbutton
                row={2}
                horizontalAlignment="left"
                verticalTextAlignment="center"
                textAlignment="center"
                android:padding="8 4 0 4"
                ios:paddingTop={0}
                variant="text"
                color={$textColor}
                rippleColor={$textColor}
                on:tap={onActualReset}
            >
                <span text="mdi-cancel" fontFamily={mdiFontFamily} fontSize={20} verticalAlignment="middle" />
                <span text={lc('reset_settings')} verticalAlignment="middle" />
            </mdbutton>
        {/if}
    </gridLayout>
</gesturerootview>
