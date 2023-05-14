<script lang="ts" context="module">
    import { RoutesType } from '~/mapModules/CustomLayersModule';
    import { lc } from '@nativescript-community/l';
    import { routesType } from '~/stores/mapStore';
</script>

<script lang="ts">
</script>

<gridLayout>
    <stacklayout>
        <checkbox text={lc('all')} checked={$routesType === RoutesType.All} on:checkedChange={(e) => routesType.set(RoutesType.All)} />
        <checkbox text={lc('bicycle')} checked={$routesType === RoutesType.Bicycle} on:checkedChange={(e) => routesType.set(RoutesType.Bicycle)} />
        <checkbox text={lc('hiking')} checked={$routesType === RoutesType.Hiking} on:checkedChange={(e) => routesType.set(RoutesType.Hiking)} />

    </stacklayout>
</gridLayout>
