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

<gesturerootview rows="auto">
    <collectionView colWidth="20%" {height} items={options} rowHeight={80}>
        <Template let:item>
            <canvaslabel
                accessibilityValue={item.accessibilityValue}
                backgroundColor={item.color}
                borderRadius={10}
                paddingTop={15}
                rippleColor={item.color || colorPrimary}
                on:tap={() => onTap(item)}>
                <cgroup textAlignment="center" verticalAlignment="top">
                    <cspan fontFamily={$fonts.mdi} fontSize={30} text={item.icon} />
                    <cspan fontSize={12} text={'\n' + item.title} />
                </cgroup>
            </canvaslabel>
        </Template>
    </collectionView>
</gesturerootview>
