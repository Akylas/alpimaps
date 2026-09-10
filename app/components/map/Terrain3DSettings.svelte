<script lang="ts">
    /**
     * The 3D terrain mode's settings, behind a long press on its side-bar button.
     *
     * Every row binds a store from `~/stores/terrainStore`, and the module subscribes to those stores —
     * so a slider moves the live map with no wiring here, and the app settings screen shows the same
     * values because it binds the same stores.
     */
    import { lc } from '~/helpers/locale';
    import StoreSlider from '~/components/settings/StoreSlider.svelte';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import {
        terrain3dTilt,
        terrainAutoFlattenByTilt,
        terrainCameraClearance,
        terrainExaggeration,
        terrainFlattenModeFull,
        terrainFog,
        terrainMeshResolution,
        terrainSky,
        terrainSwitchDuration,
        terrainViewDistanceFactor
    } from '~/stores/terrainStore';
    import { colors, windowInset } from '~/variables';

    $: ({ colorOnSurfaceVariant, colorSurfaceContainer } = $colors);
</script>

<scrollview backgroundColor={colorSurfaceContainer}>
    <!-- the inset goes on the content: scrollview takes no padding -->
    <stacklayout paddingBottom={10 + (__ANDROID__ ? $windowInset.bottom : 0)} paddingTop={10}>
        <label class="sectionHeader" color={colorOnSurfaceVariant} fontSize={13} padding="4 16 4 16" text={lc('terrain_3d').toUpperCase()} />
        <StoreSlider format={(value) => `${value.toFixed(2)}×`} max={3} min={0.5} step={0.05} store={terrainExaggeration} title={lc('exageration')} />
        <StoreSlider format={(value) => String(Math.round(value))} max={256} min={16} step={16} store={terrainMeshResolution} title={lc('mesh_resolution')} />
        <StoreSlider format={(value) => `${value.toFixed(1)}×`} max={6} min={0.5} step={0.1} store={terrainViewDistanceFactor} title={lc('view_distance_factor')} />
        <StoreSlider format={(value) => `${Math.round(value)} m`} max={400} min={10} step={10} store={terrainCameraClearance} title={lc('camera_clearance')} />
        <StoreSlider format={(value) => `${value.toFixed(1)} s`} max={6} min={0} step={0.1} store={terrainSwitchDuration} title={lc('switch_duration')} />
        <StoreSlider format={(value) => `${Math.round(value)}°`} max={80} min={5} step={1} store={terrain3dTilt} title={lc('threed_tilt')} />

        <label class="sectionHeader" color={colorOnSurfaceVariant} fontSize={13} padding="12 16 4 16" text={lc('behavior').toUpperCase()} />
        <StoreSwitch description={lc('threed_flatten_mode_full_desc')} store={terrainFlattenModeFull} title={lc('threed_flatten_mode_full')} />
        <StoreSwitch description={lc('auto_3d_by_tilt_desc')} store={terrainAutoFlattenByTilt} title={lc('auto_3d_by_tilt')} />
        <StoreSwitch store={terrainSky} title={lc('sky')} />
        <StoreSwitch store={terrainFog} title={lc('fog')} />
    </stacklayout>
</scrollview>
