<script context="module" lang="ts">
    import { lc } from '@nativescript-community/l';
    import { RoutesType } from '~/mapModules/CustomLayersModule';
    import { routesType } from '~/stores/mapStore';
    import { colors, fonts } from '~/variables';
    import PopoverBackgroundView from '../common/PopoverBackgroundView.svelte';
</script>

<script lang="ts">
    // let { colorSurfaceContainer } = $colors;
    // $: ({ colorSurfaceContainer } = $colors);
    // export let backgroundColor = colorSurfaceContainer;
</script>

<PopoverBackgroundView columns="auto">
    <!-- <gesturerootview columns="auto"> -->
    <stacklayout width="auto">
        <checkbox boxType="circle" checked={$routesType === RoutesType.All} text={lc('all')} on:tap={(e) => routesType.set(RoutesType.All)} />
        <checkbox boxType="circle" checked={$routesType === RoutesType.Bicycle} text={lc('bicycle')} on:tap={(e) => routesType.set(RoutesType.Bicycle)} />
        <checkbox boxType="circle" checked={$routesType === RoutesType.Hiking} text={lc('hiking')} on:tap={(e) => routesType.set(RoutesType.Hiking)} />
    </stacklayout>
</PopoverBackgroundView>
