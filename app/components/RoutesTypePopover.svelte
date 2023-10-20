<script context="module" lang="ts">
    import { lc } from '@nativescript-community/l';
    import { RoutesType } from '~/mapModules/CustomLayersModule';
    import { routesType } from '~/stores/mapStore';
    import { widgetBackgroundColor } from '~/variables';
</script>

<script lang="ts">
    export let backgroundColor = $widgetBackgroundColor;
</script>

<gesturerootview columns="auto">
    <stacklayout {backgroundColor} borderRadius={4} elevation={2} horizontalAlignment="left" margin={2} padding="10" width="auto">
        <checkbox boxType="circle" checked={$routesType === RoutesType.All} text={lc('all')} on:tap={(e) => routesType.set(RoutesType.All)} />
        <checkbox boxType="circle" checked={$routesType === RoutesType.Bicycle} text={lc('bicycle')} on:tap={(e) => routesType.set(RoutesType.Bicycle)} />
        <checkbox boxType="circle" checked={$routesType === RoutesType.Hiking} text={lc('hiking')} on:tap={(e) => routesType.set(RoutesType.Hiking)} />
    </stacklayout>
</gesturerootview>
