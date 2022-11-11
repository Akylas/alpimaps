<script lang="ts" context="module">
    import { Color } from '@nativescript/core';
    import { Template } from 'svelte-native/components';
    import { closeBottomSheet } from '~/utils/svelte/bottomsheet';
    import { mdiFontFamily, primaryColor } from '~/variables';
    export interface MapOptionType {
        title: string;
        color?: Color | string;
        id: string;
        icon: string;
    }
</script>

<script lang="ts">
    export let options: MapOptionType[];

    export let height: number = Math.ceil(options.length / 5) * 80;

    function close(value?: MapOptionType) {
        closeBottomSheet(value);
    }

    function onTap(item: MapOptionType) {
        close(item);
    }
</script>

<collectionView items={options} {height} colWidth="20%" rowHeight={80}>
    <Template let:item>
        <canvaslabel backgroundColor={item.color} rippleColor={item.color || primaryColor} on:tap={() => onTap(item)} borderRadius={10} paddingTop={15}>
            <cgroup verticalAlignment="top" textAlignment="center">
                <cspan fontFamily={mdiFontFamily} text={item.icon} fontSize={30} />
                <cspan text={'\n' + item.title} fontSize={12} />
            </cgroup>
        </canvaslabel>
    </Template>
</collectionView>
