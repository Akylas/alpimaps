<script lang="ts" context="module">
    import { Color } from '@nativescript/core';
    import { Template } from 'svelte-native/components';
    import { alpimapsFontFamily, borderColor, textColor, widgetBackgroundColor } from '~/variables';
    import IconButton from './IconButton.svelte';
    import SettingsSlider from './SettingsSlider.svelte';
</script>

<script lang="ts">
    // export let name: string = null;
    export let options: { text; value }[];
    export let settings: any[];
    export let color = new Color($textColor);
    export let currentOption;
    export let inversedColor = new Color(inverse(color.argb)).setAlpha(255).hex;
    export let onOptionChange: (value) => void = null;

    function onActualOptionChanged(value) {
        currentOption = value;
        onOptionChange && onOptionChange(value);
    }

    $: color = new Color($textColor);
    $: inversedColor = new Color(inverse(color.argb)).setAlpha(255).hex;

    function inverse(figure) {
        // inverse a RGB color
        return 0xffffff - figure;
    }
</script>

<gesturerootview>
    <gridLayout rows="auto,*" borderRadius="4" backgroundColor={$widgetBackgroundColor} margin="2" elevation="2">
        <stacklayout orientation="horizontal" horizontalAlignment="center" margin="5">
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
        <collectionview row={1} items={settings} rowHeight={80} height={Math.min(300, settings.length * 80)}>
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
        </collectionview>
    </gridLayout>
</gesturerootview>
