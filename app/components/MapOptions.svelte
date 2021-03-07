<script lang="ts" context="module">
    import { Template } from 'svelte-native/components';
    import { closeModal } from 'svelte-native';
    import { mdiFontFamily, primaryColor } from '~/variables';
    import { closeBottomSheet } from './bottomsheet';
    import { Color } from '@nativescript/core';
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

<collectionView items={options} {height} colWidth="20%" rowHeight="80" backgroundColor="#99000000">
    <Template let:item>
        <gridlayout backgroundColor={item.color} rippleColor={item.color || primaryColor} on:tap={() => onTap(item)}>
            <canvaslabel paddingTop="15"  color="white">
                <cgroup verticalAlignment="top" textAlignment="center">
                    <cspan fontFamily={mdiFontFamily} text={item.icon} fontSize="30" />
                    <cspan text={'\n' + item.title} fontSize="12" />
                </cgroup>
            </canvaslabel>
        </gridlayout>
    </Template>
</collectionView>
