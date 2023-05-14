<script lang="ts" context="module">
    import { RoutesType } from '~/mapModules/CustomLayersModule';
    import { lc } from '@nativescript-community/l';
    import { routesType } from '~/stores/mapStore';
    import { widgetBackgroundColor } from '~/variables';
</script>

<script lang="ts">
    export let backgroundColor = $widgetBackgroundColor;
</script>

<gesturerootview columns="auto">
    <stacklayout borderRadius={4} {backgroundColor} margin={2} elevation={2} width="auto" horizontalAlignment="left" padding="10">
    <checkbox boxType="circle" text={lc('all')} checked={$routesType === RoutesType.All} on:tap={(e) => routesType.set(RoutesType.All)} />
    <checkbox boxType="circle" text={lc('bicycle')} checked={$routesType === RoutesType.Bicycle} on:tap={(e) => routesType.set(RoutesType.Bicycle)} />
    <checkbox boxType="circle" text={lc('hiking')} checked={$routesType === RoutesType.Hiking} on:tap={(e) => routesType.set(RoutesType.Hiking)} />
</stacklayout>
</gesturerootview>
