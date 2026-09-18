<script lang="ts">
    /**
     * The 3D terrain mode's settings, behind a long press on its side-bar button.
     *
     * Every row binds a store from `~/stores/terrainStore`, and the module subscribes to those stores —
     * so a slider moves the live map with no wiring here, and the app settings screen shows the same
     * values because it binds the same stores.
     *
     * A COLLECTIONVIEW, like `MapOptions`, and for the same reason: the list is long enough that a
     * stacklayout in a scrollview builds and measures every row up front, sliders included, while the
     * bottom sheet is opening. The rows are therefore DATA — `type` picks the template — and the
     * gesturerootview is what lets a slider drag inside a bottom sheet reach the slider instead of
     * being taken by the sheet's own pan gesture.
     */
    import { Template } from '@nativescript-community/svelte-native/components';
    import type { Writable } from 'svelte/store';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import StoreSegment from '~/components/settings/StoreSegment.svelte';
    import StoreSlider from '~/components/settings/StoreSlider.svelte';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import {
        terrain3dTilt,
        terrainAutoFlattenByTilt,
        terrainCameraClearance,
        terrainExaggeration,
        terrainFlattenModeFull,
        terrainFog,
        terrainFogVerticalEnd,
        terrainFogVerticalStart,
        terrainLighting,
        terrainMeshResolution,
        terrainShadowCascades,
        terrainShadowCasterMargin,
        terrainShadowDistance,
        terrainShadowMapSize,
        terrainShadowSoftness,
        terrainShadowStrength,
        terrainShadows,
        terrainSky,
        terrainSwitchDuration,
        terrainTouchMode,
        terrainViewDistanceFactor,
        terrainViewDistanceMax,
        terrainViewDistanceMetres
    } from '~/stores/terrainStore';
    import { colors, screenHeightDips, windowInset } from '~/variables';

    interface SettingRow {
        type: 'sectionheader' | 'switch' | 'slider' | 'segment';
        title: string;
        description?: string;
        store?: Writable<any>;
        min?: number;
        max?: number;
        step?: number;
        format?: (value: number) => string;
        options?: { value: string; title: string }[];
    }

    $: ({ colorOnSurfaceVariant, colorSurfaceContainer } = $colors);

    const touchModes = [
        { value: 'classic', title: lc('touch_mode_classic') },
        { value: 'look', title: lc('touch_mode_look') },
        { value: 'fps', title: lc('touch_mode_fps') }
    ];

    const section = (title: string): SettingRow => ({ type: 'sectionheader', title });
    const header = (title: string) => title.toUpperCase();
    const degrees = (value: number) => `${Math.round(value)}°`;

    // The shadow knobs are only worth showing once shadows are on, so the list is rebuilt when that
    // switch moves — the only thing here that changes the rows rather than a row's value.
    $: rows = [
        section(header(lc('terrain_3d'))),
        { type: 'slider', store: terrainExaggeration, title: lc('exageration'), min: 0.5, max: 3, step: 0.05, format: (value) => `${value.toFixed(2)}×` },
        { type: 'slider', store: terrainMeshResolution, title: lc('mesh_resolution'), min: 16, max: 256, step: 16, format: (value) => String(Math.round(value)) },
        { type: 'slider', store: terrainViewDistanceFactor, title: lc('view_distance_factor'), min: 0.5, max: 6, step: 0.1, format: (value) => `${value.toFixed(1)}×` },
        {
            type: 'slider',
            store: terrainViewDistanceMetres,
            title: lc('viewing_distance'),
            description: lc('viewing_distance_desc'),
            min: 0,
            max: 400000,
            step: 10000,
            format: (value) => (value === 0 ? lc('no_limit') : formatDistance(value))
        },
        {
            type: 'slider',
            store: terrainViewDistanceMax,
            title: lc('viewing_distance_max'),
            description: lc('viewing_distance_max_desc'),
            min: 0,
            max: 400000,
            step: 5000,
            format: (value) => (value === 0 ? lc('no_limit') : formatDistance(value))
        },
        { type: 'slider', store: terrainCameraClearance, title: lc('camera_clearance'), min: 10, max: 400, step: 1, format: (value) => `${Math.round(value)} m` },
        { type: 'slider', store: terrainSwitchDuration, title: lc('switch_duration'), min: 0, max: 6, step: 0.1, format: (value) => `${value.toFixed(1)} s` },
        { type: 'slider', store: terrain3dTilt, title: lc('threed_tilt'), min: 5, max: 80, step: 1, format: degrees },

        section(header(lc('behavior'))),
        { type: 'segment', store: terrainTouchMode, title: lc('touch_mode'), description: lc('touch_mode_desc'), options: touchModes },
        { type: 'switch', store: terrainFlattenModeFull, title: lc('threed_flatten_mode_full'), description: lc('threed_flatten_mode_full_desc') },
        { type: 'switch', store: terrainAutoFlattenByTilt, title: lc('auto_3d_by_tilt'), description: lc('auto_3d_by_tilt_desc') },
        { type: 'switch', store: terrainSky, title: lc('sky') },
        { type: 'switch', store: terrainFog, title: lc('fog'), description: lc('terrain_fog_desc') },
        // the altitudes the haze fades out between: what leaves the summits standing above it
        { type: 'slider', store: terrainFogVerticalStart, title: lc('fog_vertical_start'), description: lc('fog_vertical_start_desc'), min: 0, max: 4000, step: 100, format: formatDistance },
        { type: 'slider', store: terrainFogVerticalEnd, title: lc('fog_vertical_end'), description: lc('fog_vertical_end_desc'), min: 0, max: 6000, step: 100, format: formatDistance },

        section(header(lc('lighting'))),
        { type: 'switch', store: terrainLighting, title: lc('terrain_lighting'), description: lc('terrain_lighting_desc') },
        { type: 'switch', store: terrainShadows, title: lc('shadows'), description: lc('shadows_desc') },
        ...($terrainShadows
            ? ([
                  {
                      type: 'slider',
                      store: terrainShadowStrength,
                      title: lc('shadow_strength'),
                      description: lc('shadow_strength_desc'),
                      min: 0,
                      max: 2,
                      step: 0.05,
                      format: (value) => value.toFixed(2)
                  },
                  {
                      type: 'slider',
                      store: terrainShadowDistance,
                      title: lc('shadow_distance'),
                      description: lc('shadow_distance_desc'),
                      min: 0,
                      max: 12,
                      step: 0.5,
                      format: (value) => (value === 0 ? lc('auto') : `${value.toFixed(1)}×`)
                  },
                  {
                      type: 'slider',
                      store: terrainShadowMapSize,
                      title: lc('shadow_map_size'),
                      description: lc('shadow_map_size_desc'),
                      min: 256,
                      max: 4096,
                      step: 256,
                      format: (value) => `${Math.round(value)} px`
                  },
                  {
                      type: 'slider',
                      store: terrainShadowCascades,
                      title: lc('shadow_cascades'),
                      description: lc('shadow_cascades_desc'),
                      min: 1,
                      max: 4,
                      step: 1,
                      format: (value) => String(Math.round(value))
                  },
                  {
                      type: 'slider',
                      store: terrainShadowSoftness,
                      title: lc('shadow_softness'),
                      description: lc('shadow_softness_desc'),
                      min: 0,
                      max: 8,
                      step: 0.5,
                      format: (value) => value.toFixed(1)
                  },
                  {
                      type: 'slider',
                      store: terrainShadowCasterMargin,
                      title: lc('shadow_caster_margin'),
                      description: lc('shadow_caster_margin_desc'),
                      min: 0,
                      max: 8,
                      step: 1,
                      format: (value) => String(Math.round(value))
                  }
              ] as SettingRow[])
            : [])
    ] as SettingRow[];

    function itemTemplateSelector(item: SettingRow) {
        return item.type;
    }
</script>

<gesturerootview backgroundColor={colorSurfaceContainer} height={Math.round(screenHeightDips * 0.6)}>
    <!-- the inset goes on the content: the collectionview scrolls under it -->
    <collectionview {itemTemplateSelector} items={rows} ios:contentInsetAdjustmentBehavior={2} paddingBottom={10 + (__ANDROID__ ? $windowInset.bottom : 0)} paddingTop={10}>
        <Template key="sectionheader" let:item>
            <label class="sectionHeader" color={colorOnSurfaceVariant} fontSize={13} padding="12 16 4 16" text={item.title} />
        </Template>
        <Template key="switch" let:item>
            <StoreSwitch description={item.description} store={item.store} title={item.title} />
        </Template>
        <Template key="segment" let:item>
            <StoreSegment description={item.description} options={item.options} store={item.store} title={item.title} />
        </Template>
        <Template key="slider" let:item>
            <StoreSlider description={item.description} format={item.format} max={item.max} min={item.min} step={item.step} store={item.store} title={item.title} />
        </Template>
    </collectionview>
</gesturerootview>
