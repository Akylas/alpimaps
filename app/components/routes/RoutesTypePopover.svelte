<script context="module" lang="ts">
    import { lc } from '@nativescript-community/l';
    import { RoutesType } from '~/mapModules/CustomLayersModule';
    import { nutiProps } from '~/stores/mapStore';
    import { colors, fonts } from '~/variables';
    import PopoverBackgroundView from '../common/PopoverBackgroundView.svelte';
</script>

<script lang="ts">
    // let { colorSurfaceContainer } = $colors;
    // $: ({ colorSurfaceContainer } = $colors);
    // export let backgroundColor = colorSurfaceContainer;
    function updateProp(value) {
        nutiProps['routes_type'] = value;
    }
    const routesType = nutiProps.getStore('routes_type');
</script>

<PopoverBackgroundView columns="auto">
    <!-- <gesturerootview columns="auto"> -->
    <stacklayout width="auto">
        <checkbox checked={$routesType === RoutesType.All} text={lc('all')} on:tap={(e) => updateProp(RoutesType.All)} />
        <checkbox checked={$routesType === RoutesType.Bicycle} text={lc('bicycle')} on:tap={(e) => updateProp(RoutesType.Bicycle)} />
        <checkbox checked={$routesType === RoutesType.Hiking} text={lc('hiking')} on:tap={(e) => updateProp(RoutesType.Hiking)} />
    </stacklayout>
</PopoverBackgroundView>
