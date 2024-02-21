<script context="module" lang="ts">
    import { Color } from '@nativescript/core';
    import { Template } from 'svelte-native/components';
    import { closeBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { colors, fonts } from '~/variables';
    export interface MapOptionType {
        title: string;
        color?: Color | string;
        id: string;
        icon: string;
    }
</script>

<script lang="ts">
    $: ({ colorPrimary } = $colors);
    export let options: MapOptionType[];

    export let height: number = Math.ceil(options.length / 5) * 80;

    function close(value?: MapOptionType) {
        closeBottomSheet(value);
    }

    function onTap(item: MapOptionType) {
        close(item);
    }
</script>

<gesturerootview {height}>
    <collectionView id="scrollView" colWidth="20%" ios:iosIgnoreSafeArea={true} items={options} rowHeight={80}>
        <Template let:item>
            <label
                accessibilityValue={item.accessibilityValue}
                backgroundColor={item.color || 'transparent'}
                borderRadius={10}
                padding="10 4 0 4"
                rippleColor={item.color || colorPrimary}
                textAlignment="center"
                textWrap={true}
                verticalTextAlignment="top"
                on:tap={() => onTap(item)}>
                <cspan fontFamily={$fonts.mdi} fontSize={30} text={item.icon} />
                <cspan fontSize={12} text={'\n' + item.title} />
            </label>
        </Template>
    </collectionView>
</gesturerootview>
